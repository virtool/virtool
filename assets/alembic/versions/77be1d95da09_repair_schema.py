"""repair schema

Revision ID: 77be1d95da09
Revises: 8f3810c1c2c9
Create Date: 2024-01-02 21:52:48.763886+00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Session


# revision identifiers, used by Alembic.
revision = "77be1d95da09"
down_revision = "8f3810c1c2c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint("spaces_name_unique", "spaces", ["name"])

    # Create a new column for deduplicated values
    op.add_column(
        "groups", sa.Column("name_dedup", sa.String(length=255), nullable=True)
    )

    op.alter_column(
        "groups",
        "permissions",
        existing_type=sa.JSON,
        type_=JSONB,
        postgresql_using="permissions::jsonb",
    )

    table = sa.Table("groups", sa.MetaData(), autoload_with=op.get_bind())

    with Session(bind=op.get_bind()) as session:
        distinct_names = session.execute(
            text("SELECT DISTINCT name FROM groups")
        ).fetchall()

        # Update the new column with deduplicated values
        for value in distinct_names:
            name = value[0]

            result = session.execute(
                select(table.c).where(table.c.name == name)
            ).fetchall()

            suffix = 0

            for i, row in enumerate(result):
                if i == 0:
                    new_name = name
                else:
                    new_name = f"{name} ({suffix})"

                session.execute(
                    text("UPDATE groups SET name_dedup = :new_name WHERE id = :id"),
                    {"new_name": new_name, "id": row[0]},
                )

                suffix += 1

        session.commit()

    op.drop_column("groups", "name")

    # Rename the new column to the original column name.
    op.alter_column("groups", "name_dedup", new_column_name="name", nullable=False)

    op.create_unique_constraint("groups_name_unique", "groups", ["name"])


def downgrade() -> None:
    op.drop_constraint("spaces_name_unique", "spaces", type_="unique")
