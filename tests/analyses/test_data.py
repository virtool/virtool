import asyncio
import os

from virtool_core.models.enums import QuickAnalyzeWorkflow

from tests.analyses.test_api import create_files
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.mongo.core import Mongo
from virtool.analyses.models import SQLAnalysisFile
from virtool.config import get_config_from_app
from virtool.pg.utils import get_row_by_id

import pytest

from syrupy import snapshot, SnapshotAssertion
from syrupy.filters import props


async def test_find(data_layer: DataLayer, mongo: Mongo, snapshot: SnapshotAssertion):
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


@pytest.mark.apitest
async def test_upload_file(
    create_files, spawn_job_client, tmp_path, data_layer: DataLayer, snapshot
):
    """
    Test that an analysis result file is properly uploaded and a row is inserted into the `analysis_files` SQL table.

    """
    client = await spawn_job_client(authorize=True)
    get_config_from_app(client.app).data_path = tmp_path
    format_ = "fasta"
    await client.db.analyses.insert_one(
        {"_id": "foobar", "ready": True, "job": {"id": "hello"}}
    )
    resp = await client.put(
        f"/analyses/foobar/files?name=reference.fa&format={format_}",
        data=create_files(),
    )
    assert resp.status == 201
    assert await resp.json() == snapshot(exclude=props("uploaded_at"))
    assert os.listdir(tmp_path / "analyses") == ["1-reference.fa"]
    assert await get_row_by_id(data_layer.analyses._pg, SQLAnalysisFile, 1)
