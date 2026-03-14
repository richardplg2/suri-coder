"""unified_session_manager_phase1a

Revision ID: 24876a7f07a7
Revises: 6dcca07134ba
Create Date: 2026-03-14 02:36:06.307497

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '24876a7f07a7'
down_revision: Union[str, Sequence[str], None] = '6dcca07134ba'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Create session_events table
    op.create_table(
        "session_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=True),
        sa.Column("content", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_session_events_session_id", "session_events", ["session_id"])
    op.create_index("ix_session_events_session_sequence", "session_events", ["session_id", "sequence"])

    # 2. Add columns to agent_configs
    op.add_column("agent_configs", sa.Column("agent_type", sa.String(length=50), nullable=True))
    op.add_column("agent_configs", sa.Column("output_format", sa.JSON(), nullable=True))

    # 3. Add unique constraint to project_members (model has UniqueConstraint but DB doesn't)
    op.create_unique_constraint("uq_project_members_project_user", "project_members", ["project_id", "user_id"])

    # 4. Alter sessions table — add new columns
    op.add_column("sessions", sa.Column("project_id", sa.Uuid(), nullable=True))
    op.add_column("sessions", sa.Column("ticket_id", sa.Uuid(), nullable=True))
    op.add_column("sessions", sa.Column("agent_config_id", sa.Uuid(), nullable=True))
    op.add_column("sessions", sa.Column("parent_session_id", sa.Uuid(), nullable=True))
    op.add_column("sessions", sa.Column("conversation_history", sa.JSON(), nullable=True))
    op.add_column("sessions", sa.Column("total_input_tokens", sa.Integer(), nullable=True))
    op.add_column("sessions", sa.Column("total_output_tokens", sa.Integer(), nullable=True))

    # 5. Make sessions.step_id nullable and update its FK ondelete to SET NULL
    op.alter_column("sessions", "step_id", existing_type=sa.UUID(), nullable=True)
    op.drop_constraint("sessions_step_id_fkey", "sessions", type_="foreignkey")
    op.create_foreign_key("fk_sessions_step_id", "sessions", "workflow_steps", ["step_id"], ["id"], ondelete="SET NULL")

    # 6. Add FK constraints for new session columns
    op.create_foreign_key("fk_sessions_project_id", "sessions", "projects", ["project_id"], ["id"], ondelete="CASCADE")
    op.create_foreign_key("fk_sessions_ticket_id", "sessions", "tickets", ["ticket_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_sessions_agent_config_id", "sessions", "agent_configs", ["agent_config_id"], ["id"])
    op.create_foreign_key("fk_sessions_parent_session_id", "sessions", "sessions", ["parent_session_id"], ["id"], ondelete="SET NULL")

    # NOTE: status column is String(20), not a PG enum — no ALTER TYPE needed


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("fk_sessions_parent_session_id", "sessions", type_="foreignkey")
    op.drop_constraint("fk_sessions_agent_config_id", "sessions", type_="foreignkey")
    op.drop_constraint("fk_sessions_ticket_id", "sessions", type_="foreignkey")
    op.drop_constraint("fk_sessions_project_id", "sessions", type_="foreignkey")
    op.drop_constraint("fk_sessions_step_id", "sessions", type_="foreignkey")
    op.create_foreign_key("sessions_step_id_fkey", "sessions", "workflow_steps", ["step_id"], ["id"], ondelete="CASCADE")
    op.alter_column("sessions", "step_id", existing_type=sa.UUID(), nullable=False)
    op.drop_column("sessions", "total_output_tokens")
    op.drop_column("sessions", "total_input_tokens")
    op.drop_column("sessions", "conversation_history")
    op.drop_column("sessions", "parent_session_id")
    op.drop_column("sessions", "agent_config_id")
    op.drop_column("sessions", "ticket_id")
    op.drop_column("sessions", "project_id")
    op.drop_constraint("uq_project_members_project_user", "project_members", type_="unique")
    op.drop_column("agent_configs", "output_format")
    op.drop_column("agent_configs", "agent_type")
    op.drop_index("ix_session_events_session_sequence", "session_events")
    op.drop_index("ix_session_events_session_id", "session_events")
    op.drop_table("session_events")
