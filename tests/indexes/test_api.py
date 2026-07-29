import gzip
import json
from http import HTTPStatus
from io import BytesIO
from pathlib import Path

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

from tests.fixtures.client import ClientSpawner, JobClientSpawner
from tests.fixtures.response import RespIs
from virtool.fake.next import DataFaker
from virtool.history.sql import SQLLegacyHistory
from virtool.indexes.constants import INDEX_SQLITE_FILE_NAME
from virtool.indexes.sql import SQLIndex, SQLIndexFile
from virtool.indexes.utils import compose_index_file_key
from virtool.storage.protocol import StorageBackend
from virtool.workflow.pytest_plugin.utils import StaticTime


@pytest.mark.parametrize("error", [None, "404"])
async def test_get(
    error: str | None,
    fake: DataFaker,
    pg: AsyncEngine,
    resp_is: RespIs,
    snapshot: SnapshotAssertion,
    spawn_job_client: JobClientSpawner,
    static_time: StaticTime,
):
    """The index detail aggregates real contributors and modified OTUs from history.

    Contributors and OTU change counts are computed by ``get_contributors`` and
    ``get_otus`` over the ``legacy_history`` rows scoped to the requested index. Rows
    belonging to another index must not leak into either aggregation.
    """
    client = await spawn_job_client(authenticated=True)

    prolific = await fake.users.create()
    occasional = await fake.users.create()

    reference = await fake.references.create(user=prolific)

    job = await fake.jobs.create(user=prolific, workflow="build_index")

    index_id = "missing"

    if not error:
        index = await fake.indexes.create(
            reference,
            prolific,
            job=job,
            manifest={"foo": 2},
            version=0,
        )
        index_id = index.id

        async with AsyncSession(pg) as session:
            session.add_all(
                SQLLegacyHistory(
                    legacy_id=legacy_id,
                    created_at=static_time.datetime,
                    description="Description",
                    method_name="edit",
                    user_id=user_id,
                    otu=otu_id,
                    otu_name=otu_name,
                    otu_version=otu_version,
                    reference_id=reference.id,
                    index_id=row_index_id,
                )
                for legacy_id, row_index_id, otu_id, otu_name, otu_version, user_id in (
                    (
                        "tmv.0",
                        index_id,
                        "tmv",
                        "Tobacco mosaic virus",
                        "0",
                        prolific.id,
                    ),
                    (
                        "tmv.1",
                        index_id,
                        "tmv",
                        "Tobacco mosaic virus",
                        "1",
                        prolific.id,
                    ),
                    ("pvx.0", index_id, "pvx", "Potato virus X", "0", occasional.id),
                    ("other.0", None, "other", "Other virus", "0", occasional.id),
                )
            )
            await session.commit()

    resp = await client.get(f"/indexes/{index_id}")

    if error is None:
        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot
    else:
        await resp_is.not_found(resp)


@pytest.mark.parametrize("file_exists", [True, False])
async def test_download_otus_json(
    file_exists: bool,
    example_path: Path,
    fake: DataFaker,
    memory_storage: StorageBackend,
    mocker: MockerFixture,
    spawn_job_client: JobClientSpawner,
):
    otus_json_path = example_path / "indexes" / "otus.json.gz"

    with gzip.open(otus_json_path, "rt") as f:
        expected = json.load(f)

    async def iter_patched_otus(*_args):
        for otu in expected:
            yield otu

    m_iter_patched_otus = mocker.patch(
        "virtool.indexes.db.iter_patched_otus",
        side_effect=iter_patched_otus,
    )

    client = await spawn_job_client(authenticated=True)

    manifest = {"foo": 2, "bar": 1, "bad": 5}

    user = await fake.users.create()
    reference = await fake.references.create(user=user)
    index = await fake.indexes.create(reference, user, manifest=manifest)

    if file_exists:
        async with AsyncSession(client.app["pg"]) as session:
            storage_key = await session.scalar(
                select(SQLIndex.storage_key).where(SQLIndex.id == index.id),
            )

        key = compose_index_file_key(storage_key, "otus.json.gz")

        async def _stream():
            yield otus_json_path.read_bytes()

        await memory_storage.write(key, _stream())

    async with await client.get(f"/indexes/{index.id}/files/otus.json.gz") as resp:
        with gzip.open(BytesIO(await resp.read())) as f:
            result = json.load(f)

    assert resp.status == HTTPStatus.OK
    assert expected == result

    if file_exists:
        m_iter_patched_otus.assert_not_called()
    else:
        m_iter_patched_otus.assert_called_with(
            client.app["pg"],
            manifest,
        )


@pytest.mark.parametrize("error", [None, 404])
@pytest.mark.usefixtures("static_time")
async def test_delete_index(
    error,
    fake: DataFaker,
    spawn_job_client: JobClientSpawner,
):
    client = await spawn_job_client(authenticated=True)

    user = await fake.users.create()

    index_id = "missing"

    if error != 404:
        reference = await fake.references.create(user=user, name="Foo")

        index_id = (
            await fake.indexes.create(
                reference,
                user,
                manifest={"foo": 2},
                version=4,
                ready=False,
            )
        ).id

    response = await client.delete(f"/indexes/{index_id}")

    if error:
        assert error == response.status
    else:
        assert response.status == 204


async def test_delete_ready_index(
    fake: DataFaker,
    pg: AsyncEngine,
    resp_is: RespIs,
    spawn_job_client: JobClientSpawner,
):
    """Deleting a ready index returns 409 and deletes nothing."""
    client = await spawn_job_client(authenticated=True)

    user = await fake.users.create()
    reference = await fake.references.create(user=user, name="Foo")
    index = await fake.indexes.create(reference, user, version=0, ready=True)

    response = await client.delete(f"/indexes/{index.id}")

    await resp_is.conflict(response, "Ready indexes cannot be deleted")

    async with AsyncSession(pg) as session:
        assert (
            await session.scalar(
                select(SQLIndex).where(SQLIndex.id == index.id),
            )
            is not None
        )


@pytest.mark.parametrize("status", [200, 404])
async def test_download(
    status: int,
    example_path: Path,
    fake: DataFaker,
    memory_storage: StorageBackend,
    pg: AsyncEngine,
    spawn_job_client: JobClientSpawner,
):
    client = await spawn_job_client(authenticated=True)

    user = await fake.users.create()

    reference = await fake.references.create(user=user, name="Test A")
    index = await fake.indexes.create(reference, user)

    path = example_path / "indexes" / "reference.1.bt2"
    expected_bytes = path.read_bytes()

    async with AsyncSession(pg) as session:
        storage_key = await session.scalar(
            select(SQLIndex.storage_key).where(SQLIndex.id == index.id),
        )

    key = compose_index_file_key(storage_key, "reference.1.bt2")

    async def _stream():
        yield expected_bytes

    await memory_storage.write(key, _stream())

    async with AsyncSession(pg) as session:
        session.add(
            SQLIndexFile(
                name="reference.1.bt2",
                index=str(index.id),
                index_id=index.id,
                type="bowtie2",
                size=len(expected_bytes),
            ),
        )
        await session.commit()

    files_url = f"/indexes/{index.id}/files/"

    if status == HTTPStatus.OK:
        files_url += "reference.1.bt2"
    elif status == 400:
        files_url += "foo.bar"

    async with client.get(files_url) as response:
        assert response.status == status
        if response.status == HTTPStatus.OK:
            assert await response.read() == expected_bytes


async def _seed_downloadable_sqlite(
    fake: DataFaker,
    memory_storage: StorageBackend,
    pg: AsyncEngine,
) -> tuple[int, bytes]:
    user = await fake.users.create()
    reference = await fake.references.create(user=user)
    index = await fake.indexes.create(reference, user)
    expected = b"server-produced SQLite index"

    async with AsyncSession(pg) as session:
        storage_key = await session.scalar(
            select(SQLIndex.storage_key).where(SQLIndex.id == index.id),
        )

        session.add(
            SQLIndexFile(
                name=INDEX_SQLITE_FILE_NAME,
                index=str(index.id),
                index_id=index.id,
                type="sqlite",
                size=len(expected),
            ),
        )
        await session.commit()

    async def stream():
        yield expected

    await memory_storage.write(
        compose_index_file_key(storage_key, INDEX_SQLITE_FILE_NAME),
        stream(),
    )

    return index.id, expected


async def test_download_sqlite_for_jobs(
    fake: DataFaker,
    memory_storage: StorageBackend,
    pg: AsyncEngine,
    spawn_job_client: JobClientSpawner,
):
    """The jobs download route serves a recorded SQLite index file."""
    client = await spawn_job_client(authenticated=True)
    index_id, expected = await _seed_downloadable_sqlite(fake, memory_storage, pg)

    response = await client.get(f"/indexes/{index_id}/files/{INDEX_SQLITE_FILE_NAME}")

    assert response.status == HTTPStatus.OK
    assert await response.read() == expected


async def test_download_sqlite_for_authenticated_user(
    fake: DataFaker,
    memory_storage: StorageBackend,
    pg: AsyncEngine,
    spawn_client: ClientSpawner,
):
    """The authenticated route serves a recorded SQLite index file."""
    client = await spawn_client(authenticated=True, administrator=True)
    index_id, expected = await _seed_downloadable_sqlite(fake, memory_storage, pg)

    response = await client.get(f"/indexes/{index_id}/files/{INDEX_SQLITE_FILE_NAME}")

    assert response.status == HTTPStatus.OK
    assert await response.read() == expected
