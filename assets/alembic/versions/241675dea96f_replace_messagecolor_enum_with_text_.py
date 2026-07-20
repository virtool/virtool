"""replace messagecolor enum with text check

Revision ID: 241675dea96f
Revises: c3741294977e
Create Date: 2026-07-20 16:07:20.053849+00:00

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "241675dea96f"
down_revision = "c3741294977e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE instance_messages ALTER COLUMN color TYPE text USING color::text",
    )

    op.execute("DROP TYPE messagecolor")

    op.create_check_constraint(
        "ck_instance_messages_color",
        "instance_messages",
        "color IN ('red', 'yellow', 'blue', 'purple', 'orange', 'grey')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_instance_messages_color", "instance_messages", type_="check")

    op.execute(
        "CREATE TYPE messagecolor AS ENUM "
        "('red', 'yellow', 'blue', 'purple', 'orange', 'grey')",
    )

    # `color` is NOT NULL, so coerce any value written while the column was
    # free-form text and outside the recreated enum to a valid member rather
    # than NULL, keeping the cast from failing.
    op.execute(
        "UPDATE instance_messages SET color = 'grey' "
        "WHERE color NOT IN ('red', 'yellow', 'blue', 'purple', 'orange', 'grey')",
    )

    op.execute(
        "ALTER TABLE instance_messages "
        "ALTER COLUMN color TYPE messagecolor USING color::messagecolor",
    )
