"""
Add jobs ping field

Revision ID: 6q5k8tz8uph3
Date: 2022-10-07 20:14:53.735862

"""
from datetime import datetime

import arrow
from motor.motor_asyncio import (
    AsyncIOMotorClient,
    AsyncIOMotorClientSession,
    AsyncIOMotorDatabase,
)
from syrupy.matchers import path_type

# Revision identifiers.
name = "Add jobs ping field"
created_at = arrow.get("2022-10-07 20:14:53.735862")
revision_id = "6q5k8tz8uph3"
required_alembic_revision = None


async def upgrade(motor_db: AsyncIOMotorDatabase, session: AsyncIOMotorClientSession):
    await motor_db.jobs.update_many(
        {"ping": {"$exists": False}}, {"$set": {"ping": None}}, session=session
    )


async def test_upgrade(mongo: AsyncIOMotorClient, snapshot):
    await mongo.jobs.insert_many(
        [
            {"_id": "a", "ping": None},
            {"_id": "b"},
            {"_id": "c", "ping": {"pinged_at": arrow.utcnow().naive}},
            {"_id": "d"},
        ]
    )

    async with await mongo.client.start_session() as session:
        async with session.start_transaction():
            await upgrade(mongo, session)

    assert await mongo.jobs.find().to_list(None) == snapshot(
        matcher=path_type({".*pinged_at": (datetime,)}, regex=True)
    )
