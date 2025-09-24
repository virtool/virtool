import asyncio
import filecmp
import gzip
import json
import os
import shutil
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
from tests.fixtures.response import RespIs
from virtool.config import get_config_from_app
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.indexes.db import INDEX_FILE_NAMES
from virtool.indexes.files import create_index_file
from virtool.indexes.sql import SQLIndexFile
from virtool.indexes.utils import check_index_file_type
from virtool.jobs.models import QueuedJobID
from virtool.mongo.core import Mongo
from virtool.mongo.utils import get_mongo_from_app
from virtool.workflow.pytest_plugin.utils import StaticTime


class TestFind:
    async def test(
        self,
        fake: DataFaker,
        mocker: MockerFixture,
        mongo: Mongo,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
        static_time: StaticTime,
    ):
        client = await spawn_client(authenticated=True)

        user = await fake.users.create()

        job_1 = await fake.jobs.create(user=user, workflow="build_index")
        job_2 = await fake.jobs.create(user=user, workflow="build_index")

        await asyncio.gather(
            mongo.history.insert_many(
                [
                    {"_id": "0", "index": {"id": "bar"}, "otu": {"id": "baz"}},
                    {"_id": "1", "index": {"id": "foo"}, "otu": {"id": "baz"}},
                    {"_id": "2", "index": {"id": "bar"}, "otu": {"id": "bat"}},
                    {"_id": "3", "index": {"id": "bar"}, "otu": {"id": "baz"}},
                    {"_id": "4", "index": {"id": "bar"}, "otu": {"id": "bad"}},
                    {"_id": "5", "index": {"id": "foo"}, "otu": {"id": "boo"}},
                ],
                session=None,
            ),
            mongo.indexes.insert_many(
                [
                    {
                        "_id": "bar",
                        "version": 1,
                        "created_at": static_time.datetime,
                        "manifest": {"foo": 2},
                        "ready": False,
                        "has_files": True,
                        "job": {"id": job_1.id},
                        "reference": {"id": "bar"},
                        "user": {"id": user.id},
                        "sequence_otu_map": {"foo": "bar_otu"},
                    },
                    {
                        "_id": "foo",
                        "version": 0,
                        "created_at": static_time.datetime,
                        "manifest": {"foo": 2},
                        "ready": False,
                        "has_files": True,
                        "job": {"id": job_2.id},
                        "reference": {"id": "foo"},
                        "user": {"id": user.id},
                        "sequence_otu_map": {"foo": "foo_otu"},
                    },
                ],
                session=None,
            ),
            mongo.references.insert_many(
                [
                    {"_id": "bar", "name": "Bar", "data_type": "genome"},
                    {"_id": "foo", "name": "Foo", "data_type": "genome"},
                ],
                session=None,
            ),
        )

        mocker.patch(
            "virtool.indexes.db.get_unbuilt_stats",
            make_mocked_coro(
                {"total_otu_count": 123, "change_count": 12, "modified_otu_count": 3},
            ),
        )

        resp = await client.get("/indexes")

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot

    async def test_ready(
        self,
        fake: DataFaker,
        snapshot,
        mongo: Mongo,
        spawn_client: ClientSpawner,
        static_time,
    ):
        client = await spawn_client(authenticated=True)

        user = await fake.users.create()
        job = await fake.jobs.create(user=user)

        await asyncio.gather(
            mongo.indexes.insert_many(
                [
                    {
                        "_id": "bot",
                        "version": 1,
                        "created_at": static_time.datetime + timedelta(hours=2),
                        "manifest": {"foo": 2},
                        "ready": True,
                        "has_files": True,
                        "job": {"id": job.id},
                        "reference": {"id": "bar"},
                        "user": {"id": user.id},
                    },
                    {
                        "_id": "daz",
                        "version": 0,
                        "created_at": static_time.datetime,
                        "manifest": {"foo": 2},
                        "ready": True,
                        "has_files": True,
                        "job": {"id": job.id},
                        "reference": {"id": "foo"},
                        "user": {"id": user.id},
                    },
                ],
                session=None,
            ),
            mongo.references.insert_many(
                [
                    {"_id": "bar", "name": "Bar", "data_type": "genome"},
                    {"_id": "foo", "name": "Foo", "data_type": "genome"},
                ],
                session=None,
            ),
        )

        resp = await client.get("/indexes?ready=True")

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot


@pytest.mark.parametrize("error", [None, "404"])
async def test_get(
    error: str | None,
    fake: DataFaker,
    mocker: MockerFixture,
    resp_is: RespIs,
    snapshot: SnapshotAssertion,
    mongo: Mongo,
    spawn_client: ClientSpawner,
    static_time: StaticTime,
):
    client = await spawn_client(authenticated=True)

    user = await fake.users.create()

    await asyncio.gather(
        mongo.references.insert_many(
            [
                {"_id": "bar", "name": "Bar", "data_type": "genome"},
            ],
            session=None,
        ),
        mongo.history.insert_many(
            [
                {"_id": "0", "index": {"id": "foobar"}, "otu": {"id": "foo"}},
                {"_id": "1", "index": {"id": "foobar"}, "otu": {"id": "baz"}},
                {"_id": "2", "index": {"id": "bar"}, "otu": {"id": "bat"}},
            ],
            session=None,
        ),
    )

    job = await fake.jobs.create(user=user, workflow="build_index")

    if not error:
        await mongo.indexes.insert_one(
            {
                "_id": "foobar",
                "version": 0,
                "created_at": static_time.datetime,
                "ready": False,
                "reference": {"id": "bar"},
                "manifest": {"foo": 2},
                "has_files": True,
                "user": {"id": user.id},
                "job": {"id": job.id},
            },
        )

    m_get_contributors = mocker.patch(
        "virtool.history.db.get_contributors",
        make_mocked_coro(
            [
                {"id": 1, "count": 1, "handle": "fred"},
                {"id": 2, "count": 3, "handle": "ian"},
            ],
        ),
    )

    m_get_otus = mocker.patch(
        "virtool.indexes.db.get_otus",
        make_mocked_coro(
            [
                {"id": "kjs8sa99", "name": "Foo", "change_count": 1},
                {"id": "zxbbvngc", "name": "Test", "change_count": 3},
            ],
        ),
    )

    resp = await client.get("/indexes/foobar")

    if error is None:
        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot

        # Check that get_contributors was called with correct parameter types
        call_args = m_get_contributors.call_args[0]
        assert isinstance(call_args[0], Mongo)
        assert isinstance(call_args[1], AsyncEngine)
        assert call_args[2] == {"index.id": "foobar"}
        m_get_otus.assert_called_with(ANY, "foobar")
    else:
        await resp_is.not_found(resp)


@pytest.mark.parametrize("file_exists", [True, False])
async def test_download_otus_json(
    file_exists: bool,
    data_path: Path,
    example_path: Path,
    mocker: MockerFixture,
    mongo: Mongo,
    spawn_job_client: JobClientSpawner,
):
    otus_json_path = example_path / "indexes" / "otus.json.gz"

    with gzip.open(otus_json_path, "rt") as f:
        expected = json.load(f)

    m_get_patched_otus = mocker.patch(
        "virtool.indexes.db.get_patched_otus",
        make_mocked_coro(expected),
    )

    client = await spawn_job_client(authenticated=True)

    index_dir = data_path / "references" / "foo" / "bar"
    index_dir.mkdir(parents=True)

    if file_exists:
        shutil.copy(otus_json_path, index_dir / "otus.json.gz")

    manifest = {"foo": 2, "bar": 1, "bad": 5}

    await mongo.indexes.insert_one(
        {"_id": "bar", "manifest": manifest, "reference": {"id": "foo"}},
    )

    async with await client.get("/indexes/bar/files/otus.json.gz") as resp:
        with gzip.open(BytesIO(await resp.read())) as f:
            result = json.load(f)

    assert resp.status == HTTPStatus.OK
    assert expected == result

    if not file_exists:
        m_get_patched_otus.assert_called_with(
            get_mongo_from_app(client.app),
            get_config_from_app(client.app),
            manifest,
        )


class TestCreate:
    async def test(
        self,
        check_ref_right,
        data_layer: DataLayer,
        fake: DataFaker,
        mocker: MockerFixture,
        mongo: Mongo,
        resp_is: RespIs,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
        static_time: StaticTime,
    ):
        mocker.patch("virtool.utils.generate_key", return_value=("foo", "bar"))

        client = await spawn_client(
            authenticated=True,
            base_url="https://virtool.example.com",
        )

        user = await fake.users.create()

        await asyncio.gather(
            mongo.references.insert_one(
                {"_id": "foo", "name": "Foo", "data_type": "genome"},
            ),
            # Insert unbuilt changes to prevent initial check failure.
            mongo.history.insert_one(
                {
                    "_id": "history_1",
                    "index": {"id": "unbuilt", "version": "unbuilt"},
                    "reference": {"id": "foo"},
                    "user": {"id": user.id},
                },
            ),
        )

        m_create_manifest = mocker.patch(
            "virtool.references.db.get_manifest",
            new=make_mocked_coro({"foo": 1, "bar": 2}),
        )

        resp = await client.post("/references/v1/foo/indexes", {})

        if not check_ref_right:
            await resp_is.insufficient_rights(resp)
            return

        assert resp.status == HTTPStatus.CREATED
        assert await resp.json() == snapshot(name="json")
        assert resp.headers["Location"] == snapshot(name="location")

        index, job = await asyncio.gather(
            mongo.indexes.find_one(),
            mongo.jobs.find_one(),
        )

        assert await data_layer.jobs.list_queued_ids() == [
            QueuedJobID(job["_id"], "jobs_build_index")
        ]
        assert index == snapshot(name="index")
        assert job == snapshot(name="job")

        m_create_manifest.assert_called_with(ANY, "foo")

    @pytest.mark.parametrize(
        "error",
        [None, "400_unbuilt", "400_unverified", "409_running"],
    )
    async def test_checks(
        self,
        error,
        resp_is,
        mongo: Mongo,
        spawn_client: ClientSpawner,
        check_ref_right,
    ):
        client = await spawn_client(authenticated=True)

        await mongo.references.insert_one({"_id": "foo"})

        if error == "409_running":
            await mongo.indexes.insert_one({"ready": False, "reference": {"id": "foo"}})

        if error == "400_unverified":
            await mongo.otus.insert_one({"verified": False, "reference": {"id": "foo"}})

        resp = await client.post("/references/v1/foo/indexes", {})

        if not check_ref_right:
            await resp_is.insufficient_rights(resp)
            return

        if error == "400_unverified":
            await resp_is.bad_request(resp, "There are unverified OTUs")
            return

        if error == "400_unbuilt":
            await resp_is.bad_request(resp, "There are no unbuilt changes")
            return

        if error == "409_running":
            await resp_is.conflict(resp, "Index build already in progress")
            return


@pytest.mark.parametrize("error", [None, "404"])
async def test_find_history(
    error,
    fake: DataFaker,
    static_time,
    snapshot,
    mongo: Mongo,
    spawn_client: ClientSpawner,
    resp_is,
):
    client = await spawn_client(authenticated=True)

    if not error:
        await mongo.indexes.insert_one({"_id": "foobar", "version": 0})

    user_1 = await fake.users.create()
    user_2 = await fake.users.create()

    await asyncio.gather(
        mongo.history.insert_many(
            [
                {
                    "_id": "zxbbvngc.0",
                    "created_at": static_time.datetime,
                    "reference": {"id": "foo"},
                    "otu": {"version": 0, "name": "Test", "id": "zxbbvngc"},
                    "user": {"id": user_1.id},
                    "description": "Added Unnamed Isolate as default",
                    "method_name": "add_isolate",
                    "index": {"version": 0, "id": "foobar"},
                },
                {
                    "_id": "zxbbvngc.1",
                    "created_at": static_time.datetime,
                    "reference": {"id": "foo"},
                    "otu": {"version": 1, "name": "Test", "id": "zxbbvngc"},
                    "user": {"id": user_1.id},
                    "description": "Added Unnamed Isolate as default",
                    "method_name": "add_isolate",
                    "index": {"version": 0, "id": "foobar"},
                },
                {
                    "_id": "zxbbvngc.2",
                    "created_at": static_time.datetime,
                    "reference": {"id": "foo"},
                    "otu": {"version": 2, "name": "Test", "id": "zxbbvngc"},
                    "user": {"id": user_2.id},
                    "description": "Added Unnamed Isolate as default",
                    "method_name": "add_isolate",
                    "index": {"version": 0, "id": "foobar"},
                },
                {
                    "_id": "kjs8sa99.3",
                    "created_at": static_time.datetime,
                    "reference": {"id": "foo"},
                    "otu": {"version": 3, "name": "Foo", "id": "kjs8sa99"},
                    "user": {"id": user_1.id},
                    "description": "Edited sequence wrta20tr in Islolate chilli-CR",
                    "method_name": "edit_sequence",
                    "index": {"version": 0, "id": "foobar"},
                },
            ],
            session=None,
        ),
        mongo.references.insert_many(
            [
                {"_id": "bar", "name": "Bar", "data_type": "genome"},
                {"_id": "foo", "name": "Foo", "data_type": "genome"},
            ],
            session=None,
        ),
    )

    resp = await client.get("/indexes/foobar/history")

    if error is None:
        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot
    else:
        await resp_is.not_found(resp)


@pytest.mark.parametrize("error", [None, 404])
async def test_delete_index(
    error,
    fake: DataFaker,
    mongo: Mongo,
    spawn_job_client: JobClientSpawner,
    static_time,
):
    index_id = "index1"

    client = await spawn_job_client(authenticated=True)

    user = await fake.users.create()

    if error != 404:
        await asyncio.gather(
            mongo.references.insert_one(
                {"_id": "foo", "data_type": "genome", "name": "Foo"},
            ),
            mongo.indexes.insert_one(
                {
                    "_id": index_id,
                    "created_at": static_time.iso,
                    "has_files": True,
                    "manifest": {"foo": 2},
                    "ready": True,
                    "reference": {"id": "foo"},
                    "user": {"id": user.id},
                    "version": 4,
                },
            ),
            mongo.history.insert_many(
                [
                    {
                        "_id": _id,
                        "index": {
                            "id": index_id,
                            "version": "test_version",
                        },
                        "user": {"id": user.id},
                    }
                    for _id in ("history1", "history2", "history3")
                ],
                session=None,
            ),
        )

    response = await client.delete(f"/indexes/{index_id}")

    if error:
        assert error == response.status
    else:
        assert response.status == 204
        async for doc in mongo.history.find({"index.id": index_id}):
            assert doc["index"]["id"] == doc["index"]["version"] == "unbuilt"


@pytest.mark.parametrize("error", [None, "409", "404_index", "404_file"])
async def test_upload(
    error: str | None,
    data_path: Path,
    example_path: Path,
    fake: DataFaker,
    mongo: Mongo,
    pg: AsyncEngine,
    resp_is,
    snapshot: SnapshotAssertion,
    spawn_job_client: JobClientSpawner,
    static_time,
):
    client = await spawn_job_client(authenticated=True)

    path = example_path / "indexes" / "reference.1.bt2"

    files = {"file": open(path, "rb")}

    user, _ = await asyncio.gather(
        fake.users.create(),
        mongo.references.insert_many(
            [
                {"_id": "bar", "name": "Bar", "data_type": "genome"},
                {"_id": "foo", "name": "Foo", "data_type": "genome"},
            ],
            session=None,
        ),
    )

    index = {"_id": "foo", "reference": {"id": "bar"}, "user": {"id": user.id}}

    if error == "409":
        async with AsyncSession(pg) as session:
            session.add(SQLIndexFile(name="reference.1.bt2", index="foo"))
            await session.commit()

    if error != "404_index":
        await mongo.indexes.insert_one(index)

    url = "/indexes/foo/files"

    if error == "404_file":
        url += "/reference.bt2"
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
    assert os.listdir(data_path / "references" / "bar" / "foo") == ["reference.1.bt2"]

    assert await resp.json() == snapshot
    assert await mongo.indexes.find_one("foo") == snapshot

    async with AsyncSession(pg) as session:
        assert (
            await session.execute(select(SQLIndexFile).filter_by(id=1))
        ).scalar() == snapshot


@pytest.mark.parametrize("error", [None, "409_genome", "409_fasta", "404_reference"])
async def test_finalize(
    error: str | None,
    fake: DataFaker,
    mongo: Mongo,
    pg: AsyncEngine,
    snapshot: SnapshotAssertion,
    spawn_job_client: JobClientSpawner,
    static_time,
    test_otu,
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
        files = INDEX_FILE_NAMES

    if error != "404_reference":
        await mongo.references.insert_one(
            {"_id": "hxn167", "name": "Test A", "data_type": "genome"},
        )

    await asyncio.gather(
        mongo.indexes.insert_one(
            {
                "_id": "test_index",
                "reference": {"id": "hxn167"},
                "manifest": {"foo": 4},
                "user": {"id": user.id},
                "version": 2,
                "created_at": static_time.datetime,
                "has_files": True,
                "job": {"id": job.id},
            },
        ),
        # change `version` that should be reflected in `last_indexed_version` after calling
        mongo.otus.insert_one({**test_otu, "version": 1}),
    )

    for file_name in files:
        await create_index_file(
            pg,
            "test_index",
            check_index_file_type(file_name),
            file_name,
            9000,
        )

    resp = await client.patch("/indexes/test_index")

    assert await resp.json() == snapshot

    if not error:
        assert resp.status == HTTPStatus.OK
        assert await mongo.otus.find_one("6116cba1") == snapshot


@pytest.mark.parametrize("status", [200, 404])
async def test_download(
    status: int,
    data_path: Path,
    example_path: Path,
    mongo: Mongo,
    spawn_job_client: JobClientSpawner,
):
    client = await spawn_job_client(authenticated=True)

    await asyncio.gather(
        mongo.indexes.insert_one(
            {"_id": "test_index", "reference": {"id": "test_reference"}},
        ),
        mongo.references.insert_one(
            {"_id": "test_reference", "name": "Test A", "data_type": "genome"},
        ),
    )

    path = example_path / "indexes" / "reference.1.bt2"
    target_path = data_path / "references" / "test_reference" / "test_index"
    target_path.mkdir(parents=True)
    shutil.copyfile(path, target_path / "reference.1.bt2")

    download_path = target_path / "downloads" / "reference.1.bt2"
    download_path.parent.mkdir()

    files_url = "/indexes/test_index/files/"

    if status == HTTPStatus.OK:
        files_url += "reference.1.bt2"
    elif status == 400:
        files_url += "foo.bar"

    async with client.get(files_url) as response:
        assert response.status == status
        if response.status == HTTPStatus.OK:
            with download_path.open("wb") as f:
                f.write(await response.read())

            assert filecmp.cmp(download_path, path)
