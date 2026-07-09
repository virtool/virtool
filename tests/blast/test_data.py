from zipfile import BadZipFile

import arrow
import pytest
from aiohttp import ClientSession
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.analyses.sql import SQLAnalysis
from virtool.blast.data import BLASTData
from virtool.blast.sql import SQLNuVsBlast
from virtool.data.errors import ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.pg.utils import get_row
from virtool.tasks.data import TasksData
from virtool.tasks.sql import SQLTask
from virtool.users.pg import SQLUser

OLD_TIME = arrow.get("2015-01-01T00:00:00").naive


@pytest.fixture
async def analysis_ids(pg: AsyncEngine, static_time) -> dict[str, int]:
    """Seed two analyses and their NuVs BLAST records.

    Returns a mapping of each analysis's legacy slug to its integer ``analyses.id``,
    so tests can address the analyses by the integer foreign key the BLAST records
    now use.
    """
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

        nuvs = SQLAnalysis(
            legacy_id="analysis",
            created_at=OLD_TIME,
            updated_at=OLD_TIME,
            workflow="nuvs",
            ready=False,
            results=None,
            sample="sample",
            reference="reference",
            index="index",
            user_id=1,
        )
        other = SQLAnalysis(
            legacy_id="analysis_2",
            created_at=OLD_TIME,
            updated_at=OLD_TIME,
            workflow="nuvs",
            ready=False,
            results=None,
            sample="sample",
            reference="reference",
            index="index",
            user_id=1,
        )

        session.add_all([nuvs, other])
        await session.flush()

        ids = {"analysis": nuvs.id, "analysis_2": other.id}

        session.add_all(
            [
                SQLNuVsBlast(
                    analysis_id=nuvs.id,
                    sequence_index=21,
                    task_id=task.id,
                    created_at=static_time.datetime,
                    updated_at=static_time.datetime,
                    last_checked_at=static_time.datetime,
                    ready=False,
                ),
                SQLNuVsBlast(
                    analysis_id=other.id,
                    sequence_index=13,
                    task_id=task.id,
                    created_at=static_time.datetime,
                    updated_at=static_time.datetime,
                    last_checked_at=static_time.datetime,
                    ready=False,
                ),
                SQLNuVsBlast(
                    analysis_id=other.id,
                    sequence_index=4,
                    task_id=task.id,
                    created_at=static_time.datetime,
                    updated_at=static_time.datetime,
                    last_checked_at=static_time.datetime,
                    ready=False,
                ),
            ],
        )

        await session.commit()

    return ids


@pytest.fixture
async def blast_data(mocker, pg: AsyncEngine, analysis_ids) -> BLASTData:
    blast_data = BLASTData(mocker.Mock(spec=ClientSession), pg)
    blast_data.bind_layer(mocker.Mock(spec=DataLayer))
    blast_data.data.tasks = mocker.Mock(spec=TasksData)

    return blast_data


async def _insert_blast(
    pg: AsyncEngine,
    analysis_id: int,
    sequence_index: int,
    static_time,
    rid: str | None = None,
) -> None:
    """Insert a NuVs BLAST row directly.

    ``AnalysisData.blast`` creates rows with ``rid=None``; the ``BLASTTask`` fills
    the RID in once NCBI responds. Pass ``rid`` to simulate a row that has already
    reached NCBI.
    """
    async with AsyncSession(pg) as session:
        session.add(
            SQLNuVsBlast(
                analysis_id=analysis_id,
                sequence_index=sequence_index,
                created_at=static_time.datetime,
                updated_at=static_time.datetime,
                last_checked_at=static_time.datetime,
                ready=False,
                rid=rid,
            ),
        )
        await session.commit()


class TestCheckNuvsBlast:
    """Checking a NuVs BLAST syncs its state from NCBI into our records."""

    async def test_running(
        self,
        blast_data: BLASTData,
        analysis_ids: dict[str, int],
        mocker,
        pg,
        snapshot,
        static_time,
    ):
        """Check that the ``last_checked_at`` field is updated when the BLAST is still
        running on NCBI.
        """
        analysis_id = analysis_ids["analysis"]

        mocker.patch("virtool.blast.data.check_rid", return_value=False)

        await _insert_blast(pg, analysis_id, 12, static_time)

        async with AsyncSession(pg) as session:
            await session.execute(
                update(SQLNuVsBlast)
                .where(SQLNuVsBlast.id == 4)
                .values(rid="RID_12345", last_checked_at=arrow.get(1367900664).naive)
            )
            await session.commit()

        assert await blast_data.get_nuvs_blast(analysis_id, 12) == snapshot(
            name="before"
        )

        await blast_data.check_nuvs_blast(analysis_id, 12)

        assert await blast_data.get_nuvs_blast(analysis_id, 12) == snapshot(
            name="after"
        )

    async def test_result(
        self,
        blast_data: BLASTData,
        analysis_ids: dict[str, int],
        mocker,
        pg,
        snapshot,
        static_time,
    ):
        """Check that the following occur when the BLAST is complete on NCBI:

        1. The ``last_checked_at`` field is updated.
        2. The ``ready`` field is set to ``True``.
        3. The ``results`` field is set with the output of ``fetch_nuvs_blast_result``.

        """
        analysis_id = analysis_ids["analysis"]

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

        await _insert_blast(pg, analysis_id, 12, static_time)

        async with AsyncSession(pg) as session:
            await session.execute(
                update(SQLNuVsBlast).where(SQLNuVsBlast.id == 4).values(rid="RID_12345")
            )
            await session.commit()

        await blast_data.check_nuvs_blast(analysis_id, 12)

        assert await blast_data.get_nuvs_blast(analysis_id, 12) == snapshot

    async def test_missing_rid(
        self,
        blast_data: BLASTData,
        analysis_ids: dict[str, int],
        mocker,
        pg,
        static_time,
    ):
        """A row whose ``rid`` is still ``NULL`` has no NCBI search to check.

        This happens when a re-BLAST deletes and recreates the row while an older
        task is still polling. Treat it as a missing record so callers stop, rather
        than passing ``None`` to NCBI.
        """
        check_rid = mocker.patch("virtool.blast.data.check_rid")

        analysis_id = analysis_ids["analysis"]

        await _insert_blast(pg, analysis_id, 12, static_time)

        with pytest.raises(ResourceNotFoundError):
            await blast_data.check_nuvs_blast(analysis_id, 12)

        check_rid.assert_not_called()

    async def test_bad_zip_file(
        self,
        blast_data: BLASTData,
        analysis_ids: dict[str, int],
        mocker,
        pg,
        snapshot,
        static_time,
    ):
        """Test that the error field on the BLAST record is set when a BadZipFile error is
        encountered.

        """
        analysis_id = analysis_ids["analysis"]

        mocker.patch("virtool.blast.data.check_rid", return_value=True)
        mocker.patch(
            "virtool.blast.data.fetch_nuvs_blast_result", side_effect=BadZipFile()
        )

        await _insert_blast(pg, analysis_id, 12, static_time, rid="RID_12345")
        await blast_data.check_nuvs_blast(analysis_id, 12)

        assert await blast_data.get_nuvs_blast(analysis_id, 12) == snapshot


async def test_delete_nuvs_blast(
    blast_data: BLASTData,
    analysis_ids: dict[str, int],
    pg: AsyncEngine,
):
    assert await blast_data.delete_nuvs_blast(analysis_ids["analysis"], 21) == 1

    async with AsyncSession(pg) as session:
        result = await session.execute(select(SQLNuVsBlast))
        assert len(result.scalars().all()) == 2


class TestAnalysisUpdatedAtBump:
    """Every BLAST mutation bumps the analysis ``updated_at`` in Postgres."""

    async def test_check(
        self,
        blast_data: BLASTData,
        analysis_ids: dict[str, int],
        pg: AsyncEngine,
        static_time,
        mocker,
    ):
        mocker.patch("virtool.blast.data.check_rid", return_value=False)

        await _insert_blast(
            pg, analysis_ids["analysis"], 12, static_time, rid="RID_12345"
        )

        # Reset to an old timestamp so the assertions prove that ``check_nuvs_blast``
        # performed the bump, not the insert.
        async with AsyncSession(pg) as session:
            await session.execute(
                update(SQLAnalysis)
                .where(SQLAnalysis.legacy_id == "analysis")
                .values(updated_at=OLD_TIME),
            )
            await session.commit()

        await blast_data.check_nuvs_blast(analysis_ids["analysis"], 12)

        row = await get_row(pg, SQLAnalysis, ("legacy_id", "analysis"))
        assert row.updated_at == static_time.datetime
        assert row.updated_at != OLD_TIME

    async def test_delete(
        self,
        blast_data: BLASTData,
        analysis_ids: dict[str, int],
        pg: AsyncEngine,
        static_time,
    ):
        await blast_data.delete_nuvs_blast(analysis_ids["analysis"], 21)

        row = await get_row(pg, SQLAnalysis, ("legacy_id", "analysis"))
        assert row.updated_at == static_time.datetime
        assert row.updated_at != OLD_TIME
