"""
move_files_to_sql

Revision ID: ulapmx8i3vpg
Date: 2024-05-16 22:44:08.942465

"""

import arrow
from sqlalchemy import select, insert
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.migration import MigrationContext
from virtool.uploads.models import SQLUpload

# Revision identifiers.
name = "move_files_to_sql"
created_at = arrow.get("2024-05-16 22:44:08.942465")
revision_id = "ulapmx8i3vpg"

alembic_down_revision = "141c7ecb99b7"
virtool_down_revision = "None"

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext):
    
    async with AsyncSession(ctx.pg) as session:
        async for document in ctx.mongo.files.find():
            exists = (
                await session.execute(
                    select(SQLUpload).filter_by(name_on_disk=document["_id"]),
                )
            ).scalar()

            if not exists:
                session.add(
                    SQLUpload(
                        name=document["name"],
                        name_on_disk=document["_id"],
                        ready=document["ready"],
                        removed=False,
                        reserved=document["reserved"],
                        size=document["size"],
                        type=document["type"],
                        user=document["user"]["id"],
                        uploaded_at=document["uploaded_at"],
                    )
                )

        await session.commit()


async def test_upgrade(ctx: MigrationContext, snapshot):
    async with ctx.pg.begin() as conn:
        await conn.run_sync(SQLUpload.metadata.create_all)
        await conn.commit()
    pass

    await ctx.mongo.files.insert_many(
        [
            {
                "_id": "file_1.fasta.gz",
                "name": "File 1",
                "ready": True,
                "reserved": False,
                "size": 1,
                "type": "reads",
                "user": {"id": "user_1_id"},
                "uploaded_at": arrow.get("2024-05-16T22:44:08.942465").naive,
            },
            {
                "_id": "file_2.fasta.gz",
                "name": "File 2",
                "ready": False,
                "reserved": True,
                "size": 1,
                "type": "reads",
                "user": {"id": "user_2_id"},
                "uploaded_at": arrow.get("2024-05-16T22:44:08.942465").naive,
            },
            {
                "_id": "file_3.fasta.gz",
                "name": "File 3",
                "ready": True,
                "reserved": False,
                "size": 1,
                "type": "reads",
                "user": {"id": "user_3_id"},
                "uploaded_at": arrow.get("2024-05-16T22:44:08.942465").naive,
            },
        ]
    )

    async with AsyncSession(ctx.pg) as session:
        session.add(
            SQLUpload(
                name="file 3 pre-ported",
                name_on_disk="file_3.fasta.gz",
                ready=False,
                removed=True,
                reserved=False,
                size=50,
                type="subtraction",
                user="user_3",
                uploaded_at=arrow.get("2024-05-16T22:44:08.942465").naive,
            )
        )
        await session.commit()

    await upgrade(ctx)

    async with AsyncSession(ctx.pg) as session:
        result = await session.execute(select(SQLUpload))
        snapshot.assert_match(result.scalars().unique().all())
