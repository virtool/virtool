import asyncio
from pathlib import Path

from virtool_core.models.enums import AnalysisWorkflow

from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker, fake_file_chunker
from virtool.api.client import UserClient
from virtool.mongo.core import Mongo
from virtool.analyses.models import SQLAnalysisFile
from virtool.pg.utils import get_row_by_id
import pytest

from syrupy import SnapshotAssertion
from syrupy.filters import props

from virtool.samples.oas import CreateAnalysisRequest


@pytest.fixture
async def setup_sample(mongo: "Mongo", fake2: DataFaker) -> str:
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
    return user.id


@pytest.mark.parametrize("number_of_analyses", [0, 1, 2])
async def test_find(
    number_of_analyses: int,
    data_layer: DataLayer,
    snapshot_recent: SnapshotAssertion,
    mongo: Mongo,
    setup_sample: str,
    mocker,
):
    """
    Tests that all analysis are listed.
    """
    mocker.patch("virtool.samples.utils.get_sample_rights", return_value=(True, True))
    client = mocker.Mock(spec=UserClient)
    user_id = setup_sample

    await mongo.samples.insert_one({"_id": "test_false", "name": "Test False"})

    analysis_wrong_sample = await data_layer.analyses.create(
        CreateAnalysisRequest(
            ml=None,
            ref_id="test_ref",
            subtractions=["subtraction_1", "subtraction_2"],
            workflow=AnalysisWorkflow.nuvs,
        ),
        "test_false",
        user_id,
        0,
    )

    for _ in range(number_of_analyses):
        await data_layer.analyses.create(
            CreateAnalysisRequest(
                ml=None,
                ref_id="test_ref",
                subtractions=["subtraction_1", "subtraction_2"],
                workflow=AnalysisWorkflow.nuvs,
            ),
            "test_sample",
            user_id,
            0,
        )

    analyses_found = await data_layer.analyses.find(1, 25, client, "test_sample")

    assert analyses_found.dict() == snapshot_recent()
    assert analysis_wrong_sample not in analyses_found
    assert analyses_found.total_count == analyses_found.found_count


async def test_create(
    data_layer: DataLayer, mongo: Mongo, snapshot: SnapshotAssertion, setup_sample: str
):
    """
    Tests that an analysis is created given an analysis id with the expected fields.
    """
    user_id: str = setup_sample

    analysis = await data_layer.analyses.create(
        CreateAnalysisRequest(
            ml=None,
            ref_id="test_ref",
            subtractions=["subtraction_1", "subtraction_2"],
            workflow=AnalysisWorkflow.nuvs,
        ),
        "test_sample",
        user_id,
        0,
    )

    assert analysis == snapshot(name="obj", exclude=props("created_at", "updated_at"))

    assert await mongo.analyses.find_one({"_id": analysis.id}) == snapshot(
        name="mongo", exclude=props("created_at", "updated_at")
    )


async def test_create_analysis_id(
    data_layer: DataLayer, mongo: Mongo, snapshot: SnapshotAssertion, setup_sample: str
):
    """
    Tests that an analysis is created with the expected fields.
    """
    user_id = setup_sample

    analysis = await data_layer.analyses.create(
        CreateAnalysisRequest(
            ml=None,
            ref_id="test_ref",
            subtractions=["subtraction_1", "subtraction_2"],
            workflow=AnalysisWorkflow.nuvs,
        ),
        "test_sample",
        user_id,
        0,
    )

    assert analysis == snapshot(name="obj", exclude=props("created_at", "updated_at"))

    assert await mongo.analyses.find_one({"_id": analysis.id}) == snapshot(
        name="mongo", exclude=props("created_at", "updated_at")
    )


async def test_upload_file(
    data_layer: DataLayer,
    example_path: Path,
    setup_sample: str,
    snapshot_recent: SnapshotAssertion,
    spawn_job_client,
    tmp_path,
):
    """
    Test that an analysis result file is properly uploaded and a row is inserted into
    the `analysis_files` SQL table.
    """
    user_id = setup_sample

    analysis = await data_layer.analyses.create(
        CreateAnalysisRequest(
            ml=None,
            ref_id="test_ref",
            subtractions=["subtraction_1", "subtraction_2"],
            workflow=AnalysisWorkflow.nuvs,
        ),
        "test_sample",
        user_id,
        0,
    )

    chunks = fake_file_chunker(example_path / "reads/single.fq.gz")

    analysis_file = await data_layer.analyses.upload_file(
        chunks, analysis.id, "fasta", "test"
    )

    assert analysis_file == snapshot_recent()
    assert await get_row_by_id(data_layer.analyses._pg, SQLAnalysisFile, 1)
