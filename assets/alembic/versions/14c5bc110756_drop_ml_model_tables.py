"""drop ml model tables

Revision ID: 14c5bc110756
Revises: 95ca6fc2a5db
Create Date: 2026-07-02 17:04:38.183547+00:00

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "14c5bc110756"
down_revision = "95ca6fc2a5db"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table("ml_model_releases")
    op.drop_table("ml_models")


def downgrade() -> None:
    op.create_table(
        "ml_models",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    op.create_table(
        "ml_model_releases",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("download_url", sa.String(), nullable=False),
        sa.Column("github_url", sa.String(), nullable=False),
        sa.Column("model_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("published_at", sa.DateTime(), nullable=False),
        sa.Column("ready", sa.Boolean(), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["model_id"],
            ["ml_models.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
