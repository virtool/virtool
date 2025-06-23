"""move files to sql

Revision ID: ulapmx8i3vpg
Date: 2024-05-16 22:44:08.942465

"""

import arrow
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.migration import MigrationContext

# Revision identifiers.
name = "move files to sql"
created_at = arrow.get("2024-05-16 22:44:08.942465")
revision_id = "ulapmx8i3vpg"

alembic_down_revision = "141c7ecb99b7"
virtool_down_revision = None

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = "e694fb270acb"


async def upgrade(ctx: MigrationContext):
    async with AsyncSession(ctx.pg) as session:
        async for document in ctx.mongo.files.find(
            {"type": {"$in": ["hmm", "reference", "reads", "subtraction"]}},
        ):
            result = await session.execute(
                text("SELECT 1 FROM uploads WHERE name_on_disk = :name_on_disk LIMIT 1"),
                {"name_on_disk": document["_id"]}
            )

            if result.first():
                continue

            size = document.get("size")
            if size is None and (ctx.data_path / "files").exists():
                file_path = ctx.data_path / "files" / document["_id"]
                size = file_path.stat().st_size if file_path.exists() else 0

            user = document["user"]
            user_id = user if user is None else user["id"]

            await session.execute(
                text("""
                    INSERT INTO uploads (name, name_on_disk, ready, removed, reserved, size, type, "user", uploaded_at)
                    VALUES (:name, :name_on_disk, :ready, :removed, :reserved, :size, :type, :user, :uploaded_at)
                """),
                {
                    "name": document["name"],
                    "name_on_disk": document["_id"],
                    "ready": document["ready"],
                    "removed": False,
                    "reserved": document["reserved"],
                    "size": size,
                    "type": document["type"],
                    "user": user_id,
                    "uploaded_at": document["uploaded_at"],
                }
            )

        await session.commit()
