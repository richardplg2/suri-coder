import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ReviewStatus
from app.models.step_review import StepReview


class StepReviewService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_review(
        self, step_id: uuid.UUID, diff_content: str | None = None
    ) -> StepReview:
        # Get next revision number
        result = await self.db.execute(
            select(
                func.coalesce(func.max(StepReview.revision), 0)
            ).where(StepReview.step_id == step_id)
        )
        max_revision = result.scalar_one()

        review = StepReview(
            step_id=step_id,
            revision=max_revision + 1,
            diff_content=diff_content,
            status=ReviewStatus.pending,
        )
        self.db.add(review)
        await self.db.flush()
        return review

    async def approve_review(
        self, review_id: uuid.UUID
    ) -> StepReview:
        review = await self.db.get(StepReview, review_id)
        if not review:
            raise ValueError(f"Review {review_id} not found")
        review.status = ReviewStatus.approved
        await self.db.flush()
        return review

    async def request_changes(
        self, review_id: uuid.UUID, comments: list[dict]
    ) -> StepReview:
        review = await self.db.get(StepReview, review_id)
        if not review:
            raise ValueError(f"Review {review_id} not found")
        review.status = ReviewStatus.changes_requested
        review.comments = comments
        await self.db.flush()
        return review

    async def get_reviews(
        self, step_id: uuid.UUID
    ) -> list[StepReview]:
        result = await self.db.execute(
            select(StepReview)
            .where(StepReview.step_id == step_id)
            .order_by(StepReview.revision)
        )
        return list(result.scalars().all())

    async def get_latest_review(
        self, step_id: uuid.UUID
    ) -> StepReview | None:
        result = await self.db.execute(
            select(StepReview)
            .where(StepReview.step_id == step_id)
            .order_by(StepReview.revision.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()
