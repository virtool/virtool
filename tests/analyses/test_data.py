from virtool_core.models.enums import QuickAnalyzeWorkflow

from virtool.data.utils import get_data_from_app
from tests.users.test_data import users_data


async def test_create(app, mongo, snapshot, static_time, users_data):
    """
    Tests that an analysis is created with the expected fields.
    """
    subtractions = ["subtraction_1", "subtraction_2"]

    await users_data.create(password="hello_world", handle="bill")
    user_info = await mongo.users.find_one({"handle": "bill"})

    async with mongo.create_session() as session:
        await mongo.indexes.insert_one(
            {
                "_id": "test_index",
                "version": 11,
                "ready": True,
                "reference": {"id": "test_ref"},
            }
        )

        await mongo.references.insert_one(
            {
                "_id": "test_ref",
                "name": "ref_name",
                "data_type": "genome",
            }
        )

        await mongo.subtraction.insert_many(
            [
                {
                    "_id": "subtraction_1",
                    "name": "s1",
                },
                {
                    "_id": "subtraction_2",
                    "name": "s2",
                },
            ],
            session=session,
        )

    await get_data_from_app(app).analyses.create(
        "test_sample",
        "test_ref",
        subtractions,
        user_info["_id"],
        QuickAnalyzeWorkflow.nuvs,
        "test_job",
        0,
        analysis_id="test_analysis",
    )

    assert await mongo.analyses.find_one({"_id": "test_analysis"}) == snapshot
