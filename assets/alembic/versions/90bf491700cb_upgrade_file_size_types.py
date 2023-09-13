"""upgrade file size types

Revision ID: 90bf491700cb
Revises: e694fb270acb
Create Date: 2022-01-12 16:14:01.280566

"""
from alembic import op
from sqlalchemy import BigInteger, Integer

# revision identifiers, used by Alembic.
revision = "90bf491700cb"
down_revision = "e694fb270acb"
branch_labels = None
depends_on = None

TABLE_NAMES = (
    "analysis_files",
    "sample_artifacts_cache",
    "sample_reads_cache",
    "index_files",
    "sample_artifacts",
    "sample_reads",
    "subtraction_files",
)


def upgrade():
    for table_name in TABLE_NAMES:
        op.alter_column(table_name, column_name="size", type_=BigInteger)

    op.alter_column("tasks", column_name="file_size", type_=BigInteger)


def downgrade():
    for table_name in TABLE_NAMES:
        op.alter_column(table_name, column_name="size", type_=Integer)

    op.alter_column("tasks", column_name="file_size", type_=Integer)
