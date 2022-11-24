import filecmp
import gzip
import json
import os
import shutil
from datetime import timedelta
from io import BytesIO
from pathlib import Path

import pytest
from aiohttp.test_utils import make_mocked_coro
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.utils import get_data_from_app
from virtool.indexes.db import FILES
from virtool.indexes.files import create_index_file
from virtool.indexes.models import SQLIndexFile
from virtool.indexes.utils import check_index_file_type
from virtool.jobs.client import DummyJobsClient

OTUS_JSON_PATH = Path.cwd() / "tests/test_files/index/otus.json.gz"


class TestFind:
    async def test(self, mocker, snapshot, fake2, spawn_client, static_time):
        client = await spawn_client(authorize=True)

        user = await fake2.users.create()

        await client.db.indexes.insert_many(
            [
                {
                    "_id": "bar",
                    "version": 1,
                    "created_at": static_time.datetime,
                    "manifest": {"foo": 2},
                    "ready": False,
                    "has_files": True,
                    "job": {"id": "bar"},
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
                    "job": {"id": "foo"},
                    "reference": {"id": "foo"},
                    "user": {"id": user.id},
                    "sequence_otu_map": {"foo": "foo_otu"},
                },
            ]
        )

        await client.db.history.insert_many(
            [
                {"_id": "0", "index": {"id": "bar"}, "otu": {"id": "baz"}},
                {"_id": "1", "index": {"id": "foo"}, "otu": {"id": "baz"}},
                {"_id": "2", "index": {"id": "bar"}, "otu": {"id": "bat"}},
                {"_id": "3", "index": {"id": "bar"}, "otu": {"id": "baz"}},
                {"_id": "4", "index": {"id": "bar"}, "otu": {"id": "bad"}},
                {"_id": "5", "index": {"id": "foo"}, "otu": {"id": "boo"}},
            ]
        )

        mocker.patch(
            "virtool.indexes.db.get_unbuilt_stats",
            make_mocked_coro(
                {"total_otu_count": 123, "change_count": 12, "modified_otu_count": 3}
            ),
        )

        resp = await client.get("/indexes")

        assert resp.status == 200
        assert await resp.json() == snapshot

    async def test_ready(self, fake2, snapshot, spawn_client, static_time):
        client = await spawn_client(authorize=True)

        user = await fake2.users.create()

        await client.db.indexes.insert_many(
            [
                {
                    "_id": "bot",
                    "version": 1,
                    "created_at": static_time.datetime + timedelta(hours=2),
                    "manifest": {"foo": 2},
                    "ready": True,
                    "has_files": True,
                    "job": {"id": "bar"},
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
                    "job": {"id": "foo"},
                    "reference": {"id": "foo"},
                    "user": {"id": user.id},
                },
            ]
        )

        resp = await client.get("/indexes?ready=True")

        assert resp.status == 200
        assert await resp.json() == snapshot


@pytest.mark.parametrize("error", [None, "404"])
async def test_get(error, mocker, snapshot, fake2, resp_is, spawn_client, static_time):
    client = await spawn_client(authorize=True)

    user = await fake2.users.create()

    if not error:
        await client.db.indexes.insert_one(
            {
                "_id": "foobar",
                "version": 0,
                "created_at": static_time.datetime,
                "ready": False,
                "reference": {"id": "bar"},
                "manifest": {"foo": 2},
                "has_files": True,
                "user": {"id": user.id},
                "job": {"id": "sj82la"},
            }
        )

    await client.db.history.insert_many(
        [
            {"_id": "0", "index": {"id": "foobar"}, "otu": {"id": "foo"}},
            {"_id": "1", "index": {"id": "foobar"}, "otu": {"id": "baz"}},
            {"_id": "2", "index": {"id": "bar"}, "otu": {"id": "bat"}},
        ]
    )

    contributors = [
        {"id": "fred", "count": 1, "handle": "fred", "administrator": True},
        {"id": "igboyes", "count": 3, "handle": "ian", "administrator": True},
    ]

    otus = [
        {"id": "kjs8sa99", "name": "Foo", "change_count": 1},
        {"id": "zxbbvngc", "name": "Test", "change_count": 3},
    ]

    m_get_contributors = mocker.patch(
        "virtool.history.db.get_contributors", make_mocked_coro(contributors)
    )

    m_get_otus = mocker.patch("virtool.indexes.db.get_otus", make_mocked_coro(otus))

    resp = await client.get("/indexes/foobar")

    if error:
        await resp_is.not_found(resp)
        return

    m_get_contributors.assert_called_with(client.db, {"index.id": "foobar"})

    m_get_otus.assert_called_with(client.db, "foobar")

    assert resp.status == 200
    assert await resp.json() == snapshot


@pytest.mark.parametrize("file_exists", [True, False])
async def test_download_otus_json(
    file_exists, mocker, tmp_path, mongo, spawn_job_client
):
    with gzip.open(OTUS_JSON_PATH, "rt") as f:
        expected = json.load(f)

    m_get_patched_otus = mocker.patch(
        "virtool.indexes.db.get_patched_otus", make_mocked_coro(expected)
    )

    client = await spawn_job_client(authorize=True)

    client.app["config"].data_path = tmp_path

    index_dir = tmp_path / "references" / "foo" / "bar"
    index_dir.mkdir(parents=True)

    if file_exists:
        shutil.copy(OTUS_JSON_PATH, index_dir / "otus.json.gz")

    manifest = {"foo": 2, "bar": 1, "bad": 5}

    await mongo.indexes.insert_one(
        {"_id": "bar", "manifest": manifest, "reference": {"id": "foo"}}
    )

    async with await client.get("/indexes/bar/files/otus.json.gz") as resp:
        with gzip.open(BytesIO(await resp.read())) as f:
            result = json.load(f)

    assert resp.status == 200
    assert expected == result

    if not file_exists:
        m_get_patched_otus.assert_called_with(
            client.app["db"], client.app["config"], manifest
        )


class TestCreate:
    async def test(
        self,
        mocker,
        snapshot,
        spawn_client,
        static_time,
        check_ref_right,
        resp_is,
    ):
        mocker.patch("virtool.utils.generate_key", return_value=("foo", "bar"))

        client = await spawn_client(
            authorize=True, base_url="https://virtool.example.com"
        )

        data = get_data_from_app(client.app)
        data.jobs._client = DummyJobsClient()

        await client.db.references.insert_one({"_id": "foo"})

        # Insert unbuilt changes to prevent initial check failure.
        await client.db.history.insert_one(
            {
                "_id": "history_1",
                "index": {"id": "unbuilt", "version": "unbuilt"},
                "reference": {"id": "foo"},
            }
        )

        m_get_next_version = mocker.patch(
            "virtool.indexes.db.get_next_version", new=make_mocked_coro(9)
        )

        m_create_manifest = mocker.patch(
            "virtool.references.db.get_manifest", new=make_mocked_coro("manifest")
        )

        resp = await client.post("/refs/foo/indexes")

        if not check_ref_right:
            await resp_is.insufficient_rights(resp)
            return

        assert resp.status == 201
        assert await resp.json() == snapshot(name="json")
        assert resp.headers["Location"] == snapshot(name="location")
        assert await client.db.jobs.find_one() == snapshot(name="job")
        assert await client.db.indexes.find_one() == snapshot(name="index")
        assert data.jobs._client.enqueued == snapshot(name="enqueued")

        m_get_next_version.assert_called_with(client.db, "foo")
        m_create_manifest.assert_called_with(client.db, "foo")

    @pytest.mark.parametrize(
        "error", [None, "400_unbuilt", "400_unverified", "409_running"]
    )
    async def test_checks(self, error, resp_is, spawn_client, check_ref_right):
        client = await spawn_client(authorize=True)

        await client.db.references.insert_one({"_id": "foo"})

        if error == "409_running":
            await client.db.indexes.insert_one(
                {"ready": False, "reference": {"id": "foo"}}
            )

        if error == "400_unverified":
            await client.db.otus.insert_one(
                {"verified": False, "reference": {"id": "foo"}}
            )

        resp = await client.post("/refs/foo/indexes", {})

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
async def test_find_history(error, fake2, static_time, snapshot, spawn_client, resp_is):
    client = await spawn_client(authorize=True)

    if not error:
        await client.db.indexes.insert_one({"_id": "foobar", "version": 0})

    user_1 = await fake2.users.create()
    user_2 = await fake2.users.create()

    await client.db.history.insert_many(
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
        ]
    )

    resp = await client.get("/indexes/foobar/history")

    if error:
        await resp_is.not_found(resp)
        return

    assert resp.status == 200
    assert await resp.json() == snapshot


@pytest.mark.parametrize("error", [None, 404])
async def test_delete_index(spawn_job_client, error):
    index_id = "index1"

    index_document = {
        "_id": index_id,
    }

    mock_history_documents = [
        {"_id": _id, "index": {"id": index_id, "version": "test_version"}}
        for _id in ("history1", "history2", "history3")
    ]

    client = await spawn_job_client(authorize=True)
    indexes = client.db.indexes
    history = client.db.history

    if error != 404:
        await indexes.insert_one(index_document)
        await history.insert_many(mock_history_documents)

    response = await client.delete(f"/indexes/{index_id}")

    if error is not None:
        assert error == response.status
    else:
        assert 204 == response.status
        async for doc in history.find({"index.id": index_id}):
            assert doc["index"]["id"] == doc["index"]["version"] == "unbuilt"


@pytest.mark.parametrize("error", [None, "409", "404_index", "404_file"])
async def test_upload(
    error,
    tmp_path,
    fake2,
    spawn_job_client,
    snapshot,
    static_time,
    resp_is,
    pg: AsyncEngine,
):
    client = await spawn_job_client(authorize=True)
    path = Path.cwd() / "tests" / "test_files" / "index" / "reference.1.bt2"

    files = {"file": open(path, "rb")}

    client.app["config"].data_path = tmp_path

    user = await fake2.users.create()

    index = {"_id": "foo", "reference": {"id": "bar"}, "user": {"id": user.id}}

    if error == "409":
        async with AsyncSession(pg) as session:
            session.add(SQLIndexFile(name="reference.1.bt2", index="foo"))
            await session.commit()

    if not error == "404_index":
        await client.db.indexes.insert_one(index)

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
    assert os.listdir(tmp_path / "references" / "bar" / "foo") == ["reference.1.bt2"]

    assert await resp.json() == snapshot
    assert await client.db.indexes.find_one("foo") == snapshot

    async with AsyncSession(pg) as session:
        assert (
            await session.execute(select(SQLIndexFile).filter_by(id=1))
        ).scalar() == snapshot


@pytest.mark.parametrize("error", [None, "409_genome", "409_fasta", "404_reference"])
async def test_finalize(
    error, snapshot, static_time, fake2, spawn_job_client, test_otu, pg
):
    """
    Test that an index can be finalized using the Jobs API.

    """
    client = await spawn_job_client(authorize=True)

    user = await fake2.users.create()

    if error == "409_genome":
        files = ["reference.fa.gz"]
    elif error == "409_fasta":
        files = ["reference.json.gz"]
    else:
        files = FILES

    if error != "404_reference":
        await client.db.references.insert_one({"_id": "hxn167", "data_type": "genome"})

    await client.db.indexes.insert_one(
        {
            "_id": "test_index",
            "reference": {"id": "hxn167"},
            "manifest": {"foo": 4},
            "user": {"id": user.id},
            "version": 2,
            "created_at": static_time.datetime,
            "has_files": True,
            "job": {"id": "sj82la"},
        }
    )

    # change `version` that should be reflected in `last_indexed_version` after calling
    test_otu["version"] = 1
    await client.db.otus.insert_one(test_otu)

    for file_name in files:
        await create_index_file(
            pg, "test_index", check_index_file_type(file_name), file_name, 9000
        )

    resp = await client.patch("/indexes/test_index")

    assert await resp.json() == snapshot

    if not error:
        assert resp.status == 200
        assert await client.db.otus.find_one("6116cba1") == snapshot


@pytest.mark.parametrize("status", [200, 404])
async def test_download(status, spawn_job_client, tmp_path):
    client = await spawn_job_client(authorize=True)

    client.app["config"].data_path = tmp_path

    await client.db.indexes.insert_one(
        {"_id": "test_index", "reference": {"id": "test_reference"}}
    )

    path = Path.cwd() / "tests" / "test_files" / "index" / "reference.1.bt2"
    target_path = tmp_path / "references" / "test_reference" / "test_index"
    target_path.mkdir(parents=True)
    shutil.copyfile(path, target_path / "reference.1.bt2")

    download_path = target_path / "downloads" / "reference.1.bt2"
    download_path.parent.mkdir()

    files_url = "/indexes/test_index/files/"

    if status == 200:
        files_url += "reference.1.bt2"
    elif status == 400:
        files_url += "foo.bar"

    async with client.get(files_url) as response:
        assert response.status == status
        if response.status == 200:
            with download_path.open("wb") as f:
                f.write(await response.read())

            assert filecmp.cmp(download_path, path)
