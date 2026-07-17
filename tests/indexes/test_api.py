import gzip
import json
from datetime import timedelta
from http import HTTPStatus
from io import BytesIO
from pathlib import Path
from unittest.mock import ANY

import pytest
from aiohttp.test_utils import make_mocked_coro
from pytest_mock import MockerFixture
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

from tests.fixtures.client import ClientSpawner, JobClientSpawner
from tests.fixtures.references import (
    add_reference_user,
    create_reference,
)
from tests.fixtures.response import RespIs
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.history.db import legacy_history_values
from virtool.history.sql import SQLLegacyHistory
from virtool.indexes.db import JOB_INDEX_FILE_NAMES
from virtool.indexes.sql import SQLIndex, SQLIndexFile
from virtool.indexes.utils import check_index_file_type, compose_index_file_key
from virtool.jobs.pg import SQLJob, SQLJobIndex
from virtool.models.enums import Permission
from virtool.mongo.core import Mongo
from virtool.otus.sql import SQLOTU
from virtool.storage.protocol import StorageBackend
from virtool.tasks.sql import SQLTask
from virtool.workflow.pytest_plugin.utils import StaticTime


class TestFind:
    @pytest.mark.parametrize(
        ("archived", "expected_roles"),
        [
            (None, {"active_a", "active_b", "archived"}),
            (True, {"archived"}),
            (False, {"active_a", "active_b"}),
        ],
        ids=["default", "archived", "active"],
    )
    async def test_find(
        self,
        archived: bool | None,
        expected_roles: set[str],
        data_layer: DataLayer,
        fake: DataFaker,
        mocker: MockerFixture,
        mongo: Mongo,
        pg: AsyncEngine,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
        static_time: StaticTime,
    ):
        client = await spawn_client(authenticated=True)

        user = await fake.users.create()

        job_active_a = await fake.jobs.create(user=user, workflow="build_index")
        job_active_b = await fake.jobs.create(user=user, workflow="build_index")
        job_archived = await fake.jobs.create(user=user, workflow="build_index")

        reference_active_a = await fake.references.create(user=user)
        reference_active_b = await fake.references.create(user=user)
        reference_archived = await fake.references.create(user=user)
        await data_layer.references.archive(reference_archived.id)

        indexes = {
            "active_a": await fake.indexes.create(
                reference_active_a,
                user,
                job=job_active_a,
                manifest={"otu_1": 2},
                version=1,
            ),
            "active_b": await fake.indexes.create(
                reference_active_b,
                user,
                job=job_active_b,
                manifest={"otu_1": 2},
                version=0,
            ),
            "archived": await fake.indexes.create(
                reference_archived,
                user,
                job=job_archived,
                manifest={"otu_1": 2},
                version=0,
            ),
        }

        index_references = {
            indexes["active_a"].id: reference_active_a.id,
            indexes["active_b"].id: reference_active_b.id,
        }

        async with AsyncSession(pg) as session:
            session.add_all(
                SQLLegacyHistory(
                    legacy_id=legacy_id,
                    created_at=static_time.datetime,
                    description="Description",
                    method_name="edit",
                    user_id=user.id,
                    otu=otu_id,
                    otu_name=otu_id,
                    otu_version="0",
                    reference_id=index_references[index_id],
                    index=index_id,
                    index_version="0",
                )
                for legacy_id, index_id, otu_id in (
                    ("0", indexes["active_a"].id, "otu_1"),
                    ("1", indexes["active_b"].id, "otu_1"),
                    ("2", indexes["active_a"].id, "otu_2"),
                    ("3", indexes["active_a"].id, "otu_1"),
                    ("4", indexes["active_a"].id, "otu_3"),
                    ("5", indexes["active_b"].id, "otu_4"),
                )
            )
            await session.commit()

        mocker.patch(
            "virtool.indexes.db.get_unbuilt_stats",
            make_mocked_coro(
                {"total_otu_count": 123, "change_count": 12, "modified_otu_count": 3},
            ),
        )

        url = "/indexes"
        if archived is not None:
            url = f"{url}?archived={archived}"

        resp = await client.get(url)
        body = await resp.json()

        assert resp.status == HTTPStatus.OK
        assert body == snapshot
        assert {d["id"] for d in body["documents"]} == {
            indexes[role].id for role in expected_roles
        }

    @pytest.mark.parametrize(
        ("archived", "expected_roles"),
        [
            (None, {"active_a", "active_b", "archived"}),
            (True, {"archived"}),
            (False, {"active_a", "active_b"}),
        ],
        ids=["default", "archived", "active"],
    )
    async def test_ready(
        self,
        archived: bool | None,
        expected_roles: set[str],
        data_layer: DataLayer,
        fake: DataFaker,
        snapshot,
        spawn_client: ClientSpawner,
        static_time,
    ):
        client = await spawn_client(authenticated=True)

        user = await fake.users.create()
        job = await fake.jobs.create(user=user)

        reference_active_a = await fake.references.create(user=user)
        reference_active_b = await fake.references.create(user=user)
        reference_archived = await fake.references.create(user=user)
        await data_layer.references.archive(reference_archived.id)

        # The ready listing sorts by ``created_at`` ascending. The timestamps are
        # scrambled relative to creation order so the sort is actually exercised.
        indexes = {
            "active_a": await fake.indexes.create(
                reference_active_a,
                user,
                job=job,
                manifest={"otu_1": 2},
                version=1,
                created_at=static_time.datetime + timedelta(hours=2),
                ready=True,
            ),
            "active_b": await fake.indexes.create(
                reference_active_b,
                user,
                job=job,
                manifest={"otu_1": 2},
                version=0,
                created_at=static_time.datetime,
                ready=True,
            ),
            "archived": await fake.indexes.create(
                reference_archived,
                user,
                job=job,
                manifest={"otu_1": 2},
                version=0,
                created_at=static_time.datetime + timedelta(hours=4),
                ready=True,
            ),
        }

        url = "/indexes?ready=True"
        if archived is not None:
            url = f"{url}&archived={archived}"

        resp = await client.get(url)
        body = await resp.json()

        assert resp.status == HTTPStatus.OK
        assert body == snapshot
        assert {d["id"] for d in body} == {indexes[role].id for role in expected_roles}

        # The listing is ordered oldest-first, independently of creation order.
        ordered_roles = [
            role
            for role in ("active_b", "active_a", "archived")
            if role in expected_roles
        ]
        assert [d["id"] for d in body] == [indexes[role].id for role in ordered_roles]

    async def test_archived_invalid(self, spawn_client: ClientSpawner):
        """An invalid ``archived`` value yields a 400 with Pydantic detail."""
        client = await spawn_client(authenticated=True)

        resp = await client.get("/indexes?archived=foo")

        assert resp.status == HTTPStatus.BAD_REQUEST


@pytest.mark.parametrize("error", [None, "404"])
async def test_get(
    error: str | None,
    fake: DataFaker,
    pg: AsyncEngine,
    resp_is: RespIs,
    snapshot: SnapshotAssertion,
    spawn_client: ClientSpawner,
    static_time: StaticTime,
):
    """The index detail aggregates real contributors and modified OTUs from history.

    Contributors and OTU change counts are computed by ``get_contributors`` and
    ``get_otus`` over the ``legacy_history`` rows scoped to the requested index. Rows
    belonging to another index must not leak into either aggregation.
    """
    client = await spawn_client(authenticated=True)

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
                index=row_index_id,
                index_version="0",
            )
            for legacy_id, row_index_id, otu_id, otu_name, otu_version, user_id in (
                ("tmv.0", index_id, "tmv", "Tobacco mosaic virus", "0", prolific.id),
                ("tmv.1", index_id, "tmv", "Tobacco mosaic virus", "1", prolific.id),
                ("pvx.0", index_id, "pvx", "Potato virus X", "0", occasional.id),
                ("other.0", "other", "other", "Other virus", "0", occasional.id),
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
        key = compose_index_file_key(index.id, "otus.json.gz")

        async def _stream():
            yield otus_json_path.read_bytes()

        await memory_storage.write(key, _stream())

    async with await client.get(f"/indexes/{index.id}/files/otus.json.gz") as resp:
        with gzip.open(BytesIO(await resp.read())) as f:
            result = json.load(f)

    assert resp.status == HTTPStatus.OK
    assert expected == result

    if not file_exists:
        m_iter_patched_otus.assert_called_with(
            client.app["pg"],
            manifest,
        )


class TestCreate:
    async def test_ok(
        self,
        mocker: MockerFixture,
        mongo: Mongo,
        pg: AsyncEngine,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
        static_time: StaticTime,
    ):
        """Test that the reference owner, who holds the ``build`` right, can build an
        index.
        """
        client = await spawn_client(
            authenticated=True,
            base_url="https://virtool.example.com",
            permissions=[Permission.create_ref],
        )

        reference = await create_reference(client, name="Foo")

        # Insert unbuilt changes to prevent initial check failure.
        await mongo.history.insert_one(
            {
                "_id": "history_1",
                "index": {"id": "unbuilt", "version": "unbuilt"},
                "reference": {"id": reference["id"]},
                "user": {"id": client.user.id},
            },
        )

        async with AsyncSession(pg) as session:
            session.add(
                SQLLegacyHistory(
                    legacy_id="history_1",
                    created_at=static_time.datetime,
                    description="Description",
                    method_name="create",
                    user_id=client.user.id,
                    otu="otu_1",
                    otu_name="Tobacco mosaic virus",
                    otu_version="0",
                    reference_id=reference["id"],
                    index=None,
                    index_version=None,
                ),
            )
            await session.commit()

        m_create_manifest = mocker.patch(
            "virtool.references.db.get_manifest",
            new=make_mocked_coro({"foo": 1, "bar": 2}),
        )

        resp = await client.post(f"/references/v1/{reference['id']}/indexes", {})

        assert resp.status == HTTPStatus.CREATED
        assert await resp.json() == snapshot(name="json")
        assert resp.headers["Location"] == snapshot(name="location")

        index = await mongo.indexes.find_one()

        assert index == snapshot(name="index")
        assert index["job"] is None
        assert index["task"] is not None

        body = await resp.json()
        assert body["ready"] is False
        assert body["job"] is None
        assert "task" not in body

        async with AsyncSession(pg) as session:
            task = await session.scalar(
                select(SQLTask).where(SQLTask.id == index["task"]["id"]),
            )
            history = await session.scalar(
                select(SQLLegacyHistory).where(
                    SQLLegacyHistory.legacy_id == "history_1",
                ),
            )

            assert task is not None
            assert task.type == "create_index"
            assert task.context == {"index_id": index["_id"]}
            assert history is not None
            assert (history.index, history.index_version) == (index["_id"], "0")
            assert await session.scalar(select(SQLJob.id)) is None
            assert await session.scalar(select(SQLJobIndex.job_id)) is None

        m_create_manifest.assert_called_with(ANY, reference["id"])

    async def test_insufficient_rights(
        self,
        mongo: Mongo,
        resp_is: RespIs,
        spawn_client: ClientSpawner,
    ):
        """Test that a reference member without the ``build`` right cannot build an
        index.
        """
        owner = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_ref],
        )

        reference = await create_reference(owner, name="Foo")

        client = await spawn_client(authenticated=True)

        await add_reference_user(owner, reference["id"], client.user.id)

        resp = await client.post(f"/references/v1/{reference['id']}/indexes", {})

        await resp_is.insufficient_rights(resp)

        assert await mongo.indexes.find_one() is None

    async def test_unbuilt(
        self,
        resp_is: RespIs,
        spawn_client: ClientSpawner,
    ):
        """Test that a build with no unbuilt changes results in a ``400`` response."""
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_ref],
        )

        reference = await create_reference(client, name="Foo")

        resp = await client.post(f"/references/v1/{reference['id']}/indexes", {})

        await resp_is.bad_request(resp, "There are no unbuilt changes")

    async def test_unverified(
        self,
        pg: AsyncEngine,
        resp_is: RespIs,
        spawn_client: ClientSpawner,
    ):
        """Test that a build for a reference with unverified OTUs results in a ``400``
        response.
        """
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_ref],
        )

        reference = await create_reference(client, name="Foo")

        async with AsyncSession(pg) as session:
            session.add(
                SQLOTU(
                    id="unverified_otu",
                    data={"_id": "unverified_otu"},
                    name="Unverified OTU",
                    abbreviation="",
                    last_indexed_version=None,
                    reference_id=reference["id"],
                    verified=False,
                    version=0,
                ),
            )
            await session.commit()

        resp = await client.post(f"/references/v1/{reference['id']}/indexes", {})

        await resp_is.bad_request(resp, "There are unverified OTUs")

    async def test_build_in_progress(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        resp_is: RespIs,
        spawn_client: ClientSpawner,
    ):
        """Test that a build that is already running results in a ``409`` response."""
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_ref],
        )

        reference = await create_reference(client, name="Foo")

        await fake.indexes.create(
            await data_layer.references.get(reference["id"]),
            await fake.users.create(),
        )

        resp = await client.post(f"/references/v1/{reference['id']}/indexes", {})

        await resp_is.conflict(resp, "Index build already in progress")


@pytest.mark.parametrize("error", [None, "404"])
async def test_find_history(
    error,
    fake: DataFaker,
    static_time,
    snapshot,
    mongo: Mongo,
    pg: AsyncEngine,
    spawn_client: ClientSpawner,
    resp_is,
):
    client = await spawn_client(authenticated=True)

    user_1 = await fake.users.create()
    user_2 = await fake.users.create()

    reference = await fake.references.create(user=user_1)

    index_id = "missing"

    if not error:
        index_id = (await fake.indexes.create(reference, user_1, version=0)).id

    history_documents = [
        {
            "_id": "zxbbvngc.0",
            "created_at": static_time.datetime,
            "reference": {"id": reference.id},
            "otu": {"version": 0, "name": "Test", "id": "zxbbvngc"},
            "user": {"id": user_1.id},
            "description": "Added Unnamed Isolate as default",
            "method_name": "add_isolate",
            "index": {"version": 0, "id": index_id},
        },
        {
            "_id": "zxbbvngc.1",
            "created_at": static_time.datetime,
            "reference": {"id": reference.id},
            "otu": {"version": 1, "name": "Test", "id": "zxbbvngc"},
            "user": {"id": user_1.id},
            "description": "Added Unnamed Isolate as default",
            "method_name": "add_isolate",
            "index": {"version": 0, "id": index_id},
        },
        {
            "_id": "zxbbvngc.2",
            "created_at": static_time.datetime,
            "reference": {"id": reference.id},
            "otu": {"version": 2, "name": "Test", "id": "zxbbvngc"},
            "user": {"id": user_2.id},
            "description": "Added Unnamed Isolate as default",
            "method_name": "add_isolate",
            "index": {"version": 0, "id": index_id},
        },
        {
            "_id": "kjs8sa99.3",
            "created_at": static_time.datetime,
            "reference": {"id": reference.id},
            "otu": {"version": 3, "name": "Foo", "id": "kjs8sa99"},
            "user": {"id": user_1.id},
            "description": "Edited sequence wrta20tr in Islolate chilli-CR",
            "method_name": "edit_sequence",
            "index": {"version": 0, "id": index_id},
        },
    ]

    await mongo.history.insert_many(history_documents, session=None)

    async with AsyncSession(pg) as session:
        session.add_all(
            SQLLegacyHistory(
                **legacy_history_values(document),
                reference_id=reference.id,
            )
            for document in history_documents
        )
        await session.commit()

    resp = await client.get(f"/indexes/{index_id}/history")

    if error is None:
        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot
    else:
        await resp_is.not_found(resp)


@pytest.mark.parametrize("error", [None, 404])
@pytest.mark.usefixtures("static_time")
async def test_delete_index(
    error,
    fake: DataFaker,
    mongo: Mongo,
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
                ready=True,
            )
        ).id

    response = await client.delete(f"/indexes/{index_id}")

    if error:
        assert error == response.status
    else:
        assert response.status == 204
        assert await mongo.indexes.find_one(index_id) is None


@pytest.mark.parametrize("error", [None, "409", "404_index", "404_file"])
@pytest.mark.usefixtures("static_time")
async def test_upload(
    error: str | None,
    example_path: Path,
    fake: DataFaker,
    memory_storage: StorageBackend,
    mongo: Mongo,
    pg: AsyncEngine,
    resp_is,
    snapshot: SnapshotAssertion,
    spawn_job_client: JobClientSpawner,
):
    client = await spawn_job_client(authenticated=True)

    path = example_path / "indexes" / "reference.1.bt2"

    files = {"file": open(path, "rb")}

    user = await fake.users.create()

    reference = await fake.references.create(user=user, name="Bar")
    job = await fake.jobs.create(user=user, workflow="build_index")

    index_id = "missing"

    if error != "404_index":
        index_id = (await fake.indexes.create(reference, user, job=job)).id

    if error == "409":
        async with AsyncSession(pg) as session:
            index_pk = await session.scalar(
                select(SQLIndex.id).where(SQLIndex.legacy_id == index_id),
            )
            session.add(
                SQLIndexFile(
                    name="reference.1.bt2",
                    index=index_id,
                    index_id=index_pk,
                ),
            )
            await session.commit()

    url = f"/indexes/{index_id}/files"

    if error == "404_file":
        url += "/reference.foo.bt2"
    else:
        url += "/reference.1.bt2"

    resp = await client.put(url, data=files)

    if error == "404_file":
        await resp_is.not_found(resp, "Index file not found")
        return

    if error == "404_index":
        await resp_is.not_found(resp, "Not found")
        return

    if error == "409":
        await resp_is.conflict(resp, "File name already exists")
        return

    assert resp.status == 201

    expected_key = compose_index_file_key(index_id, "reference.1.bt2")

    found = False
    async for info in memory_storage.list(expected_key):
        if info.key == expected_key:
            found = True
            break
    assert found

    chunks = []
    async for chunk in memory_storage.read(expected_key):
        chunks.append(chunk)
    assert b"".join(chunks) == path.read_bytes()

    assert await resp.json() == snapshot
    assert await mongo.indexes.find_one(index_id) == snapshot

    async with AsyncSession(pg) as session:
        assert (
            await session.execute(select(SQLIndexFile).filter_by(id=1))
        ).scalar() == snapshot


@pytest.mark.parametrize("error", [None, "409_genome", "409_fasta"])
@pytest.mark.usefixtures("static_time")
async def test_finalize(
    error: str | None,
    fake: DataFaker,
    mongo: Mongo,
    pg: AsyncEngine,
    snapshot: SnapshotAssertion,
    spawn_job_client: JobClientSpawner,
):
    """Test that an index can be finalized using the Jobs API."""
    client = await spawn_job_client(authenticated=True)

    user = await fake.users.create()
    job = await fake.jobs.create(user=user, workflow="build_index")

    if error == "409_genome":
        files = ["reference.fa.gz"]
    elif error == "409_fasta":
        files = ["reference.json.gz"]
    else:
        files = JOB_INDEX_FILE_NAMES

    reference = await fake.references.create(user=user)

    # The OTU is written to both stores, as it is in production, so the
    # Postgres-backed read that drives the stamp can see it and reflect its
    # `version` in `last_indexed_version` after finalizing.
    otu = await fake.otus.create(reference.id, user)

    index = await fake.indexes.create(
        reference,
        user,
        job=job,
        manifest={"foo": 4},
        version=2,
    )

    async with AsyncSession(pg) as session:
        index_pk = await session.scalar(
            select(SQLIndex.id).where(SQLIndex.legacy_id == index.id),
        )
        session.add_all(
            [
                SQLIndexFile(
                    index=index.id,
                    index_id=index_pk,
                    name=file_name,
                    size=9000,
                    type=check_index_file_type(file_name),
                )
                for file_name in files
            ],
        )
        await session.commit()

    resp = await client.patch(f"/indexes/{index.id}")

    assert await resp.json() == snapshot

    if not error:
        assert resp.status == HTTPStatus.OK
        assert await mongo.otus.find_one(otu.id) == snapshot


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

    key = compose_index_file_key(index.id, "reference.1.bt2")

    async def _stream():
        yield expected_bytes

    await memory_storage.write(key, _stream())

    async with AsyncSession(pg) as session:
        index_pk = await session.scalar(
            select(SQLIndex.id).where(SQLIndex.legacy_id == index.id),
        )
        session.add(
            SQLIndexFile(
                name="reference.1.bt2",
                index=index.id,
                index_id=index_pk,
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
