from pathlib import Path
from typing import NamedTuple
from unittest.mock import ANY

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

from tests.fixtures.analysis import seed_analysis
from virtool.analyses.sql import SQLAnalysis, SQLAnalysisFile
from virtool.data.errors import ResourceNotModifiedError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker, fake_file_chunker
from virtool.pg.utils import get_row, get_row_by_id
from virtool.storage.errors import StorageKeyNotFoundError
from virtool.storage.protocol import StorageBackend
from virtool.users.models import User
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


class SampleSetup(NamedTuple):
    """Identifiers for the sample, reference and index seeded by ``setup_sample``."""

    sample_id: int
    user: User
    reference_id: int
    index_id: int

    @property
    def user_id(self) -> int:
        return self.user.id


@pytest.fixture
async def setup_sample(fake: DataFaker) -> SampleSetup:
    """Seed a finalized sample and a reference with a ready index to analyse it
    against.
    """
    user = await fake.users.create()
    reference = await fake.references.create(user=user, name="Test Reference")

    sample = await fake.samples.create(user, ready=True)

    index = await fake.indexes.create(reference, user, version=11, ready=True)

    return SampleSetup(
        sample_id=sample.id,
        user=user,
        reference_id=reference.id,
        index_id=index.id,
    )


async def seed_setup_analysis(
    pg: AsyncEngine,
    setup: SampleSetup,
    subtractions: list[int] | None = None,
    legacy_id: str | None = None,
    *,
    ready: bool = False,
    results: dict | None = None,
) -> int:
    """Seed an analysis of ``setup``'s sample and return its integer id.

    ``legacy_id`` defaults to ``None``, giving a Postgres-native analysis.
    """
    return await seed_analysis(
        pg,
        {
            "_id": legacy_id,
            "created_at": timestamp(),
            "index": {"id": setup.index_id, "version": 11},
            "job": None,
            "ready": ready,
            "reference": {"id": setup.reference_id},
            "results": results,
            "sample": {"id": setup.sample_id},
            "subtractions": subtractions or [],
            "user": {"id": setup.user_id},
            "workflow": "nuvs",
        },
    )


class TestFinalize:
    """Finalizing an analysis writes results and the ready flag to Postgres."""

    async def test_writes_results(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
        setup_sample: SampleSetup,
        subtraction_ids: dict[str, int],
        mocker,
    ):
        """Finalize marks the Postgres row ready and stores the results."""
        m_format_analysis = mocker.patch(
            "virtool.analyses.format.format_analysis",
            side_effect=lambda _pg, *, results, **_: results,
        )

        analysis_id = await seed_setup_analysis(
            pg,
            setup_sample,
            [subtraction_ids["subtraction_1"], subtraction_ids["subtraction_2"]],
        )

        created = await get_row(pg, SQLAnalysis, ("id", analysis_id))

        results = {"hits": [{"index": 0, "sequence": "ACGT"}]}

        await data_layer.analyses.finalize(analysis_id, results)

        row = await get_row(pg, SQLAnalysis, ("id", analysis_id))

        assert row.ready is True
        assert row.results == results
        assert row.updated_at > created.updated_at

        # The PostgreSQL engine must be threaded through to format_analysis so it can
        # resolve Postgres-stored history diffs.
        m_format_analysis.assert_called_with(
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
        setup_sample: SampleSetup,
        subtraction_ids: dict[str, int],
    ):
        """Delete removes the Postgres row."""
        analysis_id = await seed_setup_analysis(
            pg,
            setup_sample,
            [subtraction_ids["subtraction_1"]],
            ready=True,
            results={"hits": []},
        )

        await data_layer.analyses.delete(analysis_id, jobs_api_flag=True)

        assert await get_row(pg, SQLAnalysis, ("id", analysis_id)) is None

    async def test_deletes_recorded_file_objects(
        self,
        data_layer: DataLayer,
        memory_storage: StorageBackend,
        pg: AsyncEngine,
        setup_sample: SampleSetup,
    ):
        """Deleting an analysis removes every object its file rows name."""
        analysis_id = await seed_setup_analysis(
            pg,
            setup_sample,
            ready=True,
            results={"hits": []},
        )

        async def _chunks():
            yield bytearray(b"results")

        await data_layer.analyses.upload_file(
            _chunks(), analysis_id, "fasta", "results.fa"
        )

        async with AsyncSession(pg) as session:
            key = await session.scalar(
                select(SQLAnalysisFile.storage_key).where(
                    SQLAnalysisFile.analysis_id == analysis_id,
                ),
            )

        assert await memory_storage.size(key) > 0

        await data_layer.analyses.delete(analysis_id, jobs_api_flag=True)

        with pytest.raises(StorageKeyNotFoundError):
            await memory_storage.size(key)

    async def test_leaves_objects_no_row_names(
        self,
        data_layer: DataLayer,
        memory_storage: StorageBackend,
        pg: AsyncEngine,
        setup_sample: SampleSetup,
    ):
        """Objects written under a migrated analysis' old slug prefix survive deletion.

        Those objects predate keys being recorded, so no row names them and the
        delete path cannot reach them. Collecting them is the orphan sweep's job,
        not this delete's -- guessing at a prefix is what this change removes.
        """
        analysis_id = await seed_setup_analysis(
            pg,
            setup_sample,
            legacy_id="oldslug",
            ready=True,
            results={"hits": []},
        )

        legacy_key = f"samples/{setup_sample.sample_id}/analysis/oldslug/hits.fa"

        async def _stream():
            yield b"legacy"

        await memory_storage.write(legacy_key, _stream())

        await data_layer.analyses.delete(analysis_id, jobs_api_flag=True)

        assert await memory_storage.size(legacy_key) > 0


async def test_get_without_if_modified_since(
    data_layer: DataLayer,
    pg: AsyncEngine,
    setup_sample: SampleSetup,
    subtraction_ids: dict[str, int],
):
    """Test that an analysis can be fetched without an HTTP cache validator."""
    analysis_id = await seed_setup_analysis(
        pg,
        setup_sample,
        [subtraction_ids["subtraction_1"], subtraction_ids["subtraction_2"]],
    )

    fetched = await data_layer.analyses.get(analysis_id)

    assert fetched.id == analysis_id


async def test_get_not_modified(
    data_layer: DataLayer,
    pg: AsyncEngine,
    setup_sample: SampleSetup,
):
    """An ``if_modified_since`` matching the analysis's ``updated_at`` short-circuits
    the read with ``ResourceNotModifiedError``.
    """
    analysis_id = await seed_setup_analysis(pg, setup_sample)

    row = await get_row(pg, SQLAnalysis, ("id", analysis_id))

    with pytest.raises(ResourceNotModifiedError):
        await data_layer.analyses.get(analysis_id, row.updated_at)


async def test_get_analysis_written_without_legacy_columns(
    data_layer: DataLayer,
    pg: AsyncEngine,
    setup_sample: SampleSetup,
):
    """An analysis inserted with only the integer foreign keys — the shape written by
    writers that have moved off the legacy Mongo strings — is accepted by Postgres and
    reads back with its reference and index resolved.
    """
    async with AsyncSession(pg) as session:
        analysis = SQLAnalysis(
            created_at=timestamp(),
            updated_at=timestamp(),
            workflow="nuvs",
            ready=False,
            sample=str(setup_sample.sample_id),
            sample_id=setup_sample.sample_id,
            reference_id=setup_sample.reference_id,
            index_id=setup_sample.index_id,
            user_id=setup_sample.user_id,
        )

        session.add(analysis)
        await session.flush()

        analysis_id = analysis.id

        await session.commit()

    row = await get_row(pg, SQLAnalysis, ("id", analysis_id))

    assert row.reference is None
    assert row.index is None

    fetched = await data_layer.analyses.get(analysis_id)

    assert fetched.id == analysis_id
    assert fetched.reference.id == setup_sample.reference_id
    assert fetched.index.id == setup_sample.index_id


async def test_analysis_without_reference_or_reference_id_is_rejected(
    pg: AsyncEngine,
    setup_sample: SampleSetup,
):
    """An analysis naming its reference neither by the legacy string nor by the foreign
    key is rejected, rather than stored as a row that cannot be read back.
    """
    async with AsyncSession(pg) as session:
        session.add(
            SQLAnalysis(
                created_at=timestamp(),
                updated_at=timestamp(),
                workflow="nuvs",
                ready=False,
                sample=str(setup_sample.sample_id),
                sample_id=setup_sample.sample_id,
                index_id=setup_sample.index_id,
                user_id=setup_sample.user_id,
            ),
        )

        with pytest.raises(IntegrityError, match="ck_analyses_reference_present"):
            await session.commit()


async def test_analysis_without_index_id_is_rejected(
    pg: AsyncEngine,
    setup_sample: SampleSetup,
):
    """An analysis that does not name its index by the foreign key is rejected, rather
    than stored as a row whose index cannot be resolved.
    """
    async with AsyncSession(pg) as session:
        session.add(
            SQLAnalysis(
                created_at=timestamp(),
                updated_at=timestamp(),
                workflow="nuvs",
                ready=False,
                sample=str(setup_sample.sample_id),
                sample_id=setup_sample.sample_id,
                reference_id=setup_sample.reference_id,
                user_id=setup_sample.user_id,
            ),
        )

        with pytest.raises(IntegrityError, match="index_id"):
            await session.commit()


async def test_upload_file(
    data_layer: DataLayer,
    example_path: Path,
    pg: AsyncEngine,
    setup_sample: SampleSetup,
    subtraction_ids: dict[str, int],
    snapshot_recent: SnapshotAssertion,
):
    """Test that an analysis result file is properly uploaded and a row is inserted into
    the `analysis_files` SQL table.
    """
    analysis_id = await seed_setup_analysis(
        pg,
        setup_sample,
        [subtraction_ids["subtraction_1"], subtraction_ids["subtraction_2"]],
    )

    chunks = fake_file_chunker(example_path / "sample" / "reads_1.fq.gz")

    analysis_file = await data_layer.analyses.upload_file(
        chunks,
        analysis_id,
        "fasta",
        "test",
    )

    assert analysis_file == snapshot_recent()
    assert await get_row_by_id(data_layer.analyses._pg, SQLAnalysisFile, 1)
