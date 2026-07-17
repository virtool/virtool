import asyncio
from http import HTTPStatus
from pathlib import Path

import pytest
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

from tests.fixtures.analysis import seed_analysis
from tests.fixtures.client import ClientSpawner, JobClientSpawner
from tests.fixtures.response import RespIs
from tests.fixtures.samples import create_rights_sample
from virtool.analyses.files import create_analysis_file
from virtool.analyses.sql import SQLAnalysis, SQLAnalysisFile
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.jobs.models import Job, JobState
from virtool.models.enums import Permission
from virtool.mongo.core import Mongo
from virtool.pg.utils import get_row_by_id
from virtool.samples.models import Sample
from virtool.users.models import User
from virtool.workflow.pytest_plugin.utils import StaticTime

MISSING_SAMPLE_ID = 999999
"""The id of a sample that does not exist, for exercising 404s on the parent sample."""


async def create_analysis_sample(
    data_layer: DataLayer,
    fake: DataFaker,
    owner: User,
    *,
    all_read: bool = True,
    all_write: bool = False,
) -> Sample:
    """Create a finalized sample owned by ``owner`` for an analysis to hang off.

    Analyses are read through their parent sample's rights, so these samples are
    readable by default and only the right under test is varied.
    """
    return await create_rights_sample(
        data_layer,
        fake,
        owner,
        ready=True,
        all_read=all_read,
        all_write=all_write,
        group_read=True,
        group_write=True,
    )


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


async def test_find(
    data_layer: DataLayer,
    fake: DataFaker,
    mongo: Mongo,
    pg: AsyncEngine,
    snapshot: SnapshotAssertion,
    spawn_client: ClientSpawner,
    static_time,
):
    client = await spawn_client(authenticated=True)

    user_1 = await fake.users.create()
    user_2 = await fake.users.create()

    job = await fake.jobs.create(user=user_2)

    upload = await fake.uploads.create(user=user_1)
    malus = await fake.subtractions.create(
        user=user_1,
        upload=upload,
        name="Malus domestica",
        upload_files=False,
        finalized=False,
    )

    reference = await fake.references.create(user=user_1)
    other_reference = await fake.references.create(user=user_1)

    sample = await create_analysis_sample(
        data_layer,
        fake,
        user_1,
        all_write=True,
    )

    for document in [
        {
            "_id": "test_1",
            "workflow": "pathoscope",
            "created_at": static_time.datetime,
            "ready": True,
            "job": {"id": job.id},
            "index": {"version": 2, "id": "foo"},
            "user": {"id": user_1.id},
            "sample": {"id": sample.id},
            "reference": {"id": reference.id},
            "results": {"hits": []},
            "subtractions": [],
            "foobar": True,
        },
        {
            "_id": "test_2",
            "workflow": "pathoscope",
            "created_at": static_time.datetime,
            "ready": True,
            "job": {"id": job.id},
            "index": {"version": 2, "id": "foo"},
            "user": {"id": user_1.id},
            "sample": {"id": sample.id},
            "reference": {"id": reference.id},
            "results": {"hits": []},
            "subtractions": [malus.id],
            "foobar": True,
        },
        {
            "_id": "test_3",
            "workflow": "pathoscope",
            "created_at": static_time.datetime,
            "ready": True,
            "job": None,
            "index": {"version": 2, "id": "foo"},
            "user": {"id": user_1.id},
            "sample": {"id": sample.id},
            "reference": {"id": other_reference.id},
            "results": {"hits": []},
            "subtractions": [],
            "foobar": False,
        },
    ]:
        await seed_analysis(mongo, pg, document)

    resp = await client.get("/analyses")

    assert resp.status == HTTPStatus.OK
    assert await resp.json() == snapshot


class TestGet:
    sample: Sample

    @pytest.fixture(autouse=True)
    async def setup(
        self,
        fake: DataFaker,
        spawn_client: ClientSpawner,
        static_time: StaticTime,
    ) -> None:
        self.client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_ref],
        )

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

        resp = await self.client.post("/references/v1", {"name": "Test Reference"})

        assert resp.status == HTTPStatus.CREATED

        self.reference = await resp.json()

    async def _create_sample(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        *,
        all_read: bool = True,
    ) -> None:
        """Create the parent sample the analyses under test belong to."""
        self.sample = await create_analysis_sample(
            data_layer,
            fake,
            self.user,
            all_read=all_read,
        )

    async def _seed_analysis(
        self,
        mongo: Mongo,
        pg: AsyncEngine,
        static_time: StaticTime,
        legacy_id: str = "foobar",
        *,
        ready: bool = True,
        sample_id: int | None = None,
    ) -> int:
        """Seed a ready pathoscope analysis of the sample and return its integer id."""
        return await seed_analysis(
            mongo,
            pg,
            {
                "_id": legacy_id,
                "created_at": static_time.datetime,
                "index": {"version": 3, "id": "bar"},
                "job": {"id": self.job.id},
                "ready": ready,
                "reference": {"id": self.reference["id"]},
                "results": {"hits": []},
                "sample": {"id": self.sample.id if sample_id is None else sample_id},
                "subtractions": [self.plum.id, self.apple.id],
                "user": {"id": self.user.id},
                "workflow": "pathoscope",
            },
        )

    async def test_ok(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        snapshot: SnapshotAssertion,
        static_time: StaticTime,
    ):
        await self._create_sample(data_layer, fake)

        analysis_id = await self._seed_analysis(mongo, pg, static_time)

        await create_analysis_file(pg, analysis_id, "fasta", "reference.fa")

        resp = await self.client.get("/analyses/foobar")

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot

    async def test_insufficient_rights(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        resp_is: RespIs,
        static_time: StaticTime,
    ):
        """A user who cannot read the parent sample cannot read its analyses."""
        await self._create_sample(data_layer, fake, all_read=False)
        await self._seed_analysis(mongo, pg, static_time)

        resp = await self.client.get("/analyses/foobar")

        await resp_is.insufficient_rights(resp)

    async def test_not_found(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        resp_is: RespIs,
    ):
        await self._create_sample(data_layer, fake)

        resp = await self.client.get("/analyses/foobar")

        await resp_is.not_found(resp)

    async def test_sample_not_found(
        self,
        mongo: Mongo,
        pg: AsyncEngine,
        resp_is: RespIs,
        static_time: StaticTime,
    ):
        """An analysis whose parent sample is gone is not readable."""
        await self._seed_analysis(
            mongo,
            pg,
            static_time,
            sample_id=MISSING_SAMPLE_ID,
        )

        resp = await self.client.get("/analyses/foobar")

        await resp_is.not_found(resp)

    async def test_by_integer_id(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        static_time: StaticTime,
    ):
        """An analysis resolves by its integer id, the new outward-facing identifier,
        and the response emits that integer id rather than the legacy Mongo slug.
        """
        await self._create_sample(data_layer, fake)

        analysis_id = await self._seed_analysis(
            mongo,
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
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        static_time: StaticTime,
    ):
        """An existing analysis whose reference is archived still resolves reference
        metadata via ``AttachReferenceTransform``.
        """
        resp = await self.client.post(
            f"/references/v1/{self.reference['id']}/archive",
            {},
        )

        assert resp.status == HTTPStatus.OK

        await self._create_sample(data_layer, fake)

        analysis_id = await self._seed_analysis(mongo, pg, static_time)

        await create_analysis_file(pg, analysis_id, "fasta", "reference.fa")

        resp = await self.client.get("/analyses/foobar")

        assert resp.status == HTTPStatus.OK
        assert (await resp.json())["reference"] == {
            "id": self.reference["id"],
            "data_type": "genome",
            "name": "Test Reference",
        }

    @pytest.mark.parametrize("ready", [True, False])
    async def test_not_modified(
        self,
        ready: bool,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        static_time: StaticTime,
    ):
        """An analysis unmodified since the request date returns ``304``."""
        await self._create_sample(data_layer, fake)

        analysis_id = await self._seed_analysis(mongo, pg, static_time, ready=ready)

        await create_analysis_file(pg, analysis_id, "fasta", "reference.fa")

        resp = await self.client.get(
            url="/analyses/foobar",
            headers={"If-Modified-Since": "2015-10-06T20:00:00Z"},
        )

        assert resp.status == HTTPStatus.NOT_MODIFIED


@pytest.mark.parametrize("error", [None, "403", "404_analysis", "404_sample", "409"])
async def test_remove(
    error: str | None,
    data_layer: DataLayer,
    fake: DataFaker,
    mongo: Mongo,
    pg: AsyncEngine,
    resp_is,
    spawn_client: ClientSpawner,
    static_time,
):
    client = await spawn_client(authenticated=True)

    user = await fake.users.create()

    upload = await fake.uploads.create(user=user)
    plum = await fake.subtractions.create(
        user=user, upload=upload, name="Plum", upload_files=False, finalized=False
    )
    await fake.subtractions.create(
        user=user, upload=upload, name="Apple", upload_files=False, finalized=False
    )

    reference = await fake.references.create(user=user)

    index = await fake.indexes.create(reference, user, version=3, ready=True)

    sample_id = MISSING_SAMPLE_ID

    if error != "404_sample":
        sample = await create_analysis_sample(
            data_layer,
            fake,
            user,
            all_write=error != "403",
        )

        sample_id = sample.id

    if error != "404_analysis":
        await seed_analysis(
            mongo,
            pg,
            {
                "_id": "foobar",
                "created_at": static_time.datetime,
                "index": {"id": index.id, "version": 3},
                "job": {"id": "hello"},
                "ready": error != "409",
                "reference": {"id": reference.id},
                "sample": {"id": sample_id},
                "subtractions": [plum.id],
                "user": {"id": user.id},
                "workflow": "pathoscope",
                "results": {"hits": []},
            },
        )

    resp = await client.delete("/analyses/foobar")

    match error:
        case None:
            await resp_is.no_content(resp)

        case "403":
            await resp_is.insufficient_rights(resp)

        case "404_analysis" | "404_sample":
            await resp_is.not_found(resp)

        case "409":
            await resp_is.conflict(resp, "Analysis is still running")


@pytest.mark.parametrize("error", [None, 400, 404, 422])
async def test_upload_file(
    error: str | None,
    fake: DataFaker,
    get_handle,
    mongo: Mongo,
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
            mongo,
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


class TestDownloadAnalysisResult:
    async def test_ok(
        self,
        example_path: Path,
        fake: DataFaker,
        get_handle,
        mongo: Mongo,
        pg: AsyncEngine,
        spawn_client: ClientSpawner,
        spawn_job_client: JobClientSpawner,
        static_time: StaticTime,
    ):
        """Test that an uploaded analysis result file can subsequently be downloaded."""
        client, job_client = await asyncio.gather(
            spawn_client(administrator=True, authenticated=True),
            spawn_job_client(authenticated=True),
        )

        user = await fake.users.create()
        await seed_analysis(
            mongo,
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

        await job_client.put(
            "/analyses/foobar/files?name=reference.fa&format=fasta",
            data=get_handle(),
        )

        resp = await client.get("/analyses/foobar/files/1")

        assert resp.status == HTTPStatus.OK

        assert (
            await resp.read()
            == open(example_path / "sample" / "reads_1.fq.gz", "rb").read()
        )

    async def test_not_found(
        self,
        mongo: Mongo,
        spawn_client: ClientSpawner,
    ):
        """Test that a 404 response is returned when the requested file does not exist."""
        client = await spawn_client(administrator=True, authenticated=True)

        await mongo.analyses.insert_one(
            {"_id": "foobar", "ready": True, "job": {"id": "hello"}},
        )

        resp = await client.get("/analyses/foobar/files/2")

        assert resp.status == 404
        assert await resp.json() == {"id": "not_found", "message": "Not found"}


@pytest.mark.parametrize(
    "error",
    [
        None,
        "403",
        "404_analysis",
        "404_sample",
        "404_sequence",
        "409_workflow",
        "409_ready",
    ],
)
async def test_blast(
    error,
    data_layer: DataLayer,
    fake: DataFaker,
    mongo: Mongo,
    pg: AsyncEngine,
    spawn_client: ClientSpawner,
    resp_is,
    snapshot,
    static_time,
):
    """Test that the handler starts a BLAST for given NuVs sequence. Also check that it handles all error conditions
    correctly.

    """
    client = await spawn_client(
        authenticated=True,
        base_url="https://virtool.example.com",
    )

    user = await fake.users.create()

    if error != "404_analysis":
        sample_id = MISSING_SAMPLE_ID

        if error != "404_sample":
            sample = await create_analysis_sample(
                data_layer,
                fake,
                user,
                all_write=error != "403",
            )

            sample_id = sample.id

        analysis_document = {
            "_id": "foobar",
            "created_at": static_time.datetime,
            "workflow": "nuvs",
            "ready": True,
            "results": {
                "hits": [
                    {"index": 3, "sequence": "ATAGAGATTAGAT"},
                    {"index": 5, "sequence": "GGAGTTAGATTGG"},
                    {"index": 8, "sequence": "ACCAATAGACATT"},
                ],
            },
            "sample": {"id": sample_id},
            "reference": {"id": "ref"},
            "index": {"id": "index", "version": 0},
            "subtractions": [],
            "user": {"id": user.id},
        }

        if error == "404_sequence":
            analysis_document["results"]["hits"].pop(1)

        elif error == "409_workflow":
            analysis_document["workflow"] = "pathoscope"

        elif error == "409_ready":
            analysis_document["ready"] = False

        await seed_analysis(mongo, pg, analysis_document)

    await client.put("/analyses/foobar/5/blast", {})

    resp = await client.put("/analyses/foobar/5/blast", {})

    if error is None:
        assert resp.status == 201

        assert (
            resp.headers["Location"]
            == "https://virtool.example.com/analyses/foobar/5/blast"
        )

        assert await resp.json() == snapshot

    elif error == "403":
        await resp_is.insufficient_rights(resp)

    elif error in ("404_analysis", "404_sample"):
        await resp_is.not_found(resp)

    elif error == "404_sequence":
        await resp_is.not_found(resp, "Sequence not found")

    elif error == "409_workflow":
        await resp_is.conflict(resp, "Not a NuVs analysis")

    elif error == "409_ready":
        await resp_is.conflict(resp, "Analysis is still running")


class TestFinalize:
    job: Job
    user: User

    @pytest.fixture(autouse=True)
    async def _setup(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        static_time: StaticTime,
    ):
        user = await fake.users.create()
        job = await fake.jobs.create(state=JobState.RUNNING, user=user)

        reference = await fake.references.create(user=user)

        sample = await create_analysis_sample(
            data_layer,
            fake,
            user,
            all_write=True,
        )

        await seed_analysis(
            mongo,
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

    async def test_not_found(self, spawn_job_client):
        """Test that a 404 response is returned when the analysis does not exist."""
        client = await spawn_job_client(authenticated=True)

        resp = await client.patch(
            "/analyses/analysis2",
            json={"results": {"result": "TEST_RESULT", "hits": []}},
        )

        assert resp.status == 404

    async def test_missing_results(
        self,
        fake: DataFaker,
        mongo: Mongo,
        spawn_job_client: JobClientSpawner,
        static_time: StaticTime,
    ):
        client = await spawn_job_client(authenticated=True)

        resp = await client.patch("/analyses/analysis1", json={})

        assert resp.status == 422

    async def test_already_ready(
        self,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        spawn_job_client: JobClientSpawner,
        static_time: StaticTime,
    ):
        client = await spawn_job_client(authenticated=True)

        # Finalize the analysis to trigger the error.
        await mongo.analyses.update_one(
            {"_id": "analysis1"},
            {
                "$set": {
                    "ready": True,
                    "results": {"result": "TEST_RESULT", "hits": []},
                },
            },
        )

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
