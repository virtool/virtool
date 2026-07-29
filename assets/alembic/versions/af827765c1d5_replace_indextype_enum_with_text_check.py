"""replace indextype enum with text check

Revision ID: af827765c1d5
Revises: 06d0b71c37c3
Create Date: 2026-07-29 00:56:17.601196+00:00

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "af827765c1d5"
down_revision = "06d0b71c37c3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE index_files ALTER COLUMN type TYPE text USING type::text",
    )

    op.execute("DROP TYPE indextype")

    op.create_check_constraint(
        "ck_index_files_type",
        "index_files",
        "type IN ('json', 'fasta', 'bowtie2', 'sqlite')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_index_files_type", "index_files", type_="check")

    op.execute(
        "CREATE TYPE indextype AS ENUM ('json', 'fasta', 'bowtie2')",
    )

    op.execute(
        "UPDATE index_files SET type = NULL "
        "WHERE type NOT IN ('json', 'fasta', 'bowtie2')",
    )

    op.execute(
        "ALTER TABLE index_files ALTER COLUMN type TYPE indextype "
        "USING type::indextype",
    )
