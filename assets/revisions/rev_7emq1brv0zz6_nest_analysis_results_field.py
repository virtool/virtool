"""
Nest analysis results field

Revision ID: 7emq1brv0zz6
Date: 2022-06-09 20:38:11.017655

"""
import arrow
from motor.motor_asyncio import AsyncIOMotorClientSession, AsyncIOMotorDatabase

# Revision identifiers.
from pymongo import UpdateOne
from virtool_core.mongo import buffered_bulk_writer

name = "Nest analysis results field"
created_at = arrow.get("2022-06-09 20:38:11.017655")
revision_id = "7emq1brv0zz6"
required_alembic_revision = None


async def upgrade(motor_db: AsyncIOMotorDatabase, session: AsyncIOMotorClientSession):
    """
    Move the ``subtracted_count`` and ``read_count`` fields from the document to the
    ``results`` subdocument.

    This supports the new jobs API model where only a ``results`` field can be set on
    the analysis document by a workflow job.

    """
    async with buffered_bulk_writer(motor_db.analyses) as writer:
        async for document in motor_db.analyses.find(
            {
                "results": {"$ne": None, "$exists": True},
                "results.hits": {"$exists": False},
            },
        ):
            _id = document["_id"]

            results = {
                "hits": document["results"],
            }

            if document["workflow"] == "pathoscope_bowtie":
                await writer.add(
                    UpdateOne(
                        {"_id": _id},
                        {
                            "$set": {
                                "results": {
                                    **results,
                                    "read_count": document["read_count"],
                                    "subtracted_count": document["subtracted_count"],
                                }
                            },
                            "$unset": {"read_count": "", "subtracted_count": ""},
                        },
                    )
                )

            elif document["workflow"] == "nuvs":
                await writer.add(
                    UpdateOne({"_id": _id}, {"$set": {"results": results}})
                )

            elif document["workflow"] == "aodp":
                await writer.add(
                    UpdateOne(
                        {"_id": _id},
                        {
                            "$set": {
                                "results": {
                                    **results,
                                    "join_histogram": document["join_histogram"],
                                    "joined_pair_count": document["joined_pair_count"],
                                    "remainder_pair_count": document[
                                        "remainder_pair_count"
                                    ],
                                }
                            },
                            "$unset": {
                                "join_histogram": "",
                                "joined_pair_count": "",
                                "remainder_pair_count": "",
                            },
                        },
                    )
                )


async def test_upgrade(mongo, snapshot):
    await mongo.analyses.insert_many(
        [
            {
                "_id": "foo",
                "read_count": 1209,
                "results": [1, 2, 3, 4, 5],
                "subtracted_count": 231,
                "workflow": "pathoscope_bowtie",
            },
            {
                "_id": "fine",
                "results": {
                    "hits": [1, 2, 3, 4, 5],
                    "read_count": 1209,
                    "subtracted_count": 231,
                },
                "workflow": "pathoscope_bowtie",
            },
            {
                "_id": "bar",
                "read_count": 7982,
                "results": [9, 8, 7, 6, 5],
                "subtracted_count": 112,
                "workflow": "pathoscope_bowtie",
            },
            {
                "_id": "baz",
                "results": [9, 8, 7, 6, 5],
                "workflow": "nuvs",
            },
            {
                "_id": "bad",
                "join_histogram": [1, 2, 3, 4, 5],
                "joined_pair_count": 12345,
                "remainder_pair_count": 54321,
                "results": [9, 8, 7, 6, 5],
                "workflow": "aodp",
            },
            {
                "_id": "missing",
                "join_histogram": [1, 2, 3, 4, 5],
                "joined_pair_count": 12345,
                "remainder_pair_count": 54321,
                "workflow": "aodp",
            },
            {
                "_id": "none",
                "join_histogram": [1, 2, 3, 4, 5],
                "joined_pair_count": 12345,
                "remainder_pair_count": 54321,
                "results": None,
                "workflow": "aodp",
            },
        ]
    )

    async with await mongo.client.start_session() as session:
        async with session.start_transaction():
            await upgrade(mongo, session)

    assert await mongo.analyses.find().to_list(None) == snapshot
