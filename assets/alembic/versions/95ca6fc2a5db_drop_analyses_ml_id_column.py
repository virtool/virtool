"""drop analyses ml_id column

Removes the ``analyses.ml_id`` foreign key to ``ml_model_releases`` now that the
ML subsystem has been retired. The column must be dropped before the
``ml_model_releases`` table it references.

The downgrade re-adds the nullable column and recreates the foreign key under
its original ``analyses_ml_id_fkey`` name.

Revision ID: 95ca6fc2a5db
Revises: edacc4a083f1
Create Date: 2026-07-02 16:02:47.426715+00:00

"""

import sqlalchemy as sa
from alembic import op

revision = "95ca6fc2a5db"
down_revision = "edacc4a083f1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("analyses_ml_id_fkey", "analyses", type_="foreignkey")
    op.drop_column("analyses", "ml_id")


def downgrade() -> None:
    op.add_column("analyses", sa.Column("ml_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "analyses_ml_id_fkey",
        "analyses",
        "ml_model_releases",
        ["ml_id"],
        ["id"],
    )
