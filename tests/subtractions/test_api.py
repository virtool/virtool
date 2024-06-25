import os
from pathlib import Path

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy.assertion import SnapshotAssertion
from virtool_core.models.enums import Permission

from tests.fixtures.client import ClientSpawner, JobClientSpawner
from virtool.config import get_config_from_app
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
async def test_delete_by_user(
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


class TestUploadSubtractionFile:
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

    @pytest.fixture(autouse=True)
    async def _setup(
        self,
        fake: DataFaker,
        tmp_path: Path,
    ):
        test_dir: Path = tmp_path / "files"
        test_dir.mkdir(exist_ok=True)

        self.test_file_directory: Path = test_dir
        self.test_subtraction_file_directory: Path = tmp_path / "subtractions"

        self.VALID_SUBTRACTION_FILE_NAME = "subtraction.1.bt2"
        self.INVALID_SUBTRACTION_FILE_NAME = "reference.1.bt2"

        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )

        self.subtraction = await fake.subtractions.create(user=user, upload=upload)

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

    async def test_create(
        self,
        spawn_job_client: JobClientSpawner,
        snapshot_recent: SnapshotAssertion,
    ):
        client = await spawn_job_client(authenticated=True)

        resp = await client.put(
            f"/subtractions/{self.subtraction.id}/files/{self.VALID_SUBTRACTION_FILE_NAME}",
            data={"file": bytes(1)},
        )

        assert resp.status == 201
        assert await resp.json() == snapshot_recent
        assert os.listdir(
            self.test_subtraction_file_directory / self.subtraction.id,
        ) == [
            self.VALID_SUBTRACTION_FILE_NAME,
        ]

    async def test_subtraction_file_invalid_name_error(
        self,
        spawn_job_client: JobClientSpawner,
        resp_is,
    ):
        client = await spawn_job_client(authenticated=True)

        resp = await client.put(
            f"/subtractions/{self.subtraction.id}/files/{self.subtraction.id}",
            data={"file": bytes(1)},
        )

        await resp_is.not_found(resp, "Unsupported subtraction file name")

    async def test_subtraction_file_name_conflict_error(
        self,
        spawn_job_client: JobClientSpawner,
        resp_is,
    ):
        client = await spawn_job_client(authenticated=True)

        resp = await client.put(
            f"/subtractions/{self.subtraction.id}/files/{self.VALID_SUBTRACTION_FILE_NAME}",
            data={"file": bytes(1)},
        )

        resp = await client.put(
            f"/subtractions/{self.subtraction.id}/files/{self.VALID_SUBTRACTION_FILE_NAME}",
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

    async def test_finalize_subtraction_invalid_input_error(
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


@pytest.mark.parametrize("error", [None, "400_subtraction", "400_file", "400_path"])
async def test_download_subtraction_files(
    error,
    mongo,
    pg: AsyncEngine,
    spawn_job_client,
    tmp_path,
):
    client = await spawn_job_client(authenticated=True)

    get_config_from_app(client.app).data_path = tmp_path

    test_dir = tmp_path / "subtractions" / "foo"
    test_dir.mkdir(parents=True)

    if error != "400_path":
        test_dir.joinpath("subtraction.fa.gz").write_text("FASTA file")
        test_dir.joinpath("subtraction.1.bt2").write_text("Bowtie2 file")

    if error != "400_subtraction":
        await mongo.subtraction.insert_one({"_id": "foo", "name": "Foo"})

    if error != "400_file":
        async with AsyncSession(pg) as session:
            session.add_all(
                [
                    SQLSubtractionFile(
                        id=1,
                        name="subtraction.fa.gz",
                        subtraction="foo",
                        type="fasta",
                    ),
                    SQLSubtractionFile(
                        id=2,
                        name="subtraction.1.bt2",
                        subtraction="foo",
                        type="bowtie2",
                    ),
                ],
            )
            await session.commit()

    fasta_resp = await client.get("/subtractions/foo/files/subtraction.fa.gz")
    bowtie_resp = await client.get("/subtractions/foo/files/subtraction.1.bt2")

    if not error:
        assert fasta_resp.status == bowtie_resp.status == 200
    else:
        assert fasta_resp.status == bowtie_resp.status == 404
        return

    path = get_config_from_app(client.app).data_path / "subtractions" / "foo"

    assert (path / "subtraction.fa.gz").read_bytes() == await fasta_resp.content.read()
    assert (path / "subtraction.1.bt2").read_bytes() == await bowtie_resp.content.read()


class TestDownloadSubtractionF:
    @pytest.fixture(autouse=True)
    async def _setup(
        self,
        fake: DataFaker,
        tmp_path: Path,
    ):
        self.FASTA_FILE = "subtraction.fa.gz"
        self.BOWTIE2_FILE = "subtraction.1.bt2"

        self.FASTA_TEXT = "fasta"
        self.BOWTIE2_TEXT = "bowtie"

        self.user = await fake.users.create()
        upload = await fake.uploads.create(
            user=self.user,
            upload_type=UploadType.subtraction,
        )

        self.subtraction = await fake.subtractions.create(user=self.user, upload=upload)

        self.test_dir: Path = tmp_path / "subtractions" / self.subtraction.id
        self.test_dir.mkdir(exist_ok=True, parents=True)

    async def _write_files(self):
        self.test_dir.joinpath(self.FASTA_FILE).write_text(self.FASTA_TEXT)
        self.test_dir.joinpath(self.BOWTIE2_FILE).write_text(self.BOWTIE2_TEXT)

    async def _assert_response(self, fasta_resp, bowtie_resp):
        assert await fasta_resp.text() == self.FASTA_TEXT
        assert await bowtie_resp.text() == self.BOWTIE2_TEXT
        assert (
            self.test_dir / self.FASTA_FILE
        ).read_bytes() == await fasta_resp.content.read()
        assert (
            self.test_dir / self.BOWTIE2_FILE
        ).read_bytes() == await bowtie_resp.content.read()

    async def test_not_found_subtraction(
        self,
        spawn_job_client: JobClientSpawner,
    ):
        await self._write_files()

        client = await spawn_job_client(authenticated=True)

        fasta_resp = await client.get(
            f"/subtractions/does_not_exist/files/{self.FASTA_FILE}",
        )
        bowtie_resp = await client.get(
            f"/subtractions/does_not_exist/files/{self.BOWTIE2_FILE}",
        )

        assert fasta_resp.status == 404
        assert bowtie_resp.status == 404

    async def test_not_found_file(
        self,
        spawn_job_client: JobClientSpawner,
    ):
        await self._write_files()

        client = await spawn_job_client(authenticated=True)
        fasta_resp = await client.get(
            f"/subtractions/{self.subtraction.id}/files/{self.FASTA_FILE}",
        )
        bowtie_resp = await client.get(
            f"/subtractions/{self.subtraction.id}/files/{self.BOWTIE2_FILE}",
        )
        assert fasta_resp.status == 404
        assert bowtie_resp.status == 404

    async def test_not_found_path(
        self,
        spawn_job_client: JobClientSpawner,
    ):
        client = await spawn_job_client(authenticated=True)
        fasta_resp = await client.get(
            f"/subtractions/{self.subtraction.id}/files/{self.FASTA_FILE}",
        )
        bowtie_resp = await client.get(
            f"/subtractions/{self.subtraction.id}/files/{self.BOWTIE2_FILE}",
        )
        assert fasta_resp.status == 404
        assert bowtie_resp.status == 404

    async def test_success(
        self,
        spawn_job_client: JobClientSpawner,
    ):
        await self._write_files()

        client = await spawn_job_client(authenticated=True)

        fasta_resp = await client.get(
            f"/subtractions/{self.subtraction.id}/files/{self.FASTA_FILE}",
        )
        bowtie_resp = await client.get(
            f"/subtractions/{self.subtraction.id}/files/{self.BOWTIE2_FILE}",
        )

        assert fasta_resp.status == 200
        assert bowtie_resp.status == 200
        await self._assert_response(fasta_resp, bowtie_resp)


async def test_create(
    fake: DataFaker,
    mongo: Mongo,
    spawn_client: ClientSpawner,
    mocker,
    snapshot_recent: SnapshotAssertion,
):
    user = await fake.users.create()
    upload = await fake.uploads.create(
        user=user,
        upload_type=UploadType.subtraction,
    )

    mocker.patch("virtool.mongo.utils.get_new_id", return_value="abc123")

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
    assert await resp.json() == snapshot_recent
    assert await mongo.jobs.find_one() == snapshot_recent(name="job")
