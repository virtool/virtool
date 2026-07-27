import gzip
import io
from datetime import datetime
from http import HTTPStatus
from pathlib import Path

import pytest
from aiohttp.test_utils import make_mocked_coro
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

import virtool.utils
from tests.fixtures.client import ClientSpawner, JobClientSpawner, VirtoolTestClient
from virtool.analyses.sql import SQLAnalysis, SQLAnalysisSubtraction
from virtool.data.layer import DataLayer
from virtool.data.utils import get_data_from_app
from virtool.fake.next import DataFaker
from virtool.indexes.sql import SQLIndex
from virtool.jobs.models import CreateJobClaimRequest, JobState, Workflow
from virtool.jobs.pg import SQLJob
from virtool.references.models import Reference
from virtool.samples.models import Sample
from virtool.samples.utils import sample_file_key, sample_storage_id
from virtool.subtractions.pg import SQLSubtraction
from virtool.users.models import User


class MockJobInterface:
    def __init__(self):
        self.enqueue = make_mocked_coro()


class TestFinalize:
    """Test that sample can be finalized using the Jobs API."""

    async def test_quality(
        self,
        fake: DataFaker,
        resp_is,
        snapshot,
        spawn_job_client,
        static_time,
    ):
        user = await fake.users.create()
        sample = await fake.samples.create(user, ready=False)

        client = await spawn_job_client(authenticated=True)

        json = {
            "quality": {
                "bases": [[1543]],
                "composition": [[6372]],
                "count": 7069,
                "encoding": "OuBQPPuwYimrxkNpPWUx",
                "gc": 34222440,
                "length": [3237],
                "sequences": [7091],
            },
        }

        resp = await client.patch(f"/samples/{sample.id}", json=json)

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot

        resp = await client.patch(f"/samples/{sample.id}", json=json)
        await resp_is.conflict(resp, "Sample already finalized")

    async def test_not_quality(
        self,
        resp_is,
        spawn_job_client,
    ):
        client = await spawn_job_client(authenticated=True)

        resp = await client.patch("/samples/test", json={})

        assert resp.status == 422
        await resp_is.invalid_input(resp, {"quality": ["required field"]})


async def _drive_sample_job(app, sample: Sample, state: JobState) -> None:
    """Drive a sample's real creation job to ``state`` via the data layer.

    ``SamplesData.create()`` creates the ``create_sample`` job in ``pending`` state
    and wires it to the sample. This transitions that same job — no second job is
    created and no Mongo write is needed.
    """
    jobs = get_data_from_app(app).jobs
    job_id = sample.job.id

    if state is JobState.PENDING:
        return

    if state is JobState.CANCELLED:
        await jobs.cancel(job_id)
        return

    if state is JobState.FAILED:
        async with AsyncSession(app["pg"]) as session:
            await session.execute(
                update(SQLJob)
                .where(SQLJob.id == job_id)
                .values(
                    state=JobState.FAILED.value,
                    finished_at=virtool.utils.timestamp(),
                ),
            )
            await session.commit()
        return

    await jobs.claim(
        Workflow.CREATE_SAMPLE,
        CreateJobClaimRequest(
            runner_id="fake-runner",
            mem=1.0,
            cpu=1.0,
            image="virtool/fake:latest",
            runtime_version="0.0.0",
            workflow_version="0.0.0",
            steps=[],
        ),
    )

    if state is JobState.SUCCEEDED:
        await jobs.finish(job_id)


async def test_find_analyses(
    fake: DataFaker,
    snapshot: SnapshotAssertion,
    pg: AsyncEngine,
    spawn_client: ClientSpawner,
    static_time,
):
    client = await spawn_client(authenticated=True)

    user_1 = await fake.users.create()
    user_2 = await fake.users.create()

    job = await fake.jobs.create(user=user_1)

    upload = await fake.uploads.create(user=user_1)
    malus = await fake.subtractions.create(
        user=user_1,
        upload=upload,
        name="Malus domestica",
        upload_files=False,
        finalized=False,
    )

    sample = await fake.samples.create(user_1, ready=True)

    reference_foo = await fake.references.create(user=user_1)
    reference_baz = await fake.references.create(user=user_1)

    index = await fake.indexes.create(reference_foo, user_1, version=2, ready=True)

    async with AsyncSession(pg) as session:
        index_pg_id = (
            await session.execute(
                select(SQLIndex.id).where(SQLIndex.id == index.id),
            )
        ).scalar_one()

        analyses = [
            SQLAnalysis(
                legacy_id="test_1",
                created_at=static_time.datetime,
                updated_at=static_time.datetime,
                workflow="pathoscope",
                ready=True,
                sample=str(sample.id),
                sample_id=sample.id,
                reference="baz",
                reference_id=reference_baz.id,
                index=str(index.id),
                index_id=index_pg_id,
                user_id=user_1.id,
                job_id=job.id,
            ),
            SQLAnalysis(
                legacy_id="test_2",
                created_at=static_time.datetime,
                updated_at=static_time.datetime,
                workflow="pathoscope",
                ready=True,
                sample=str(sample.id),
                sample_id=sample.id,
                reference="baz",
                reference_id=reference_baz.id,
                index=str(index.id),
                index_id=index_pg_id,
                user_id=user_1.id,
            ),
            SQLAnalysis(
                legacy_id="test_3",
                created_at=static_time.datetime,
                updated_at=static_time.datetime,
                workflow="pathoscope",
                ready=True,
                sample=str(sample.id),
                sample_id=sample.id,
                reference="foo",
                reference_id=reference_foo.id,
                index=str(index.id),
                index_id=index_pg_id,
                user_id=user_2.id,
            ),
            SQLAnalysis(
                legacy_id="test_4",
                created_at=static_time.datetime,
                updated_at=static_time.datetime,
                workflow="pathoscope",
                ready=True,
                sample="test-not-found",
                reference="foo",
                reference_id=reference_foo.id,
                index=str(index.id),
                index_id=index_pg_id,
                user_id=user_2.id,
            ),
        ]

        session.add_all(analyses)
        await session.flush()

        session.add_all(
            SQLAnalysisSubtraction(
                analysis_id=analysis.id,
                subtraction_id=malus.id,
            )
            for analysis in analyses
            if analysis.legacy_id in {"test_2", "test_3", "test_4"}
        )

        await session.commit()

    resp = await client.get(f"/samples/{sample.id}/analyses")

    assert resp.status == HTTPStatus.OK
    assert await resp.json() == snapshot


class TestAnalyze:
    @pytest.fixture
    async def analyze_client(
        self,
        spawn_client: ClientSpawner,
    ) -> VirtoolTestClient:
        client = await spawn_client(authenticated=True)
        client.app["jobs"] = MockJobInterface()

        return client

    @staticmethod
    async def _insert_reference(fake: DataFaker) -> tuple[Reference, User]:
        user = await fake.users.create()
        reference = await fake.references.create(user=user, name="Test Reference")
        return reference, user

    @staticmethod
    async def _insert_index(
        fake: DataFaker,
        reference: Reference,
        user: User,
        *,
        ready: bool = True,
    ) -> None:
        await fake.indexes.create(reference, user, version=4, ready=ready)

    @staticmethod
    async def _insert_subtraction(pg: AsyncEngine) -> None:
        async with AsyncSession(pg) as session:
            session.add(
                SQLSubtraction(
                    legacy_id="subtraction_1",
                    name="Subtraction 1",
                    created_at=datetime(2015, 10, 6, 20, 0, 0),
                    ready=True,
                ),
            )

            await session.commit()

    @staticmethod
    async def _insert_sample(client: VirtoolTestClient, fake: DataFaker) -> int:
        owner = await get_data_from_app(client.app).users.get(client.user.id)
        return (await fake.samples.create(owner, ready=True)).id

    @staticmethod
    async def _post(client: VirtoolTestClient, ref_id: str, sample_id: int):
        return await client.post(
            f"/samples/{sample_id}/analyses",
            data={
                "workflow": "pathoscope",
                "ref_id": ref_id,
                "subtractions": [1],
            },
        )

    async def test_ok(
        self,
        analyze_client: VirtoolTestClient,
        fake: DataFaker,
        pg: AsyncEngine,
        snapshot: SnapshotAssertion,
        static_time,
    ):
        reference, reference_owner = await self._insert_reference(fake)
        await self._insert_index(fake, reference, reference_owner)
        await self._insert_subtraction(pg)
        sample_id = await self._insert_sample(analyze_client, fake)

        resp = await self._post(analyze_client, reference.id, sample_id)

        assert resp.status == 201
        assert resp.headers["Location"] == "/analyses/1"
        assert await resp.json() == snapshot

    async def test_missing_reference(
        self,
        analyze_client: VirtoolTestClient,
        fake: DataFaker,
        pg: AsyncEngine,
        resp_is,
        static_time,
    ):
        await self._insert_subtraction(pg)
        sample_id = await self._insert_sample(analyze_client, fake)

        resp = await self._post(analyze_client, "does_not_exist", sample_id)

        await resp_is.conflict(resp, "Reference does not exist")

    async def test_archived_reference(
        self,
        analyze_client: VirtoolTestClient,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
        resp_is,
        static_time,
    ):
        reference, reference_owner = await self._insert_reference(fake)
        await data_layer.references.archive(reference.id)
        await self._insert_index(fake, reference, reference_owner)
        await self._insert_subtraction(pg)
        sample_id = await self._insert_sample(analyze_client, fake)

        resp = await self._post(analyze_client, reference.id, sample_id)

        await resp_is.conflict(resp, "Reference is archived")

    async def test_no_index(
        self,
        analyze_client: VirtoolTestClient,
        fake: DataFaker,
        pg: AsyncEngine,
        resp_is,
        static_time,
    ):
        reference, reference_owner = await self._insert_reference(fake)
        await self._insert_subtraction(pg)
        sample_id = await self._insert_sample(analyze_client, fake)

        resp = await self._post(analyze_client, reference.id, sample_id)

        await resp_is.conflict(resp, "No ready index")

    async def test_unbuilt_index(
        self,
        analyze_client: VirtoolTestClient,
        fake: DataFaker,
        pg: AsyncEngine,
        resp_is,
        static_time,
    ):
        reference, reference_owner = await self._insert_reference(fake)
        await self._insert_index(fake, reference, reference_owner, ready=False)
        await self._insert_subtraction(pg)
        sample_id = await self._insert_sample(analyze_client, fake)

        resp = await self._post(analyze_client, reference.id, sample_id)

        await resp_is.conflict(resp, "No ready index")

    async def test_missing_subtraction(
        self,
        analyze_client: VirtoolTestClient,
        fake: DataFaker,
        resp_is,
        static_time,
    ):
        reference, reference_owner = await self._insert_reference(fake)
        await self._insert_index(fake, reference, reference_owner)
        sample_id = await self._insert_sample(analyze_client, fake)

        resp = await self._post(analyze_client, reference.id, sample_id)

        await resp_is.conflict(resp, "Subtractions do not exist: 1")

    async def test_missing_sample(
        self,
        analyze_client: VirtoolTestClient,
        fake: DataFaker,
        pg: AsyncEngine,
        resp_is,
        static_time,
    ):
        reference, reference_owner = await self._insert_reference(fake)
        await self._insert_index(fake, reference, reference_owner)
        await self._insert_subtraction(pg)

        resp = await self._post(analyze_client, reference.id, 999999)

        await resp_is.not_found(resp)

    async def test_iimi_rejected(
        self,
        analyze_client: VirtoolTestClient,
        fake: DataFaker,
        pg: AsyncEngine,
        static_time,
    ):
        reference, reference_owner = await self._insert_reference(fake)
        await self._insert_index(fake, reference, reference_owner)
        await self._insert_subtraction(pg)
        sample_id = await self._insert_sample(analyze_client, fake)

        resp = await analyze_client.post(
            f"/samples/{sample_id}/analyses",
            data={
                "workflow": "iimi",
                "ref_id": reference.id,
                "subtractions": ["subtraction_1"],
            },
        )

        assert resp.status == 400


class TestUploadArtifact:
    """Test that new artifacts can be uploaded after sample creation using the Jobs API."""

    @staticmethod
    async def _post(
        client: VirtoolTestClient,
        path: Path,
        artifact_type: str,
        sample_id: int,
    ):
        return await client.post(
            f"/samples/{sample_id}/artifacts?name=small.fq.gz&type={artifact_type}",
            data={"file": open(path, "rb")},
        )

    async def test_ok(
        self,
        example_path: Path,
        fake: DataFaker,
        snapshot: SnapshotAssertion,
        spawn_job_client: JobClientSpawner,
        static_time,
    ):
        """An uploaded artifact downloads with the bytes it was uploaded with."""
        user = await fake.users.create()
        sample = await fake.samples.create(user, ready=True)

        client = await spawn_job_client(authenticated=True)

        path = example_path / "sample" / "reads_1.fq.gz"
        resp = await self._post(client, path, "fastq", sample.id)

        assert resp.status == 201
        assert await resp.json() == snapshot

        download = await client.get(f"/samples/{sample.id}/artifacts/small.fq.gz")

        assert download.status == 200
        assert await download.content.read() == path.read_bytes()

    async def test_not_found(
        self,
        example_path: Path,
        resp_is,
        spawn_job_client: JobClientSpawner,
        static_time,
    ):
        client = await spawn_job_client(authenticated=True)

        resp = await self._post(
            client,
            example_path / "sample" / "reads_1.fq.gz",
            "fastq",
            sample_id=999999,
        )

        await resp_is.not_found(resp)

    async def test_unsupported_type(
        self,
        example_path: Path,
        fake: DataFaker,
        resp_is,
        spawn_job_client: JobClientSpawner,
        static_time,
    ):
        user = await fake.users.create()
        sample = await fake.samples.create(user, ready=True)

        client = await spawn_job_client(authenticated=True)

        resp = await self._post(
            client, example_path / "sample" / "reads_1.fq.gz", "foo", sample.id
        )

        await resp_is.bad_request(resp, "Unsupported sample artifact type")

    async def test_duplicate_upload(
        self,
        example_path: Path,
        fake: DataFaker,
        resp_is,
        spawn_job_client: JobClientSpawner,
        static_time,
    ):
        user = await fake.users.create()
        sample = await fake.samples.create(user, ready=True)

        client = await spawn_job_client(authenticated=True)

        path = example_path / "sample" / "reads_1.fq.gz"

        resp_1 = await self._post(client, path, "fastq", sample.id)
        assert resp_1.status == 201

        resp_2 = await self._post(client, path, "fastq", sample.id)

        await resp_is.conflict(
            resp_2,
            "Artifact file has already been uploaded for this sample",
        )


class TestUploadReads:
    async def test(
        self,
        example_path: Path,
        fake: DataFaker,
        snapshot: SnapshotAssertion,
        spawn_job_client: JobClientSpawner,
    ):
        """Paired reads uploaded to a sample download back byte-for-byte, and a
        repeat upload of the same file conflicts.
        """
        user = await fake.users.create()
        sample = await fake.samples.create(user, ready=False)

        client = await spawn_job_client(authenticated=True)

        path_1 = example_path / "sample" / "reads_1.fq.gz"
        path_2 = example_path / "sample" / "reads_2.fq.gz"

        resp_1 = await client.put(
            f"/samples/{sample.id}/reads/reads_1.fq.gz",
            data={"file": open(path_1, "rb")},
        )
        resp_2 = await client.put(
            f"/samples/{sample.id}/reads/reads_2.fq.gz",
            data={"file": open(path_2, "rb")},
        )

        assert resp_1.status == resp_2.status == 201

        download_1 = await client.get(f"/samples/{sample.id}/reads/reads_1.fq.gz")
        download_2 = await client.get(f"/samples/{sample.id}/reads/reads_2.fq.gz")

        assert download_1.status == download_2.status == 200
        assert await download_1.content.read() == path_1.read_bytes()
        assert await download_2.content.read() == path_2.read_bytes()

        resp_3 = await client.put(
            f"/samples/{sample.id}/reads/reads_2.fq.gz",
            data={"file": open(path_2, "rb")},
        )

        assert resp_3.status == 409
        assert await resp_3.json() == snapshot(name="409")

    async def test_not_found(
        self,
        example_path: Path,
        resp_is,
        spawn_job_client: JobClientSpawner,
    ):
        client = await spawn_job_client(authenticated=True)

        resp = await client.put(
            "/samples/999999/reads/reads_1.fq.gz",
            data={"file": open(example_path / "sample" / "reads_1.fq.gz", "rb")},
        )

        await resp_is.not_found(resp)

    async def test_uncompressed(
        self,
        example_path: Path,
        fake: DataFaker,
        snapshot: SnapshotAssertion,
        spawn_job_client: JobClientSpawner,
    ):
        """An uncompressed reads upload is rejected and leaves nothing to download."""
        user = await fake.users.create()
        sample = await fake.samples.create(user, ready=False)
        upload = await fake.uploads.create(user=user)

        client = await spawn_job_client(authenticated=True)

        resp = await client.put(
            f"/samples/{sample.id}/reads/reads_1.fq.gz?upload={upload.id}",
            data={
                "file": gzip.open(example_path / "sample" / "reads_1.fq.gz", "rb"),
            },
        )

        assert resp.status == 400
        assert await resp.json() == snapshot

        download = await client.get(f"/samples/{sample.id}/reads/reads_1.fq.gz")
        assert download.status == 404

    async def test_empty(
        self,
        fake: DataFaker,
        snapshot: SnapshotAssertion,
        spawn_job_client: JobClientSpawner,
    ):
        """An empty reads upload is rejected and leaves nothing to download."""
        user = await fake.users.create()
        sample = await fake.samples.create(user, ready=False)

        client = await spawn_job_client(authenticated=True)

        resp = await client.put(
            f"/samples/{sample.id}/reads/reads_1.fq.gz",
            data={"file": io.BytesIO(b"")},
        )

        assert resp.status == 400
        assert await resp.json() == snapshot

        download = await client.get(f"/samples/{sample.id}/reads/reads_1.fq.gz")
        assert download.status == 404


class TestJobRemove:
    """Test removal of unfinalized samples over the Jobs API."""

    async def setup_sample(
        self,
        fake: DataFaker,
        spawn_job_client: JobClientSpawner,
        finalized: bool,
        job_state: JobState,
    ) -> tuple[VirtoolTestClient, int]:
        """Create a sample with a creation job in ``job_state`` and return its id.

        When ``finalized`` is ``True`` the sample is ready and deletion is blocked by
        the ready check before job state matters, so the job is left untouched.
        """
        client = await spawn_job_client(authenticated=True)

        user = await fake.users.create()

        sample = await fake.samples.create(user, ready=finalized)

        if not finalized:
            await _drive_sample_job(client.app, sample, job_state)

        return client, sample.id

    async def test_ok(
        self,
        fake: DataFaker,
        spawn_job_client: JobClientSpawner,
    ):
        """An unfinalized sample addressed by integer id can be removed."""
        client, sample_id = await self.setup_sample(
            fake,
            spawn_job_client,
            finalized=False,
            job_state=JobState.FAILED,
        )

        resp = await client.delete(f"/samples/{sample_id}")

        assert resp.status == 204

    async def test_finalized(
        self,
        fake: DataFaker,
        resp_is,
        spawn_job_client: JobClientSpawner,
    ):
        client, sample_id = await self.setup_sample(
            fake,
            spawn_job_client,
            finalized=True,
            job_state=JobState.SUCCEEDED,
        )

        resp = await client.delete(f"/samples/{sample_id}")

        await resp_is.bad_request(resp, "Only unfinalized samples can be deleted")

    async def test_active_job(
        self,
        fake: DataFaker,
        resp_is,
        spawn_job_client: JobClientSpawner,
    ):
        client, sample_id = await self.setup_sample(
            fake,
            spawn_job_client,
            finalized=False,
            job_state=JobState.RUNNING,
        )

        resp = await client.delete(f"/samples/{sample_id}")

        await resp_is.bad_request(
            resp,
            "Cannot delete sample with active job (current state: running)",
        )

    async def test_not_found(
        self,
        resp_is,
        spawn_job_client: JobClientSpawner,
    ):
        client = await spawn_job_client(authenticated=True)

        resp = await client.delete("/samples/999999")

        await resp_is.not_found(resp)


class TestDownloadReads:
    @pytest.mark.parametrize("suffix", ["1", "2"])
    async def test_ok(
        self,
        suffix: str,
        fake: DataFaker,
        spawn_client: ClientSpawner,
        spawn_job_client: JobClientSpawner,
    ):
        """Reads on a ready sample download over both the public and jobs APIs."""
        user = await fake.users.create()
        sample = await fake.samples.create(user, paired=True, ready=True)

        client = await spawn_client(authenticated=True)
        job_client = await spawn_job_client(authenticated=True)

        file_name = f"reads_{suffix}.fq.gz"

        resp = await client.get(f"/samples/{sample.id}/reads/{file_name}")
        job_resp = await job_client.get(f"/samples/{sample.id}/reads/{file_name}")

        assert resp.status == job_resp.status == HTTPStatus.OK
        assert await resp.content.read()
        assert await job_resp.content.read()

    async def test_404_sample(
        self,
        spawn_client: ClientSpawner,
        spawn_job_client: JobClientSpawner,
    ):
        client = await spawn_client(authenticated=True)
        job_client = await spawn_job_client(authenticated=True)

        resp = await client.get("/samples/999999/reads/reads_1.fq.gz")
        job_resp = await job_client.get("/samples/999999/reads/reads_1.fq.gz")

        assert resp.status == job_resp.status == 404

    async def test_404_reads(
        self,
        fake: DataFaker,
        spawn_client: ClientSpawner,
        spawn_job_client: JobClientSpawner,
    ):
        """Downloading a reads file that was never uploaded returns 404."""
        user = await fake.users.create()
        sample = await fake.samples.create(user, ready=False)

        client = await spawn_client(authenticated=True)
        job_client = await spawn_job_client(authenticated=True)

        resp = await client.get(f"/samples/{sample.id}/reads/reads_1.fq.gz")
        job_resp = await job_client.get(f"/samples/{sample.id}/reads/reads_1.fq.gz")

        assert resp.status == job_resp.status == 404

    async def test_missing_blob_is_server_error(
        self,
        fake: DataFaker,
        memory_storage,
        spawn_client: ClientSpawner,
        spawn_job_client: JobClientSpawner,
    ):
        """A reads row that resolves but whose blob is missing is a server-side
        data-integrity bug, returning 500 rather than a client-facing 404.

        This state is unreachable through the API, so it is injected by deleting a
        ready sample's blob out from under its resolvable row.
        """
        user = await fake.users.create()
        sample = await fake.samples.create(user, ready=True)

        file_name = "reads_1.fq.gz"
        await memory_storage.delete(
            sample_file_key(sample_storage_id(sample.id, None), file_name),
        )

        client = await spawn_client(authenticated=True)
        job_client = await spawn_job_client(authenticated=True)

        resp = await client.get(f"/samples/{sample.id}/reads/{file_name}")
        job_resp = await job_client.get(f"/samples/{sample.id}/reads/{file_name}")

        assert resp.status == job_resp.status == 500


class TestDownloadArtifact:
    @staticmethod
    async def _upload_artifact(
        client: VirtoolTestClient,
        example_path: Path,
        sample_id: int,
    ) -> bytes:
        """Upload an artifact to a sample over the jobs API and return its bytes."""
        payload = (example_path / "sample" / "reads_1.fq.gz").read_bytes()

        resp = await client.post(
            f"/samples/{sample_id}/artifacts?name=fastqc.txt&type=fastq",
            data={"file": io.BytesIO(payload)},
        )

        assert resp.status == 201

        return payload

    async def test_ok(
        self,
        example_path: Path,
        fake: DataFaker,
        spawn_job_client: JobClientSpawner,
    ):
        """An uploaded artifact downloads with the bytes it was uploaded with."""
        user = await fake.users.create()
        sample = await fake.samples.create(user, ready=True)

        client = await spawn_job_client(authenticated=True)
        payload = await self._upload_artifact(client, example_path, sample.id)

        resp = await client.get(f"/samples/{sample.id}/artifacts/fastqc.txt")

        assert resp.status == HTTPStatus.OK
        assert await resp.content.read() == payload

    async def test_404_sample(
        self,
        spawn_job_client: JobClientSpawner,
    ):
        client = await spawn_job_client(authenticated=True)

        resp = await client.get("/samples/999999/artifacts/fastqc.txt")

        assert resp.status == 404

    async def test_404_artifact(
        self,
        fake: DataFaker,
        spawn_job_client: JobClientSpawner,
    ):
        """Downloading an artifact that was never uploaded returns 404."""
        user = await fake.users.create()
        sample = await fake.samples.create(user, ready=True)

        client = await spawn_job_client(authenticated=True)

        resp = await client.get(f"/samples/{sample.id}/artifacts/fastqc.txt")

        assert resp.status == 404

    async def test_missing_blob_is_server_error(
        self,
        example_path: Path,
        fake: DataFaker,
        memory_storage,
        spawn_job_client: JobClientSpawner,
    ):
        """An artifact row that resolves but whose blob is missing is a server-side
        data-integrity bug, returning 500 rather than a client-facing 404.

        This state is unreachable through the API, so it is injected by deleting an
        uploaded artifact's blob out from under its resolvable row.
        """
        user = await fake.users.create()
        sample = await fake.samples.create(user, ready=True)

        client = await spawn_job_client(authenticated=True)
        await self._upload_artifact(client, example_path, sample.id)

        await memory_storage.delete(
            sample_file_key(sample_storage_id(sample.id, None), "fastqc.txt"),
        )

        resp = await client.get(f"/samples/{sample.id}/artifacts/fastqc.txt")

        assert resp.status == 500
