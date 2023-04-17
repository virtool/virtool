"""
Remove software_update status document

Revision ID: gr5j6jx8ap7f
Date: 2022-06-09 22:20:48.591743

"""
import arrow
from motor.motor_asyncio import AsyncIOMotorDatabase

# Revision identifiers.
name = "Remove software_update status document"
created_at = arrow.get("2022-06-09 22:20:48.591743")
revision_id = "gr5j6jx8ap7f"
required_alembic_revision = None


async def upgrade(motor_db: AsyncIOMotorDatabase, _):
    await motor_db.status.delete_many(
        {"_id": {"$in": ["software", "software_update", "version"]}}
    )


async def test_upgrade(mongo, snapshot):
    await mongo.status.insert_many(
        [
            {"_id": "software_update", "foo": "bar"},
            {"_id": "version", "foo": "bar"},
            {"_id": "software"},
        ]
    )

    async with await mongo.client.start_session() as session:
        async with session.start_transaction():
            await upgrade(mongo, session)

    assert await mongo.status.find().to_list(None) == []
