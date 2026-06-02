"""create analyses table

Revision ID: 5cb4e85e013f
Revises: 12c20b71cffc
Create Date: 2026-06-01 23:22:54.109921+00:00

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = "5cb4e85e013f"
down_revision = "12c20b71cffc"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "analyses",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("workflow", sa.String(), nullable=False),
        sa.Column("ready", sa.Boolean(), nullable=False),
        sa.Column("results", JSONB(), nullable=True),
        sa.Column("sample", sa.String(), nullable=False, index=True),
        sa.Column("reference", sa.String(), nullable=False),
        sa.Column("index", sa.String(), nullable=False),
        sa.Column("subtractions", JSONB(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("job_id", sa.Integer(), nullable=True),
        sa.Column("ml_id", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"]),
        sa.ForeignKeyConstraint(["ml_id"], ["ml_model_releases.id"]),
    )


def downgrade() -> None:
    op.drop_table("analyses")
