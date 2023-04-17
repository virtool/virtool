"""
Remove ref process field

Revision ID: 1p681ke9wedv
Date: 2022-06-09 22:17:02.297460

"""
import arrow
from motor.motor_asyncio import AsyncIOMotorClientSession, AsyncIOMotorDatabase

# Revision identifiers.
name = "Remove ref process field"
created_at = arrow.get("2022-06-09 22:17:02.297460")
revision_id = "1p681ke9wedv"
required_alembic_revision = None


async def upgrade(motor_db: AsyncIOMotorDatabase, session: AsyncIOMotorClientSession):
    await motor_db.references.update_many({}, {"$unset": {"process": ""}})


async def test_upgrade(mongo, snapshot):
    await mongo.references.insert_many(
        [{"_id": "foo", "process": "test"}, {"_id": "bar", "task": "test"}]
    )

    async with await mongo.client.start_session() as session:
        async with session.start_transaction():
            await upgrade(mongo, session)

    assert await mongo.references.find().to_list(None) == snapshot
