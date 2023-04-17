"""
Rename cache hash field to key

Revision ID: jhqn47cauoea
Date: 2022-06-09 22:12:49.222586

"""
import arrow
from motor.motor_asyncio import AsyncIOMotorDatabase

# Revision identifiers.
name = "Rename cache hash field to key"
created_at = arrow.get("2022-06-09 22:12:49.222586")
revision_id = "jhqn47cauoea"
required_alembic_revision = None


async def upgrade(motor_db: AsyncIOMotorDatabase, _):
    await motor_db.caches.update_many({}, {"$rename": {"hash": "key"}})


async def test_upgrade(mongo, snapshot):
    await mongo.caches.insert_many(
        [
            {
                "_id": "foo",
                "hash": "a97439e170adc4365c5b92bd2c148ed57d75e566",
                "sample": {"id": "abc"},
            },
            {
                "_id": "bar",
                "hash": "d7fh3ee170adc4365c5b92bd2c1f3fd5745te566",
                "sample": {"id": "dfg"},
            },
        ]
    )

    async with await mongo.client.start_session() as session:
        async with session.start_transaction():
            await upgrade(mongo, session)

    assert await mongo.caches.find().to_list(None) == snapshot
