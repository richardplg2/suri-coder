"""migrate_brainstorm_to_session_events

Revision ID: 751c1b967f70
Revises: 24876a7f07a7
Create Date: 2026-03-14 03:34:07.692235

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '751c1b967f70'
down_revision: Union[str, Sequence[str], None] = '24876a7f07a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # NOTE: brainstorm_messages used string session_ids (not UUIDs).
    # Brainstorm sessions in the new system are proper Session records.
    # Since old brainstorm sessions have no corresponding Session records,
    # we cannot migrate the data relationally. Instead, we archive it.
    # If you need to preserve brainstorm history, export before running this.

    # Drop brainstorm_messages table
    op.drop_table("brainstorm_messages")


def downgrade() -> None:
    # Recreate brainstorm_messages table (empty — data is lost)
    op.create_table(
        "brainstorm_messages",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("session_id", sa.String(36), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("message_type", sa.String(20), nullable=False),
        sa.Column("structured_data", sa.JSON(), nullable=True),
        sa.Column("ticket_id", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
