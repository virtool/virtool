import asyncio

from pytest_mock import MockerFixture
from sqlalchemy.ext.asyncio import AsyncEngine
from syrupy import SnapshotAssertion

from tests.fixtures.analysis import seed_analysis
from virtool.blast.task import BLASTTask
from virtool.data.errors import ResourceNotFoundError
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
            {
                "_id": "reference",
                "archived": False,
                "data_type": "genome",
                "name": "Reference",
            },
        ),
    )

    results = {
        "hits": [
            {
                "index": 5,
                "sequence": "ATAGAGAACTGTACTAGCTGATCGATCTGACGTAGCAC",
                "orfs": [],
            },
        ],
    }

    analysis_id = await seed_analysis(
        mongo,
        pg,
        {
            "_id": "analysis",
            "created_at": static_time.datetime,
            "ready": True,
            "reference": {"id": "reference", "name": "Reference"},
            "results": results,
            "sample": {"id": "sample"},
            "subtractions": [],
            "user": {"id": user.id},
            "workflow": "nuvs",
            "job": {"id": "1"},
            "index": {"id": "1", "version": 1},
        },
    )

    html = """
    <!--QBlastInfoBegin
       RID = SYZDXEWK014  
       RTOE = 31  
    QBlastInfoEnd-->        
    """

    mocker.patch("virtool.blast.data.fetch_ncbi_blast_html", return_value=html)

    await data_layer.analyses.blast(analysis_id, 5)

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
        {"analysis_id": analysis_id, "sequence_index": 5},
        get_temp_dir(),
    )

    await task.run()

    assert await data_layer.tasks.get(1) == snapshot(name="task")
    assert await data_layer.blast.get_nuvs_blast(analysis_id, 5) == snapshot(
        name="blast",
    )


class TestWaitForBlastSearch:
    """Polling stops cleanly when the record it owns is gone or superseded."""

    async def test_superseded_record_exits_without_error(
        self,
        mocker: MockerFixture,
    ):
        """A re-BLAST can delete and recreate the row while an older task polls.

        ``check_nuvs_blast`` then raises ``ResourceNotFoundError`` (the new row has
        no RID yet, or was deleted). The task should leave the poll loop quietly
        without flagging an error, because nothing failed.
        """
        mocker.patch("virtool.blast.task.asyncio.sleep")

        data_layer = mocker.Mock()
        data_layer.blast.check_nuvs_blast = mocker.AsyncMock(
            side_effect=ResourceNotFoundError,
        )

        task = BLASTTask(
            1,
            data_layer,
            {"analysis_id": 7, "sequence_index": 5},
            get_temp_dir(),
        )
        task.rid = "RID_OLD"
        set_error = mocker.patch.object(task, "_set_error")

        await task.wait_for_blast_search()

        set_error.assert_not_called()
        assert task.errored is False

    async def test_replacement_rid_exits_without_error(
        self,
        mocker: MockerFixture,
    ):
        """If the replacement row already carries a different RID, the older task
        recognizes it does not own the search and stops without erroring.
        """
        mocker.patch("virtool.blast.task.asyncio.sleep")

        data_layer = mocker.Mock()
        data_layer.blast.check_nuvs_blast = mocker.AsyncMock(
            return_value=mocker.Mock(rid="RID_NEW", ready=False, error=None),
        )

        task = BLASTTask(
            1,
            data_layer,
            {"analysis_id": 7, "sequence_index": 5},
            get_temp_dir(),
        )
        task.rid = "RID_OLD"
        set_error = mocker.patch.object(task, "_set_error")

        await task.wait_for_blast_search()

        set_error.assert_not_called()
        assert task.errored is False
