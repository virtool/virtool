import asyncio

from pytest_mock import MockerFixture
from sqlalchemy.ext.asyncio import AsyncEngine
from syrupy import SnapshotAssertion

from virtool.blast.task import BLASTTask
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.mongo.core import Mongo
from virtool.utils import get_temp_dir


async def test_task(
    data_layer: DataLayer,
        fake: DataFaker,
    mocker: MockerFixture,
    mongo: Mongo,
    pg: AsyncEngine,
    snapshot: SnapshotAssertion,
    static_time,
):
    user = await fake.users.create()

    await asyncio.gather(
        mongo.samples.insert_one({"_id": "sample"}),
        mongo.references.insert_one(
            {"_id": "reference", "name": "Reference", "data_type": "genome"},
        ),
    )

    await mongo.analyses.insert_one(
        {
            "_id": "analysis",
            "created_at": static_time.datetime,
            "ready": True,
            "reference": {"id": "reference", "name": "Reference"},
            "results": {
                "hits": [
                    {
                        "index": 5,
                        "sequence": "ATAGAGAACTGTACTAGCTGATCGATCTGACGTAGCAC",
                        "orfs": [],
                    },
                ],
            },
            "sample": {"id": "sample"},
            "subtractions": [],
            "user": {"id": user.id},
            "workflow": "nuvs",
            "job": {"id": "1"},
            "index": {"id": "1", "version": "1"},
        },
    )

    html = """
    <!--QBlastInfoBegin
       RID = SYZDXEWK014  
       RTOE = 31  
    QBlastInfoEnd-->        
    """

    mocker.patch("virtool.blast.data.fetch_ncbi_blast_html", return_value=html)

    await data_layer.blast.create_nuvs_blast(analysis_id="analysis", sequence_index=5)

    times_called = 0

    async def check_rid(*_):
        nonlocal times_called
        times_called += 1
        return times_called < 4

    mocker.patch("virtool.blast.data.check_rid", check_rid)

    mocker.patch(
        "virtool.blast.data.fetch_nuvs_blast_result",
        return_value={
            "BlastOutput2": {
                "report": {
                    "program": "test",
                    "params": "test_params",
                    "version": "1",
                    "search_target": "ATAGAGAACTGTACTAGCTGATCGATCTGACGTAGCAC",
                    "results": {"search": {"hits": [], "stat": "test_stat"}},
                },
            },
        },
    )

    # Expect the task to have id 1 as it's the first task.
    task = BLASTTask(
        1,
        data_layer,
        {"analysis_id": "analysis", "sequence_index": 5},
        get_temp_dir(),
    )

    await task.run()

    assert await data_layer.tasks.get(1) == snapshot(name="task")
    assert await data_layer.blast.get_nuvs_blast("analysis", 5) == snapshot(
        name="blast",
    )
