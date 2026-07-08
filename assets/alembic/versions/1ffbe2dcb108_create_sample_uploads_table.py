"""create sample uploads table

Revision ID: 1ffbe2dcb108
Revises: 48aa4cef7b47
Create Date: 2026-07-08 22:14:11.548643+00:00

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "1ffbe2dcb108"
down_revision = "48aa4cef7b47"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sample_uploads",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("sample", sa.String(), nullable=False),
        sa.Column("sample_id", sa.BigInteger(), nullable=True),
        sa.Column("upload_id", sa.Integer(), nullable=False),
        sa.Column("index", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("upload_id"),
        sa.ForeignKeyConstraint(["sample_id"], ["legacy_samples.id"]),
        sa.ForeignKeyConstraint(["upload_id"], ["uploads.id"]),
    )


def downgrade() -> None:
    op.drop_table("sample_uploads")
