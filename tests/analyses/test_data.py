from virtool_core.models.enums import QuickAnalyzeWorkflow

from tests.users.test_data import users_data


async def test_create(
    data_layer,
    fake2,
    mongo,
    snapshot,
    users_data,
):
    """
    Tests that an analysis is created with the expected fields.
    """
    subtractions = ["subtraction_1", "subtraction_2"]

    user = await fake2.users.create()

    async with mongo.create_session() as session:
        await mongo.samples.insert_one({"_id": "test_sample", "name": "Test Sample"})

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
                "name": "Test Reference",
                "data_type": "genome",
            }
        )

        await mongo.subtraction.insert_many(
            [
                {
                    "_id": "subtraction_1",
                    "name": "Subtraction 1",
                },
                {
                    "_id": "subtraction_2",
                    "name": "Subtraction 2",
                },
            ],
            session=session,
        )

    analysis = await data_layer.analyses.create(
        "test_sample",
        "test_ref",
        subtractions,
        user.id,
        QuickAnalyzeWorkflow.nuvs,
        0,
        analysis_id="test_analysis",
    )

    assert analysis == snapshot(name="obj")
    assert await mongo.analyses.find_one({"_id": analysis.id}) == snapshot(name="mongo")
