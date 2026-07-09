"""convert index file type to text

Revision ID: b82907bcac9d
Revises: 1ffbe2dcb108
Create Date: 2026-06-19 23:56:44.136717+00:00

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "b82907bcac9d"
down_revision = "1ffbe2dcb108"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE index_files ALTER COLUMN type TYPE text USING type::text",
    )

    op.execute("DROP TYPE indextype")

    op.create_check_constraint(
        "index_file_type_valid",
        "index_files",
        "type IN ('json', 'sqlite', 'fasta', 'bowtie2')",
    )


def downgrade() -> None:
    op.drop_constraint("index_file_type_valid", "index_files", type_="check")

    op.execute("CREATE TYPE indextype AS ENUM ('json', 'fasta', 'bowtie2')")

    op.execute("UPDATE index_files SET type = 'json' WHERE type = 'sqlite'")

    op.execute(
        "ALTER TABLE index_files ALTER COLUMN type TYPE indextype "
        "USING type::indextype",
    )
