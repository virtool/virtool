import asyncio
from pathlib import Path
from unittest.mock import ANY

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion
from syrupy.filters import props

from tests.fixtures.analysis import seed_analysis
from virtool.analyses.sql import (
    SQLAnalysis,
    SQLAnalysisFile,
    SQLAnalysisSubtraction,
)
from virtool.api.client import UserClient
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker, fake_file_chunker
from virtool.models.enums import AnalysisWorkflow
from virtool.mongo.core import Mongo
from virtool.pg.utils import get_row, get_row_by_id
from virtool.samples.oas import CreateAnalysisRequest
from virtool.samples.sql import SQLLegacySample
from virtool.subtractions.pg import SQLSubtraction
from virtool.utils import timestamp


@pytest.fixture
async def subtraction_ids(fake: DataFaker) -> dict[str, int]:
    """Seed two subtractions and return their ``{name slug: integer id}`` map."""
    user = await fake.users.create()
    upload = await fake.uploads.create(user=user)
    first = await fake.subtractions.create(
        user=user,
        upload=upload,
        name="Subtraction 1",
        upload_files=False,
        finalized=False,
    )
    second = await fake.subtractions.create(
        user=user,
        upload=upload,
        name="Subtraction 2",
        upload_files=False,
        finalized=False,
    )
    return {"subtraction_1": first.id, "subtraction_2": second.id}


@pytest.fixture
async def setup_sample(
    mongo: "Mongo",
    pg: AsyncEngine,
    fake: DataFaker,
    subtraction_ids: dict[str, int],
) -> str:
    user = await fake.users.create()

    async with AsyncSession(pg) as session:
        session.add(
            SQLLegacySample(
                legacy_id="test_sample",
                name="Test Sample",
                library_type="normal",
                created_at=timestamp(),
                user_id=user.id,
                all_read=True,
                all_write=True,
            ),
        )
        await session.commit()

    await asyncio.gather(
        mongo.samples.insert_one(
            {
                "_id": "test_sample",
                "all_read": True,
                "all_write": True,
                "created_at": timestamp(),
                "files": [],
                "format": "fastq",
                "group": "none",
                "group_read": True,
                "group_write": True,
                "hold": False,
                "host": "",
                "is_legacy": False,
                "isolate": "",
                "job": None,
                "labels": [],
                "library_type": "normal",
                "locale": "",
                "name": "Test Sample",
                "notes": "",
                "nuvs": False,
                "pathoscope": True,
                "ready": True,
                "subtractions": [],
                "user": {"id": user.id},
                "workflows": {
                    "aodp": "incompatible",
                    "pathoscope": "complete",
                    "nuvs": "pending",
                },
            },
        ),
        mongo.indexes.insert_one(
            {
                "_id": "test_index",
                "version": 11,
                "ready": True,
                "reference": {"id": "test_ref"},
            },
        ),
        mongo.references.insert_one(
            {
                "_id": "test_ref",
                "archived": False,
                "data_type": "genome",
                "name": "Test Reference",
            },
        ),
    )
    return user.id


@pytest.mark.parametrize("number_of_analyses", [0, 1, 2])
async def test_find(
    number_of_analyses: int,
    data_layer: DataLayer,
    snapshot_recent: SnapshotAssertion,
    mongo: Mongo,
    pg: AsyncEngine,
    setup_sample: str,
    subtraction_ids: dict[str, int],
    mocker,
):
    """Tests that all analysis are listed."""
    mocker.patch("virtool.samples.utils.get_sample_rights", return_value=(True, True))
    client = mocker.Mock(spec=UserClient)
    user_id = setup_sample

    await mongo.samples.insert_one({"_id": "test_false", "name": "Test False"})

    async with AsyncSession(pg) as session:
        session.add(
            SQLLegacySample(
                legacy_id="test_false",
                name="Test False",
                library_type="normal",
                created_at=timestamp(),
                user_id=user_id,
            ),
        )
        await session.commit()

    analysis_wrong_sample = await data_layer.analyses.create(
        CreateAnalysisRequest(
            ref_id="test_ref",
            subtractions=[
                subtraction_ids["subtraction_1"],
                subtraction_ids["subtraction_2"],
            ],
            workflow=AnalysisWorkflow.nuvs,
        ),
        "test_false",
        user_id,
        0,
    )

    for _ in range(number_of_analyses):
        await data_layer.analyses.create(
            CreateAnalysisRequest(
                ref_id="test_ref",
                subtractions=[
                    subtraction_ids["subtraction_1"],
                    subtraction_ids["subtraction_2"],
                ],
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


class TestHideIimi:
    """Iimi analyses are hidden from the data-layer find and get operations ahead of
    the iimi purge migration.
    """

    @staticmethod
    async def _seed_iimi(mongo: Mongo, pg: AsyncEngine, user_id: str) -> int:
        return await seed_analysis(
            mongo,
            pg,
            {
                "_id": "iimi_hidden",
                "workflow": "iimi",
                "created_at": timestamp(),
                "ready": True,
                "job": None,
                "index": {"id": "test_index", "version": 11},
                "user": {"id": user_id},
                "sample": {"id": "test_sample"},
                "reference": {"id": "test_ref"},
                "results": {"hits": []},
                "subtractions": [],
            },
        )

    async def test_find_excludes_iimi(
        self,
        data_layer: DataLayer,
        mongo: Mongo,
        pg: AsyncEngine,
        setup_sample: str,
        mocker,
    ):
        """An iimi analysis is excluded from both the documents and the counts."""
        mocker.patch(
            "virtool.samples.utils.get_sample_rights",
            return_value=(True, True),
        )
        client = mocker.Mock(spec=UserClient)
        user_id = setup_sample

        visible = await data_layer.analyses.create(
            CreateAnalysisRequest(
                ref_id="test_ref",
                subtractions=[],
                workflow=AnalysisWorkflow.nuvs,
            ),
            "test_sample",
            user_id,
            0,
        )

        await self._seed_iimi(mongo, pg, user_id)

        analyses_found = await data_layer.analyses.find(1, 25, client, "test_sample")

        assert [document.id for document in analyses_found.documents] == [visible.id]
        assert analyses_found.found_count == 1
        assert analyses_found.total_count == 1

    async def test_get_iimi_not_found(
        self,
        data_layer: DataLayer,
        mongo: Mongo,
        pg: AsyncEngine,
        setup_sample: str,
    ):
        """Getting an iimi analysis by id raises ``ResourceNotFoundError``."""
        analysis_id = await self._seed_iimi(mongo, pg, setup_sample)

        with pytest.raises(ResourceNotFoundError):
            await data_layer.analyses.get(analysis_id)


async def test_create(
    data_layer: DataLayer,
    snapshot: SnapshotAssertion,
    setup_sample: str,
    subtraction_ids: dict[str, int],
):
    """Tests that an analysis is created with the expected fields."""
    user_id: str = setup_sample

    analysis = await data_layer.analyses.create(
        CreateAnalysisRequest(
            ref_id="test_ref",
            subtractions=[
                subtraction_ids["subtraction_1"],
                subtraction_ids["subtraction_2"],
            ],
            workflow=AnalysisWorkflow.nuvs,
        ),
        "test_sample",
        user_id,
        0,
    )

    assert analysis == snapshot(name="obj", exclude=props("created_at", "updated_at"))


def _create_request(subtraction_ids: dict[str, int]) -> CreateAnalysisRequest:
    return CreateAnalysisRequest(
        ref_id="test_ref",
        subtractions=[
            subtraction_ids["subtraction_1"],
            subtraction_ids["subtraction_2"],
        ],
        workflow=AnalysisWorkflow.nuvs,
    )


class TestCreate:
    """Creating an analysis writes a Postgres row."""

    async def test_writes_pg_row(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
        setup_sample: str,
        subtraction_ids: dict[str, int],
    ):
        """The Postgres row reflects the creation request."""
        analysis = await data_layer.analyses.create(
            _create_request(subtraction_ids),
            "test_sample",
            setup_sample,
            0,
        )

        row = await get_row(pg, SQLAnalysis, ("id", analysis.id))

        assert row is not None
        assert row.id == analysis.id
        assert row.workflow == "nuvs"
        assert row.ready is False
        assert row.results is None
        assert row.sample == "test_sample"
        assert row.reference == "test_ref"
        assert row.created_at == row.updated_at
        assert isinstance(row.user_id, int)

        async with AsyncSession(pg) as session:
            linked = (
                (
                    await session.execute(
                        select(SQLSubtraction.id)
                        .join(
                            SQLAnalysisSubtraction,
                            SQLAnalysisSubtraction.subtraction_id == SQLSubtraction.id,
                        )
                        .where(SQLAnalysisSubtraction.analysis_id == analysis.id),
                    )
                )
                .scalars()
                .all()
            )

        assert sorted(linked) == sorted(
            [subtraction_ids["subtraction_1"], subtraction_ids["subtraction_2"]],
        )

    async def test_subtractions_default_to_list(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
        setup_sample: str,
    ):
        """An analysis created without subtractions links no subtraction rows."""
        analysis = await data_layer.analyses.create(
            CreateAnalysisRequest(
                ref_id="test_ref",
                workflow=AnalysisWorkflow.nuvs,
            ),
            "test_sample",
            setup_sample,
            0,
        )

        async with AsyncSession(pg) as session:
            linked = (
                (
                    await session.execute(
                        select(SQLAnalysisSubtraction).where(
                            SQLAnalysisSubtraction.analysis_id == analysis.id,
                        ),
                    )
                )
                .scalars()
                .all()
            )

        assert linked == []

    async def test_unknown_subtraction_raises(
        self,
        data_layer: DataLayer,
        setup_sample: str,
        subtraction_ids: dict[str, int],
    ):
        """Creating an analysis with an unresolvable subtraction is a conflict."""
        with pytest.raises(ResourceConflictError, match="905"):
            await data_layer.analyses.create(
                CreateAnalysisRequest(
                    ref_id="test_ref",
                    subtractions=[subtraction_ids["subtraction_1"], 905],
                    workflow=AnalysisWorkflow.nuvs,
                ),
                "test_sample",
                setup_sample,
                0,
            )

    async def test_unknown_sample_raises(
        self,
        data_layer: DataLayer,
        setup_sample: str,
        subtraction_ids: dict[str, int],
    ):
        """Creating an analysis for a sample with no ``legacy_samples`` row is a
        conflict.
        """
        with pytest.raises(ResourceConflictError, match="Sample does not exist"):
            await data_layer.analyses.create(
                _create_request(subtraction_ids),
                "unknown_sample",
                setup_sample,
                0,
            )

    async def test_rolls_back_when_pg_write_fails(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
        setup_sample: str,
        subtraction_ids: dict[str, int],
        mocker,
    ):
        """A failure writing the Postgres row leaves no analysis behind."""
        mocker.patch(
            "virtool.analyses.data.insert",
            side_effect=RuntimeError("boom"),
        )

        with pytest.raises(RuntimeError):
            await data_layer.analyses.create(
                _create_request(subtraction_ids),
                "test_sample",
                setup_sample,
                0,
            )

        async with AsyncSession(pg) as session:
            result = await session.execute(select(SQLAnalysis))
            assert result.scalars().first() is None


class TestFinalize:
    """Finalizing an analysis writes results and the ready flag to Postgres."""

    async def test_writes_results(
        self,
        data_layer: DataLayer,
        mongo: Mongo,
        pg: AsyncEngine,
        setup_sample: str,
        subtraction_ids: dict[str, int],
        mocker,
    ):
        """Finalize marks the Postgres row ready and stores the results."""
        m_format_analysis = mocker.patch(
            "virtool.analyses.format.format_analysis",
            side_effect=lambda _mongo, _pg, *, results, **_: results,
        )

        analysis = await data_layer.analyses.create(
            _create_request(subtraction_ids),
            "test_sample",
            setup_sample,
            0,
        )

        created = await get_row(pg, SQLAnalysis, ("id", analysis.id))

        results = {"hits": [{"index": 0, "sequence": "ACGT"}]}

        await data_layer.analyses.finalize(analysis.id, results)

        row = await get_row(pg, SQLAnalysis, ("id", analysis.id))

        assert row.ready is True
        assert row.results == results
        assert row.updated_at > created.updated_at

        # The PostgreSQL engine must be threaded through to format_analysis so it can
        # resolve Postgres-stored history diffs.
        m_format_analysis.assert_called_with(
            mongo,
            pg,
            workflow=ANY,
            results=ANY,
        )


class TestDelete:
    """Deleting an analysis removes its Postgres row."""

    async def test_deletes_pg_row(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
        setup_sample: str,
        subtraction_ids: dict[str, int],
    ):
        """Delete removes the Postgres row."""
        analysis = await data_layer.analyses.create(
            _create_request(subtraction_ids),
            "test_sample",
            setup_sample,
            0,
        )

        await data_layer.analyses.delete(analysis.id, jobs_api_flag=True)

        assert await get_row(pg, SQLAnalysis, ("id", analysis.id)) is None


async def test_get_without_if_modified_since(
    data_layer: DataLayer,
    setup_sample: str,
    subtraction_ids: dict[str, int],
):
    """Test that an analysis can be fetched without an HTTP cache validator."""
    analysis = await data_layer.analyses.create(
        CreateAnalysisRequest(
            ref_id="test_ref",
            subtractions=[
                subtraction_ids["subtraction_1"],
                subtraction_ids["subtraction_2"],
            ],
            workflow=AnalysisWorkflow.nuvs,
        ),
        "test_sample",
        setup_sample,
        0,
    )

    fetched = await data_layer.analyses.get(analysis.id)

    assert fetched.id == analysis.id


async def test_upload_file(
    data_layer: DataLayer,
    example_path: Path,
    setup_sample: str,
    subtraction_ids: dict[str, int],
    snapshot_recent: SnapshotAssertion,
    spawn_job_client,
    tmp_path,
):
    """Test that an analysis result file is properly uploaded and a row is inserted into
    the `analysis_files` SQL table.
    """
    user_id = setup_sample

    analysis = await data_layer.analyses.create(
        CreateAnalysisRequest(
            ref_id="test_ref",
            subtractions=[
                subtraction_ids["subtraction_1"],
                subtraction_ids["subtraction_2"],
            ],
            workflow=AnalysisWorkflow.nuvs,
        ),
        "test_sample",
        user_id,
        0,
    )

    chunks = fake_file_chunker(example_path / "sample" / "reads_1.fq.gz")

    analysis_file = await data_layer.analyses.upload_file(
        chunks,
        analysis.id,
        "fasta",
        "test",
    )

    assert analysis_file == snapshot_recent()
    assert await get_row_by_id(data_layer.analyses._pg, SQLAnalysisFile, 1)
