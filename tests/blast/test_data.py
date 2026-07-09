from datetime import timedelta
from zipfile import BadZipFile

import arrow
import pytest
from aiohttp import ClientSession
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.analyses.sql import SQLAnalysis
from virtool.blast.data import TIMEOUT, BLASTData
from virtool.blast.sql import SQLNuVsBlast
from virtool.data.layer import DataLayer
from virtool.pg.utils import get_row
from virtool.tasks.data import TasksData
from virtool.tasks.sql import SQLTask
from virtool.users.pg import SQLUser

OLD_TIME = arrow.get("2015-01-01T00:00:00").naive

SEQUENCE = "ATAGAGAACTGTACTAGCTGATCGATCTGACGTAGCAC"


def _blast_html(rid: str) -> str:
    return f"""
    <!--QBlastInfoBegin
       RID = {rid}
       RTOE = 31
    QBlastInfoEnd-->
    """


BLAST_RESULT = {
    "BlastOutput2": {
        "report": {
            "params": [],
            "program": "blast",
            "results": {"search": {"hits": [], "stat": "stat"}},
            "search_target": {"name": "foo", "sequence": SEQUENCE},
            "version": "1.2.3",
        },
    },
}


@pytest.fixture
async def analysis_ids(pg: AsyncEngine, static_time) -> dict[str, int]:
    """Seed two analyses and their NuVs BLAST records.

    Returns a mapping of each analysis's legacy slug to its integer ``analyses.id``,
    so tests can address the analyses by the integer foreign key the BLAST records
    now use.

    The seeded BLAST records were checked at ``static_time``, so the sweeper never
    considers them due. Tests that want a row swept must insert their own.
    """
    async with AsyncSession(pg) as session:
        task = SQLTask(created_at=static_time.datetime, type="sweep_blast")
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

    analysis = mocker.Mock()
    analysis.dict.return_value = {
        "results": {"hits": [{"index": 12, "sequence": SEQUENCE, "orfs": []}]},
    }

    blast_data.data.analyses = mocker.Mock()
    blast_data.data.analyses.get = mocker.AsyncMock(return_value=analysis)

    return blast_data


async def _insert_blast(
    pg: AsyncEngine,
    analysis_id: int,
    sequence_index: int,
    static_time,
    rid: str | None = None,
    *,
    age: timedelta = timedelta(0),
    due: bool = True,
    ready: bool = False,
    error: str | None = None,
) -> int:
    """Insert a NuVs BLAST row directly and return its ID.

    ``AnalysisData.blast`` creates rows with ``rid=None``; the sweeper fills the RID
    in once NCBI responds. Pass ``rid`` to simulate a row that has already reached
    NCBI.

    ``age`` backdates ``created_at`` so a row can be pushed past the sweeper's
    timeout. ``due`` backdates ``last_checked_at`` past the row's interval so the
    sweeper picks the row up; pass ``due=False`` to leave it freshly checked.
    """
    now = static_time.datetime

    async with AsyncSession(pg) as session:
        row = SQLNuVsBlast(
            analysis_id=analysis_id,
            sequence_index=sequence_index,
            created_at=now - age,
            updated_at=now,
            last_checked_at=now - timedelta(minutes=1) if due else now,
            ready=ready,
            error=error,
            rid=rid,
        )

        session.add(row)
        await session.flush()

        row_id = row.id

        await session.commit()

    return row_id


async def _get_blast(pg: AsyncEngine, row_id: int) -> SQLNuVsBlast | None:
    async with AsyncSession(pg) as session:
        return await session.get(SQLNuVsBlast, row_id)


async def _select_sweepable(pg: AsyncEngine, row_id: int) -> list:
    """Select a row the way the sweeper does, so it can be handed back to it."""
    async with AsyncSession(pg) as session:
        return (
            await session.execute(
                select(
                    SQLNuVsBlast.id,
                    SQLNuVsBlast.analysis_id,
                    SQLNuVsBlast.sequence_index,
                    SQLNuVsBlast.rid,
                ).where(SQLNuVsBlast.id == row_id),
            )
        ).all()


class TestSweepInitialize:
    """A row with no RID is submitted to NCBI and stores the RID it gets back."""

    async def test_stores_rid(
        self,
        blast_data: BLASTData,
        analysis_ids: dict[str, int],
        mocker,
        pg,
        static_time,
    ):
        mocker.patch(
            "virtool.blast.data.fetch_ncbi_blast_html",
            return_value=_blast_html("RID_NEW"),
        )

        row_id = await _insert_blast(pg, analysis_ids["analysis"], 12, static_time)

        await blast_data.sweep()

        row = await _get_blast(pg, row_id)

        assert row.rid == "RID_NEW"
        assert row.last_checked_at == static_time.datetime

    async def test_discards_rid_for_superseded_row(
        self,
        blast_data: BLASTData,
        analysis_ids: dict[str, int],
        mocker,
        pg,
        static_time,
    ):
        """A re-BLAST can replace the row while we are submitting to NCBI.

        The replacement row is addressed by the same primary key only if it survived;
        here it has already gained its own RID. The RID we just obtained must not
        overwrite it.
        """
        row_id = await _insert_blast(pg, analysis_ids["analysis"], 12, static_time)

        async def fetch_ncbi_blast_html(*_):
            async with AsyncSession(pg) as session:
                await session.execute(
                    update(SQLNuVsBlast)
                    .where(SQLNuVsBlast.id == row_id)
                    .values(rid="RID_REPLACEMENT"),
                )
                await session.commit()

            return _blast_html("RID_STALE")

        mocker.patch(
            "virtool.blast.data.fetch_ncbi_blast_html",
            fetch_ncbi_blast_html,
        )

        await blast_data.sweep()

        row = await _get_blast(pg, row_id)

        assert row.rid == "RID_REPLACEMENT"


class TestSweepCheck:
    """A row with a RID is checked against NCBI and advanced."""

    async def test_running(
        self,
        blast_data: BLASTData,
        analysis_ids: dict[str, int],
        mocker,
        pg,
        static_time,
    ):
        """A search still running on NCBI is rechecked later, on a longer interval."""
        mocker.patch("virtool.blast.data.check_rid", return_value=False)

        row_id = await _insert_blast(
            pg, analysis_ids["analysis"], 12, static_time, rid="RID_12345"
        )

        await blast_data.sweep()

        row = await _get_blast(pg, row_id)

        assert row.ready is False
        assert row.result is None
        assert row.interval == 8
        assert row.last_checked_at == static_time.datetime

    async def test_interval_is_capped(
        self,
        blast_data: BLASTData,
        analysis_ids: dict[str, int],
        mocker,
        pg,
        static_time,
    ):
        mocker.patch("virtool.blast.data.check_rid", return_value=False)

        row_id = await _insert_blast(
            pg, analysis_ids["analysis"], 12, static_time, rid="RID_12345"
        )

        async with AsyncSession(pg) as session:
            await session.execute(
                update(SQLNuVsBlast)
                .where(SQLNuVsBlast.id == row_id)
                .values(interval=75),
            )
            await session.commit()

        await blast_data.sweep()

        row = await _get_blast(pg, row_id)

        assert row.interval == 75

    async def test_result(
        self,
        blast_data: BLASTData,
        analysis_ids: dict[str, int],
        mocker,
        pg,
        snapshot,
        static_time,
    ):
        """A finished search stores its formatted result and is marked ready."""
        mocker.patch("virtool.blast.data.check_rid", return_value=True)
        mocker.patch(
            "virtool.blast.data.fetch_nuvs_blast_result",
            return_value=BLAST_RESULT,
        )

        await _insert_blast(
            pg, analysis_ids["analysis"], 12, static_time, rid="RID_12345"
        )

        await blast_data.sweep()

        assert await blast_data.get_nuvs_blast(analysis_ids["analysis"], 12) == snapshot

    async def test_bad_zip_file(
        self,
        blast_data: BLASTData,
        analysis_ids: dict[str, int],
        mocker,
        pg,
        snapshot,
        static_time,
    ):
        """An unreadable NCBI result sets the error field rather than a result."""
        mocker.patch("virtool.blast.data.check_rid", return_value=True)
        mocker.patch(
            "virtool.blast.data.fetch_nuvs_blast_result", side_effect=BadZipFile()
        )

        await _insert_blast(
            pg, analysis_ids["analysis"], 12, static_time, rid="RID_12345"
        )

        await blast_data.sweep()

        assert await blast_data.get_nuvs_blast(analysis_ids["analysis"], 12) == snapshot

    async def test_discards_result_for_superseded_rid(
        self,
        blast_data: BLASTData,
        analysis_ids: dict[str, int],
        mocker,
        pg,
        static_time,
    ):
        """A re-BLAST can swap the row's RID while we are fetching from NCBI.

        The result belongs to the RID we started with, so it must not be written onto
        the row now carrying a newer RID.
        """
        row_id = await _insert_blast(
            pg, analysis_ids["analysis"], 12, static_time, rid="RID_OLD"
        )

        async def check_rid(*_):
            async with AsyncSession(pg) as session:
                await session.execute(
                    update(SQLNuVsBlast)
                    .where(SQLNuVsBlast.id == row_id)
                    .values(rid="RID_NEW"),
                )
                await session.commit()

            return True

        mocker.patch("virtool.blast.data.check_rid", check_rid)
        mocker.patch(
            "virtool.blast.data.fetch_nuvs_blast_result",
            return_value=BLAST_RESULT,
        )

        await blast_data.sweep()

        row = await _get_blast(pg, row_id)

        assert row.rid == "RID_NEW"
        assert row.ready is False
        assert row.result is None


class TestSweepSelection:
    """The sweeper only advances rows that are outstanding and due."""

    async def test_skips_row_that_is_not_due(
        self,
        blast_data: BLASTData,
        analysis_ids: dict[str, int],
        mocker,
        pg,
        static_time,
    ):
        check_rid = mocker.patch("virtool.blast.data.check_rid")

        await _insert_blast(
            pg,
            analysis_ids["analysis"],
            12,
            static_time,
            rid="RID_12345",
            due=False,
        )

        await blast_data.sweep()

        check_rid.assert_not_called()

    async def test_skips_ready_row(
        self,
        blast_data: BLASTData,
        analysis_ids: dict[str, int],
        mocker,
        pg,
        static_time,
    ):
        check_rid = mocker.patch("virtool.blast.data.check_rid")

        await _insert_blast(
            pg,
            analysis_ids["analysis"],
            12,
            static_time,
            rid="RID_12345",
            ready=True,
        )

        await blast_data.sweep()

        check_rid.assert_not_called()

    async def test_skips_errored_row(
        self,
        blast_data: BLASTData,
        analysis_ids: dict[str, int],
        mocker,
        pg,
        static_time,
    ):
        check_rid = mocker.patch("virtool.blast.data.check_rid")

        await _insert_blast(
            pg,
            analysis_ids["analysis"],
            12,
            static_time,
            rid="RID_12345",
            error="Unable to interpret NCBI result",
        )

        await blast_data.sweep()

        check_rid.assert_not_called()

    async def test_deletes_expired_row(
        self,
        blast_data: BLASTData,
        analysis_ids: dict[str, int],
        mocker,
        pg,
        static_time,
    ):
        """A search that has outlived the timeout is abandoned, not checked."""
        check_rid = mocker.patch("virtool.blast.data.check_rid")

        row_id = await _insert_blast(
            pg,
            analysis_ids["analysis"],
            12,
            static_time,
            rid="RID_12345",
            age=TIMEOUT + timedelta(seconds=1),
        )

        await blast_data.sweep()

        assert await _get_blast(pg, row_id) is None
        check_rid.assert_not_called()

    async def test_expired_delete_spares_a_replacement_row(
        self,
        blast_data: BLASTData,
        analysis_ids: dict[str, int],
        pg,
        static_time,
    ):
        """Abandoning an expired search must not delete the search that replaced it.

        A re-BLAST deletes and recreates the row for a sequence. Here the sweeper has
        already selected the expired row when the re-BLAST lands. Deleting by analysis
        and sequence index would destroy the user's fresh search; deleting by primary
        key leaves it alone.
        """
        analysis_id = analysis_ids["analysis"]

        expired_id = await _insert_blast(
            pg,
            analysis_id,
            12,
            static_time,
            rid="RID_EXPIRED",
            age=TIMEOUT + timedelta(seconds=1),
        )

        expired_rows = await _select_sweepable(pg, expired_id)

        # The re-BLAST replaces the row the sweeper is holding.
        async with AsyncSession(pg) as session:
            await session.execute(
                delete(SQLNuVsBlast).where(SQLNuVsBlast.id == expired_id),
            )
            await session.commit()

        replacement_id = await _insert_blast(
            pg, analysis_id, 12, static_time, rid="RID_REPLACEMENT"
        )

        await blast_data._delete_expired(expired_rows, static_time.datetime)  # noqa: SLF001

        replacement = await _get_blast(pg, replacement_id)

        assert replacement is not None
        assert replacement.rid == "RID_REPLACEMENT"

    async def test_one_failure_does_not_stop_the_sweep(
        self,
        blast_data: BLASTData,
        analysis_ids: dict[str, int],
        mocker,
        pg,
        static_time,
    ):
        """A row that raises against NCBI does not prevent others advancing."""
        failing_id = await _insert_blast(
            pg, analysis_ids["analysis"], 12, static_time, rid="RID_FAILS"
        )
        succeeding_id = await _insert_blast(
            pg, analysis_ids["analysis_2"], 12, static_time, rid="RID_WORKS"
        )

        async def check_rid(_, rid):
            if rid == "RID_FAILS":
                raise OSError("NCBI is unreachable")

            return False

        mocker.patch("virtool.blast.data.check_rid", check_rid)

        await blast_data.sweep()

        succeeding = await _get_blast(pg, succeeding_id)

        assert await _get_blast(pg, failing_id) is not None
        assert succeeding.interval == 8


class TestSweepBackOff:
    """A row whose advance fails against NCBI is backed off, not retried at once."""

    async def test_check_failure_backs_off(
        self,
        blast_data: BLASTData,
        analysis_ids: dict[str, int],
        mocker,
        pg,
        static_time,
    ):
        """A failed status check bumps the interval and ``last_checked_at``.

        Without the backoff the untouched row would be due again on the next sweep,
        hammering NCBI during an outage.
        """
        mocker.patch(
            "virtool.blast.data.check_rid",
            side_effect=OSError("NCBI is unreachable"),
        )

        row_id = await _insert_blast(
            pg, analysis_ids["analysis"], 12, static_time, rid="RID_FAILS"
        )

        await blast_data.sweep()

        row = await _get_blast(pg, row_id)

        assert row.interval == 8
        assert row.last_checked_at == static_time.datetime

    async def test_initialize_failure_backs_off(
        self,
        blast_data: BLASTData,
        analysis_ids: dict[str, int],
        mocker,
        pg,
        static_time,
    ):
        """A failed submission bumps the interval and ``last_checked_at``."""
        mocker.patch(
            "virtool.blast.data.fetch_ncbi_blast_html",
            side_effect=OSError("NCBI is unreachable"),
        )

        row_id = await _insert_blast(pg, analysis_ids["analysis"], 12, static_time)

        await blast_data.sweep()

        row = await _get_blast(pg, row_id)

        assert row.rid is None
        assert row.interval == 8
        assert row.last_checked_at == static_time.datetime


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

        # Reset to an old timestamp so the assertions prove that the sweep performed
        # the bump, not the insert.
        async with AsyncSession(pg) as session:
            await session.execute(
                update(SQLAnalysis)
                .where(SQLAnalysis.legacy_id == "analysis")
                .values(updated_at=OLD_TIME),
            )
            await session.commit()

        await blast_data.sweep()

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
