import asyncio

from syrupy.filters import props
from virtool_core.models.enums import QuickAnalyzeWorkflow

from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.mongo.core import Mongo


async def test_create(
    data_layer: DataLayer,
    fake2: DataFaker,
    mongo: Mongo,
    snapshot,
):
    """
    Tests that an analysis is created with the expected fields.
    """
    user = await fake2.users.create()

    await asyncio.gather(
        mongo.samples.insert_one({"_id": "test_sample", "name": "Test Sample"}),
        mongo.indexes.insert_one(
            {
                "_id": "test_index",
                "version": 11,
                "ready": True,
                "reference": {"id": "test_ref"},
            }
        ),
        mongo.references.insert_one(
            {
                "_id": "test_ref",
                "name": "Test Reference",
                "data_type": "genome",
            }
        ),
        mongo.subtraction.insert_many(
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
            session=None,
        ),
    )

    analysis = await data_layer.analyses.create(
        "test_sample",
        "test_ref",
        ["subtraction_1", "subtraction_2"],
        user.id,
        QuickAnalyzeWorkflow.nuvs,
        0,
        analysis_id="test_analysis",
    )

    assert analysis == snapshot(name="obj", exclude=props("created_at", "updated_at"))

    assert await mongo.analyses.find_one({"_id": analysis.id}) == snapshot(
        name="mongo", exclude=props("created_at", "updated_at")
    )


async def test_create_analysis_id(
    data_layer: DataLayer,
    fake2: DataFaker,
    mongo: Mongo,
    snapshot,
):
    """
    Tests that an analysis is created with the expected fields.
    """
    user = await fake2.users.create()

    await asyncio.gather(
        mongo.samples.insert_one({"_id": "test_sample", "name": "Test Sample"}),
        mongo.indexes.insert_one(
            {
                "_id": "test_index",
                "version": 11,
                "ready": True,
                "reference": {"id": "test_ref"},
            }
        ),
        mongo.references.insert_one(
            {
                "_id": "test_ref",
                "name": "Test Reference",
                "data_type": "genome",
            }
        ),
        mongo.subtraction.insert_many(
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
            session=None,
        ),
    )

    analysis = await data_layer.analyses.create(
        "test_sample",
        "test_ref",
        ["subtraction_1", "subtraction_2"],
        user.id,
        QuickAnalyzeWorkflow.nuvs,
        0,
    )

    assert analysis == snapshot(name="obj", exclude=props("created_at", "updated_at"))

    assert await mongo.analyses.find_one({"_id": analysis.id}) == snapshot(
        name="mongo", exclude=props("created_at", "updated_at")
    )
