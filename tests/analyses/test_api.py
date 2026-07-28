from http import HTTPStatus
from pathlib import Path

import pytest
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

from tests.fixtures.analysis import seed_analysis
from tests.fixtures.client import JobClientSpawner
from virtool.analyses.files import create_analysis_file
from virtool.analyses.sql import SQLAnalysis, SQLAnalysisFile
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.jobs.models import JobState
from virtool.pg.utils import get_row_by_id
from virtool.references.models import Reference
from virtool.samples.models import Sample
from virtool.subtractions.models import Subtraction
from virtool.users.models import User
from virtool.workflow.pytest_plugin.utils import StaticTime


@pytest.fixture
def get_handle(example_path: Path):
    handles = []

    def func():
        f_ = open(example_path / "sample" / "reads_1.fq.gz", "rb")
        data = {"file": f_}
        handles.append(f_)
        return data

    yield func

    for f in handles:
        f.close()


class TestGet:
    """The jobs API serves the complete analysis document."""

    apple: Subtraction
    plum: Subtraction
    reference: Reference
    sample: Sample
    user: User

    @pytest.fixture(autouse=True)
    async def _setup(
        self,
        fake: DataFaker,
        spawn_job_client: JobClientSpawner,
        static_time: StaticTime,
    ) -> None:
        self.client = await spawn_job_client(authenticated=True)

        self.user = await fake.users.create()
        self.job = await fake.jobs.create(user=self.user, state=JobState.SUCCEEDED)

        upload = await fake.uploads.create(user=self.user)

        self.plum = await fake.subtractions.create(
            user=self.user,
            upload=upload,
            name="Plum",
            upload_files=False,
            finalized=False,
        )
        self.apple = await fake.subtractions.create(
            user=self.user,
            upload=upload,
            name="Apple",
            upload_files=False,
            finalized=False,
        )

        self.reference = await fake.references.create(
            user=self.user,
            name="Test Reference",
        )

        self.sample = await fake.samples.create(self.user, ready=True)

    async def _seed_analysis(
        self,
        pg: AsyncEngine,
        static_time: StaticTime,
        legacy_id: str = "foobar",
        *,
        ready: bool = True,
    ) -> int:
        """Seed a ready pathoscope analysis of the sample and return its integer id."""
        return await seed_analysis(
            pg,
            {
                "_id": legacy_id,
                "created_at": static_time.datetime,
                "index": {"version": 3, "id": "bar"},
                "job": {"id": self.job.id},
                "ready": ready,
                "reference": {"id": self.reference.id},
                "results": {"hits": []},
                "sample": {"id": self.sample.id},
                "subtractions": [self.plum.id, self.apple.id],
                "user": {"id": self.user.id},
                "workflow": "pathoscope",
            },
        )

    async def test_ok(
        self,
        pg: AsyncEngine,
        snapshot: SnapshotAssertion,
        static_time: StaticTime,
    ):
        analysis_id = await self._seed_analysis(pg, static_time)

        await create_analysis_file(pg, analysis_id, "fasta", "reference.fa")

        resp = await self.client.get("/analyses/foobar")

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot

    async def test_not_found(self):
        resp = await self.client.get("/analyses/foobar")

        assert resp.status == HTTPStatus.NOT_FOUND

    async def test_by_integer_id(
        self,
        pg: AsyncEngine,
        static_time: StaticTime,
    ):
        """An analysis resolves by its integer id, the new outward-facing identifier,
        and the response emits that integer id rather than the legacy Mongo slug.
        """
        analysis_id = await self._seed_analysis(
            pg,
            static_time,
            legacy_id="legacy_slug",
        )

        resp = await self.client.get(f"/analyses/{analysis_id}")

        assert resp.status == HTTPStatus.OK
        assert (await resp.json())["id"] == analysis_id

    async def test_archived_reference(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
        static_time: StaticTime,
    ):
        """An existing analysis whose reference is archived still resolves reference
        metadata via ``AttachReferenceTransform``.
        """
        await data_layer.references.archive(self.reference.id)

        analysis_id = await self._seed_analysis(pg, static_time)

        await create_analysis_file(pg, analysis_id, "fasta", "reference.fa")

        resp = await self.client.get("/analyses/foobar")

        assert resp.status == HTTPStatus.OK
        assert (await resp.json())["reference"] == {
            "id": self.reference.id,
            "data_type": "genome",
            "name": "Test Reference",
        }


class TestDelete:
    """The jobs API deletes an analysis whether or not it has been finalized."""

    async def _seed_analysis(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
        static_time: StaticTime,
        *,
        ready: bool,
    ) -> int:
        user = await fake.users.create()

        upload = await fake.uploads.create(user=user)
        plum = await fake.subtractions.create(
            user=user,
            upload=upload,
            name="Plum",
            upload_files=False,
            finalized=False,
        )

        reference = await fake.references.create(user=user)
        index = await fake.indexes.create(reference, user, version=3, ready=True)
        sample = await fake.samples.create(user, ready=True)

        return await seed_analysis(
            pg,
            {
                "_id": "foobar",
                "created_at": static_time.datetime,
                "index": {"id": index.id, "version": 3},
                "job": None,
                "ready": ready,
                "reference": {"id": reference.id},
                "results": {"hits": []},
                "sample": {"id": sample.id},
                "subtractions": [plum.id],
                "user": {"id": user.id},
                "workflow": "pathoscope",
            },
        )

    async def test_ok(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
        spawn_job_client: JobClientSpawner,
        static_time: StaticTime,
    ):
        client = await spawn_job_client(authenticated=True)

        analysis_id = await self._seed_analysis(fake, pg, static_time, ready=True)

        resp = await client.delete("/analyses/foobar")

        assert resp.status == HTTPStatus.NO_CONTENT
        assert await get_row_by_id(pg, SQLAnalysis, analysis_id) is None

    async def test_running(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
        spawn_job_client: JobClientSpawner,
        static_time: StaticTime,
    ):
        """Only the jobs API may delete an analysis that is still running."""
        client = await spawn_job_client(authenticated=True)

        analysis_id = await self._seed_analysis(fake, pg, static_time, ready=False)

        resp = await client.delete("/analyses/foobar")

        assert resp.status == HTTPStatus.NO_CONTENT
        assert await get_row_by_id(pg, SQLAnalysis, analysis_id) is None

    async def test_not_found(self, spawn_job_client: JobClientSpawner):
        client = await spawn_job_client(authenticated=True)

        resp = await client.delete("/analyses/foobar")

        assert resp.status == HTTPStatus.NOT_FOUND


@pytest.mark.parametrize("error", [None, 400, 404, 422])
async def test_upload_file(
    error: str | None,
    fake: DataFaker,
    get_handle,
    pg: AsyncEngine,
    resp_is,
    snapshot: SnapshotAssertion,
    spawn_job_client: JobClientSpawner,
    static_time: StaticTime,
):
    """Test that an analysis result file is properly uploaded and a row is inserted into
    the `analysis_files` SQL table.
    """
    client = await spawn_job_client(authenticated=True)

    format_ = "foo" if error == 400 else "fasta"

    if error != 404:
        user = await fake.users.create()
        await seed_analysis(
            pg,
            {
                "_id": "foobar",
                "created_at": static_time.datetime,
                "index": {"id": "bar", "version": 1},
                "job": {"id": "hello"},
                "ready": True,
                "reference": {"id": "baz"},
                "sample": {"id": "baz"},
                "subtractions": [],
                "user": {"id": user.id},
                "workflow": "pathoscope",
            },
        )

    if error == 422:
        resp_put = await client.put(
            "/analyses/foobar/files?format=fasta",
            data=get_handle(),
        )
        resp = await client.post(
            "/analyses/foobar/files?format=fasta",
            data=get_handle(),
        )
    else:
        resp_put = await client.put(
            f"/analyses/foobar/files?name=reference.fa&format={format_}",
            data=get_handle(),
        )
        resp = await client.post(
            f"/analyses/foobar/files?name=reference.fa&format={format_}",
            data=get_handle(),
        )

    match error:
        case None:
            assert resp_put.status == 201
            assert await resp_put.json() == snapshot

            assert resp.status == 201
            assert await resp.json() == snapshot

            assert await get_row_by_id(pg, SQLAnalysisFile, 1)
            assert await get_row_by_id(pg, SQLAnalysisFile, 2)

        case 400:
            await resp_is.bad_request(resp_put, "Unsupported analysis file format")
            await resp_is.bad_request(resp, "Unsupported analysis file format")

        case 404:
            assert resp_put.status == 404
            assert resp.status == 404

        case 422:
            await resp_is.invalid_query(resp_put, {"name": ["required field"]})
            await resp_is.invalid_query(resp, {"name": ["required field"]})


class TestFinalize:
    @pytest.fixture(autouse=True)
    async def _setup(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
        static_time: StaticTime,
    ):
        user = await fake.users.create()
        job = await fake.jobs.create(state=JobState.RUNNING, user=user)

        reference = await fake.references.create(user=user)

        sample = await fake.samples.create(user, ready=True)

        await seed_analysis(
            pg,
            {
                "_id": "analysis1",
                "sample": {"id": sample.id},
                "created_at": static_time.datetime,
                "files": [],
                "index": {"version": 2, "id": "foo"},
                "job": {"id": job.id},
                "ready": False,
                "reference": {"id": reference.id},
                "subtractions": [],
                "user": {"id": user.id},
                "workflow": "nuvs",
            },
        )

    async def test_ok(
        self,
        pg: AsyncEngine,
        snapshot: SnapshotAssertion,
        spawn_job_client: JobClientSpawner,
    ):
        client = await spawn_job_client(authenticated=True)

        resp = await client.patch(
            "/analyses/analysis1",
            json={"results": {"result": "TEST_RESULT", "hits": []}},
        )

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot

        async with AsyncSession(pg) as session:
            row = (
                await session.execute(
                    select(SQLAnalysis).where(SQLAnalysis.legacy_id == "analysis1"),
                )
            ).scalar_one()

        assert row.ready is True
        assert row.results == {"result": "TEST_RESULT", "hits": []}

    async def test_not_found(self, spawn_job_client: JobClientSpawner):
        """Test that a 404 response is returned when the analysis does not exist."""
        client = await spawn_job_client(authenticated=True)

        resp = await client.patch(
            "/analyses/analysis2",
            json={"results": {"result": "TEST_RESULT", "hits": []}},
        )

        assert resp.status == 404

    async def test_missing_results(self, spawn_job_client: JobClientSpawner):
        client = await spawn_job_client(authenticated=True)

        resp = await client.patch("/analyses/analysis1", json={})

        assert resp.status == 422

    async def test_already_ready(
        self,
        pg: AsyncEngine,
        spawn_job_client: JobClientSpawner,
    ):
        client = await spawn_job_client(authenticated=True)

        # Finalize the analysis to trigger the error.
        async with AsyncSession(pg) as session:
            await session.execute(
                update(SQLAnalysis)
                .where(SQLAnalysis.legacy_id == "analysis1")
                .values(ready=True),
            )
            await session.commit()

        resp = await client.patch(
            "/analyses/analysis1",
            json={"results": {"result": "TEST_RESULT", "hits": []}},
        )

        assert resp.status == 409
