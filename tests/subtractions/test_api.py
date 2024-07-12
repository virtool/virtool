from dataclasses import dataclass
import os
from pathlib import Path

import pytest
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy.assertion import SnapshotAssertion
from virtool_core.models.enums import Permission

from tests.fixtures.client import ClientSpawner, JobClientSpawner
from virtool.fake.next import DataFaker
from virtool.mongo.core import Mongo
from virtool.subtractions.models import SQLSubtractionFile
from virtool.uploads.models import UploadType


async def test_find_empty_subtractions(
    snapshot,
    spawn_client: ClientSpawner,
):
    client = await spawn_client(authenticated=True)

    resp = await client.get("/subtractions")

    assert resp.status == 200
    assert await resp.json() == snapshot


@pytest.mark.parametrize(("per_page", "page"), [(None, None), (2, 1), (2, 2)])
async def test_find(
    page: int | None,
    per_page: int | None,
    fake: DataFaker,
    snapshot_recent: SnapshotAssertion,
    spawn_client: ClientSpawner,
):
    client = await spawn_client(authenticated=True)

    user = await fake.users.create()
    upload = await fake.uploads.create(
        user=user,
        upload_type=UploadType.subtraction,
    )

    for _ in range(5):
        await fake.subtractions.create(user=user, upload=upload)

    query = []
    path = "/subtractions"

    if per_page is not None:
        query.append(f"per_page={per_page}")

    if page is not None:
        query.append(f"page={page}")
        path += f"?{'&'.join(query)}"

    resp = await client.get(path)

    assert resp.status == 200
    assert await resp.json() == snapshot_recent


async def test_get(
    fake: DataFaker,
    spawn_client: ClientSpawner,
    snapshot_recent: SnapshotAssertion,
):
    client = await spawn_client(authenticated=True)

    user = await fake.users.create()
    upload = await fake.uploads.create(
        user=user,
        upload_type=UploadType.subtraction,
    )

    subtraction = await fake.subtractions.create(user=user, upload=upload)

    resp = await client.get(f"/subtractions/{subtraction.id}")

    assert resp.status == 200
    assert await resp.json() == snapshot_recent


async def test_get_from_job(fake: DataFaker, spawn_job_client, snapshot_recent):
    client = await spawn_job_client(authenticated=True)

    user = await fake.users.create()
    upload = await fake.uploads.create(
        user=user,
        upload_type=UploadType.subtraction,
    )
    subtraction = await fake.subtractions.create(user=user, upload=upload)

    resp = await client.get(f"/subtractions/{subtraction.id}")

    assert resp.status == 200
    assert await resp.json() == snapshot_recent


@pytest.mark.parametrize(
    "data",
    [
        {"name": "Bar"},
        {"nickname": "Bar Subtraction"},
        {"nickname": ""},
        {"name": "Bar", "nickname": "Bar Subtraction"},
    ],
)
async def test_edit(
    data: dict,
    fake: DataFaker,
    mongo: Mongo,
    snapshot_recent: SnapshotAssertion,
    spawn_client: ClientSpawner,
):
    user = await fake.users.create()
    upload = await fake.uploads.create(
        user=user,
        upload_type=UploadType.subtraction,
    )

    subtraction = await fake.subtractions.create(user=user, upload=upload)

    await mongo.samples.insert_many(
        [
            {"_id": "12", "name": "Sample 12", "subtractions": [subtraction.id]},
            {"_id": "22", "name": "Sample 22", "subtractions": [subtraction.id]},
        ],
        session=None,
    )

    client = await spawn_client(
        authenticated=True,
        permissions=[Permission.modify_subtraction],
    )

    resp = await client.patch(f"/subtractions/{subtraction.id}", data)

    assert resp.status == 200
    assert await resp.json() == snapshot_recent
    assert await mongo.subtraction.find_one() == snapshot_recent


@pytest.mark.parametrize("exists", [True, False])
async def test_delete_as_user(
    exists: bool,
    fake: DataFaker,
    spawn_client: ClientSpawner,
):
    client = await spawn_client(
        authenticated=True,
        permissions=[Permission.modify_subtraction],
    )

    if exists:
        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )
        subtraction = await fake.subtractions.create(
            user=user,
            upload=upload,
            finalized=True,
        )

        resp = await client.delete(f"subtractions/{subtraction.id}")

        assert resp.status == 204
    else:
        resp = await client.delete("subtractions/does_not_exist")
        assert resp.status == 404


class TestUploadSubtractionFileAsJob:
    """
    Test suite for uploading subtraction files.

    Fixtures:
        - setup: Prepares the test environment, creating necessary directories and test data.

    Test cases:
        - test_not_found: Verifies the API response when attempting to upload to a non-existent subtraction.
        - test_create: Checks successful creation of a subtraction file.
        - test_subtraction_file_invalid_name_error: Ensures proper handling of invalid file names.
        - test_subtraction_file_name_conflict_error: Verifies handling of file name conflicts.
    """

    VALID_SUBTRACTION_FILE_NAME = "subtraction.1.bt2"
    INVALID_SUBTRACTION_FILE_NAME = "reference.1.bt2"

    @dataclass
    class Context:
        file_directory: Path
        subtraction_directory: Path

    async def ctx(
        self,
        tmp_path: Path,
    ):
        test_dir: Path = tmp_path / "files"
        test_dir.mkdir(exist_ok=True)

        file_directory: Path = test_dir
        subtraction_directory: Path = tmp_path / "subtractions"

        return self.Context(
            file_directory=file_directory,
            subtraction_directory=subtraction_directory,
        )

    async def test_create(
        self,
        ctx: Context,
        fake: DataFaker,
        spawn_job_client: JobClientSpawner,
        snapshot_recent: SnapshotAssertion,
    ):
        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )

        subtraction = await fake.subtractions.create(
            user=user,
            upload=upload,
            finalized=False,
        )

        client = await spawn_job_client(authenticated=True)

        resp = await client.put(
            f"/subtractions/{subtraction.id}/files/{self.VALID_SUBTRACTION_FILE_NAME}",
            data={"file": bytes(1)},
        )

        assert resp.status == 201
        assert await resp.json() == snapshot_recent
        assert os.listdir(
            ctx.subtraction_directory / subtraction.id,
        ) == [
            self.VALID_SUBTRACTION_FILE_NAME,
        ]

    async def test_not_found(
        self,
        spawn_job_client: JobClientSpawner,
        resp_is,
    ):
        client = await spawn_job_client(authenticated=True)

        resp = await client.put(
            f"/subtractions/does_not_exist/files/{self.VALID_SUBTRACTION_FILE_NAME}",
            data={"file": bytes(1)},
        )

        await resp_is.not_found(resp)

    async def test_invalid_input(
        self,
        spawn_job_client: JobClientSpawner,
        resp_is,
    ):
        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )

        subtraction = await fake.subtractions.create(
            user=user,
            upload=upload,
            finalized=False,
        )

        client = await spawn_job_client(authenticated=True)

        resp = await client.put(
            f"/subtractions/{subtraction.id}/files/invalid_input"
            data={"file": bytes(1)},
        )

        await resp_is.not_found(resp, "Unsupported subtraction file name")

    async def test_conflict(
        self,
        spawn_job_client: JobClientSpawner,
        resp_is,
    ):
        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )

        subtraction = await fake.subtractions.create(
            user=user,
            upload=upload,
            finalized=False,
        )

        client = await spawn_job_client(authenticated=True)

        resp = await client.put(
            f"/subtractions/{subtraction.id}/files/{self.VALID_SUBTRACTION_FILE_NAME}",
            data={"file": bytes(1)},
        )

        resp = await client.put(
            f"/subtractions/{subtraction.id}/files/{self.VALID_SUBTRACTION_FILE_NAME}",
            data={"file": bytes(1)},
        )

        await resp_is.conflict(resp, "File name already exists")


class TestFinalize:
    """
    Test suite for finalizing subtractions.

    Test cases:
        - test_success: Verifies successful finalization of a subtraction.
        - test_not_found: Checks the API response when attempting to finalize a non-existent subtraction.
        - test_conflict: Ensures proper handling when attempting to finalize an already finalized subtraction.
        - test_finalize_subtraction_invalid_input_error: Verifies error handling for invalid input during finalization.
    """

    async def test_success(
        self,
        fake: DataFaker,
        spawn_job_client: JobClientSpawner,
        snapshot_recent: SnapshotAssertion,
    ):
        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )
        subtraction = await fake.subtractions.create(
            user=user,
            upload=upload,
            finalized=False,
            uploaded=False,
        )

        client = await spawn_job_client(authenticated=True)

        data = {
            "gc": {"a": 0.319, "t": 0.319, "g": 0.18, "c": 0.18, "n": 0.002},
            "count": 100,
        }

        resp = await client.patch(f"/subtractions/{subtraction.id}", json=data)

        assert resp.status == 200
        assert await resp.json() == snapshot_recent

    async def test_not_found(
        self,
        spawn_job_client: JobClientSpawner,
        snapshot,
    ):
        client = await spawn_job_client(authenticated=True)

        data = {
            "gc": {"a": 0.319, "t": 0.319, "g": 0.18, "c": 0.18, "n": 0.002},
            "count": 100,
        }

        resp = await client.patch("/subtractions/does_not_exist", json=data)

        assert resp.status == 404
        assert await resp.json() == snapshot

    async def test_conflict(
        self,
        fake: DataFaker,
        spawn_job_client: JobClientSpawner,
        snapshot,
    ):
        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )
        subtraction = await fake.subtractions.create(
            user=user,
            upload=upload,
            finalized=True,
        )

        client = await spawn_job_client(authenticated=True)

        data = {
            "gc": {"a": 0.319, "t": 0.319, "g": 0.18, "c": 0.18, "n": 0.002},
            "count": 100,
        }

        resp = await client.patch(f"/subtractions/{subtraction.id}", json=data)

        assert resp.status == 409
        assert await resp.json() == snapshot

    async def test_invalid_input(
        self,
        fake: DataFaker,
        spawn_job_client: JobClientSpawner,
        resp_is,
    ):
        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )
        subtraction = await fake.subtractions.create(
            user=user,
            upload=upload,
            finalized=True,
        )

        client = await spawn_job_client(authenticated=True)

        resp = await client.patch(f"/subtractions/{subtraction.id}", data={})

        await resp_is.invalid_input(
            resp,
            {"gc": ["required field"], "count": ["required field"]},
        )


class TestRemoveAsJob:
    """
    Test suite for removing subtractions when authenticated as a job.

    Test cases:
        - test_remove_ready: Verifies that a finalized subtraction cannot be deleted.
        - test_remove_not_ready: Checks successful deletion of an unfinalized subtraction.
        - test_remove_not_found: Ensures proper handling when attempting to delete a non-existent subtraction.
    """

    async def test_remove_ready(
        self,
        fake: DataFaker,
        spawn_job_client: JobClientSpawner,
        mongo: Mongo,
        resp_is,
    ):
        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )
        subtraction = await fake.subtractions.create(
            user=user,
            upload=upload,
            finalized=True,
        )

        client = await spawn_job_client(authenticated=True)

        await mongo.samples.insert_one(
            {"_id": "test", "name": "Test", "subtractions": [subtraction.id]},
        )

        resp = await client.delete(f"/subtractions/{subtraction.id}")

        await resp_is.conflict(resp, "Only unfinalized subtractions can be deleted")

    async def test_remove_not_ready(
        self,
        fake: DataFaker,
        spawn_job_client: JobClientSpawner,
        mongo: Mongo,
        resp_is,
    ):
        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )
        subtraction = await fake.subtractions.create(
            user=user,
            upload=upload,
            finalized=False,
        )
        await mongo.samples.insert_one(
            {"_id": "test", "name": "Test", "subtractions": [subtraction.id]},
        )

        client = await spawn_job_client(authenticated=True)

        resp = await client.delete(f"/subtractions/{subtraction.id}")

        await resp_is.no_content(resp)

    async def test_remove_not_found(
        self,
        spawn_job_client: JobClientSpawner,
    ):
        client = await spawn_job_client(authenticated=True)
        resp = await client.delete("subtractions/does_not_exist")

        assert resp.status == 404


class TestDownloadSubtractionFile:
    async def test_success(
        self,
        data_path: Path,
        fake: DataFaker,
        spawn_job_client: JobClientSpawner,
    ):
        """Test that Bowtie2 and FASTA subtraction files can be downloaded successfully
        when they are represented in the database and exist on disk.
        """
        client = await spawn_job_client(authenticated=True)

        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )
        subtraction = await fake.subtractions.create(user=user, upload=upload)

        bowtie_resp = await client.get(
            f"/subtractions/{subtraction.id}/files/subtraction.1.bt2",
        )
        fasta_resp = await client.get(
            f"/subtractions/{subtraction.id}/files/subtraction.fa.gz",
        )

        assert bowtie_resp.status == 200
        assert fasta_resp.status == 200

        assert (
            data_path / "subtractions" / subtraction.id / "subtraction.1.bt2"
        ).read_bytes() == await bowtie_resp.content.read()
        assert (
            data_path / "subtractions" / subtraction.id / "subtraction.fa.gz"
        ).read_bytes() == await fasta_resp.content.read()

    async def test_not_found_subtraction(
        self,
        fake: DataFaker,
        spawn_job_client: JobClientSpawner,
    ):
        """Test that a 404 response is returned when attempting to download a
        file for a subtraction does not exist.
        """
        client = await spawn_job_client(authenticated=True)

        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )
        await fake.subtractions.create(user=user, upload=upload)

        fasta_resp = await client.get(
            "/subtractions/does_not_exist/files/subtraction.fa.gz",
        )
        bowtie_resp = await client.get(
            "/subtractions/does_not_exist/files/subtraction.1.bt2",
        )

        assert fasta_resp.status == 404
        assert bowtie_resp.status == 404

    async def test_not_found_file(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
        spawn_job_client: JobClientSpawner,
    ):
        """Test that a 404 response is returned when attempting to download a
        subtraction file that doesn't exist.
        """
        client = await spawn_job_client(authenticated=True)

        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )
        subtraction = await fake.subtractions.create(user=user, upload=upload)

        async with AsyncSession(pg) as session:
            await session.execute(
                delete(SQLSubtractionFile).where(
                    SQLSubtractionFile.subtraction == subtraction.id,
                ),
            )
            await session.commit()

        bowtie_resp = await client.get(
            f"/subtractions/{subtraction.id}/files/subtraction.1.bt2",
        )
        fasta_resp = await client.get(
            f"/subtractions/{subtraction.id}/files/subtraction.fa.gz",
        )

        assert bowtie_resp.status == 404
        assert fasta_resp.status == 404

    async def test_not_found_path(
        self,
        data_path: Path,
        fake: DataFaker,
        spawn_job_client: JobClientSpawner,
    ):
        """Test that a 404 response is returned when attempting to download a file
        that has a database entry but does not exist on disk.
        """
        client = await spawn_job_client(authenticated=True)

        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )
        subtraction = await fake.subtractions.create(user=user, upload=upload)

        Path.unlink(
            data_path / "subtractions" / subtraction.id / "subtraction.1.bt2",
        )

        Path.unlink(
            data_path / "subtractions" / subtraction.id / "subtraction.fa.gz",
        )

        bowtie_resp = await client.get(
            f"/subtractions/{subtraction.id}/files/subtraction.1.bt2",
        )
        fasta_resp = await client.get(
            f"/subtractions/{subtraction.id}/files/subtraction.fa.gz",
        )

        assert bowtie_resp.status == 404
        assert fasta_resp.status == 404


async def test_create(
    fake: DataFaker,
    mongo: Mongo,
    spawn_client: ClientSpawner,
    snapshot_recent: SnapshotAssertion,
):
    user = await fake.users.create()
    upload = await fake.uploads.create(
        user=user,
        upload_type=UploadType.subtraction,
    )

    client = await spawn_client(
        authenticated=True,
        base_url="https://virtool.example.com",
        permissions=[Permission.modify_subtraction],
    )

    resp = await client.post(
        "/subtractions",
        {"name": "Calamus", "nickname": "Rim Palm", "upload_id": upload.id},
    )

    assert resp.status == 201
    assert await resp.json() == snapshot_recent(name="resp")

    assert await mongo.jobs.find_one(
        {},
        projection={"status.timestamp": False},
    ) == snapshot_recent(name="job")
