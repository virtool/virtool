from zipfile import BadZipFile

import arrow
import pytest
from aiohttp import ClientSession
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.analyses.sql import SQLAnalysis
from virtool.blast.data import BLASTData
from virtool.blast.sql import SQLNuVsBlast
from virtool.blast.task import BLASTTask
from virtool.data.layer import DataLayer
from virtool.pg.utils import get_row_by_id
from virtool.tasks.data import TasksData
from virtool.tasks.sql import SQLTask
from virtool.users.pg import SQLUser

OLD_TIME = arrow.get("2015-01-01T00:00:00").naive


@pytest.fixture
async def blast_data(mocker, mongo, pg: AsyncEngine, static_time):
    blast_data = BLASTData(mocker.Mock(spec=ClientSession), mongo, pg)
    blast_data.bind_layer(mocker.Mock(spec=DataLayer))
    blast_data.data.tasks = mocker.Mock(spec=TasksData)

    await mongo.analyses.insert_one(
        {
            "_id": "analysis",
            "results": {"hits": [{"sequence_index": 12, "sequence": "ATAGAGACACC"}]},
        }
    )

    async with AsyncSession(pg) as session:
        task = SQLTask(created_at=static_time.datetime, type="blast")
        session.add(task)

        session.add(
            SQLUser(
                id=1,
                handle="leeashley",
                last_password_change=static_time.datetime,
                password=b"hashed",
                settings={},
            ),
        )
        await session.flush()

        session.add(
            SQLAnalysis(
                id="analysis",
                created_at=OLD_TIME,
                updated_at=OLD_TIME,
                workflow="nuvs",
                ready=False,
                results=None,
                sample="sample",
                reference="reference",
                index="index",
                subtractions=[],
                user_id=1,
            ),
        )

        session.add_all(
            [
                SQLNuVsBlast(
                    analysis_id="analysis",
                    sequence_index=21,
                    task_id=task.id,
                    created_at=static_time.datetime,
                    updated_at=static_time.datetime,
                    last_checked_at=static_time.datetime,
                    ready=False,
                ),
                SQLNuVsBlast(
                    analysis_id="analysis_2",
                    sequence_index=13,
                    task_id=task.id,
                    created_at=static_time.datetime,
                    updated_at=static_time.datetime,
                    last_checked_at=static_time.datetime,
                    ready=False,
                ),
                SQLNuVsBlast(
                    analysis_id="analysis_2",
                    sequence_index=4,
                    task_id=task.id,
                    created_at=static_time.datetime,
                    updated_at=static_time.datetime,
                    last_checked_at=static_time.datetime,
                    ready=False,
                ),
            ]
        )

        await session.commit()

    return blast_data


async def test_create_nuvs_blast(blast_data: BLASTData, pg, snapshot):
    await blast_data.create_nuvs_blast("analysis", 12)

    async with AsyncSession(pg) as session:
        result = await session.execute(select(SQLNuVsBlast))
        assert result.scalars().first() == snapshot

    blast_data.data.tasks.create.assert_called_with(
        BLASTTask, {"sequence_index": 12, "analysis_id": "analysis"}
    )


class TestCheckNuvsBlast:
    async def test_running(self, blast_data: BLASTData, mocker, pg, snapshot):
        """Check that the ``last_checked_at`` field is updated when the BLAST is still
        running on NCBI.
        """
        mocker.patch("virtool.blast.data.check_rid", return_value=False)

        await blast_data.create_nuvs_blast("analysis", 12)

        async with AsyncSession(pg) as session:
            await session.execute(
                update(SQLNuVsBlast)
                .where(SQLNuVsBlast.id == 4)
                .values(rid="RID_12345", last_checked_at=arrow.get(1367900664).naive)
            )
            await session.commit()

        assert await blast_data.get_nuvs_blast("analysis", 12) == snapshot(
            name="before"
        )

        await blast_data.check_nuvs_blast("analysis", 12)

        assert await blast_data.get_nuvs_blast("analysis", 12) == snapshot(name="after")

    async def test_result(self, blast_data: BLASTData, mocker, pg, snapshot):
        """Check that the following occur when the BLAST is complete on NCBI:

        1. The ``last_checked_at`` field is updated.
        2. The ``ready`` field is set to ``True``.
        3. The ``results`` field is set with the output of ``fetch_nuvs_blast_result``.

        """
        mocker.patch("virtool.blast.data.check_rid", return_value=True)

        mocker.patch(
            "virtool.blast.data.fetch_nuvs_blast_result",
            return_value={
                "BlastOutput2": {
                    "report": {
                        "params": [],
                        "program": "blast",
                        "results": {"search": {"hits": [], "stat": "stat"}},
                        "search_target": {"name": "foo", "sequence": "ATAGAQGAGATAGAG"},
                        "version": "1.2.3",
                    },
                }
            },
        )

        await blast_data.create_nuvs_blast("analysis", 12)

        async with AsyncSession(pg) as session:
            await session.execute(
                update(SQLNuVsBlast).where(SQLNuVsBlast.id == 4).values(rid="RID_12345")
            )
            await session.commit()

        await blast_data.check_nuvs_blast("analysis", 12)

        assert await blast_data.get_nuvs_blast("analysis", 12) == snapshot

    async def test_bad_zip_file(self, blast_data: BLASTData, mocker, pg, snapshot):
        """Test that the error field on the BLAST record is set when a BadZipFile error is
        encountered.

        """
        mocker.patch("virtool.blast.data.check_rid", return_value=True)
        mocker.patch(
            "virtool.blast.data.fetch_nuvs_blast_result", side_effect=BadZipFile()
        )

        await blast_data.create_nuvs_blast("analysis", 12)
        await blast_data.check_nuvs_blast("analysis", 12)

        assert await blast_data.get_nuvs_blast("analysis", 12) == snapshot


async def test_delete_nuvs_blast(blast_data: BLASTData, pg: AsyncEngine):
    assert await blast_data.delete_nuvs_blast("analysis", 21) == 1

    async with AsyncSession(pg) as session:
        result = await session.execute(select(SQLNuVsBlast))
        assert len(result.scalars().all()) == 2


async def test_list_by_analysis(blast_data: BLASTData, pg: AsyncEngine, snapshot):
    assert await blast_data.list_by_analysis("analysis_2") == snapshot


class TestAnalysisUpdatedAtBump:
    """Every BLAST mutation bumps the analysis ``updated_at`` in Postgres and Mongo."""

    async def test_create(
        self,
        blast_data: BLASTData,
        pg: AsyncEngine,
        static_time,
        mongo,
    ):
        await blast_data.create_nuvs_blast("analysis", 12)

        row = await get_row_by_id(pg, SQLAnalysis, "analysis")
        assert row.updated_at == static_time.datetime
        assert row.updated_at != OLD_TIME

        mongo_analysis = await mongo.analyses.find_one({"_id": "analysis"})
        assert mongo_analysis["updated_at"] == row.updated_at

    async def test_check(
        self,
        blast_data: BLASTData,
        pg: AsyncEngine,
        static_time,
        mongo,
        mocker,
    ):
        mocker.patch("virtool.blast.data.check_rid", return_value=False)

        await blast_data.create_nuvs_blast("analysis", 12)

        # Reset both backends to an old timestamp so the assertions prove that
        # ``check_nuvs_blast`` performed the bump, not ``create_nuvs_blast``.
        async with AsyncSession(pg) as session:
            await session.execute(
                update(SQLAnalysis)
                .where(SQLAnalysis.id == "analysis")
                .values(updated_at=OLD_TIME),
            )
            await session.commit()

        await mongo.analyses.update_one(
            {"_id": "analysis"}, {"$set": {"updated_at": OLD_TIME}}
        )

        await blast_data.check_nuvs_blast("analysis", 12)

        row = await get_row_by_id(pg, SQLAnalysis, "analysis")
        assert row.updated_at == static_time.datetime
        assert row.updated_at != OLD_TIME

        mongo_analysis = await mongo.analyses.find_one({"_id": "analysis"})
        assert mongo_analysis["updated_at"] == row.updated_at

    async def test_delete(
        self,
        blast_data: BLASTData,
        pg: AsyncEngine,
        static_time,
        mongo,
    ):
        await blast_data.delete_nuvs_blast("analysis", 21)

        row = await get_row_by_id(pg, SQLAnalysis, "analysis")
        assert row.updated_at == static_time.datetime
        assert row.updated_at != OLD_TIME

        mongo_analysis = await mongo.analyses.find_one({"_id": "analysis"})
        assert mongo_analysis["updated_at"] == row.updated_at
