import os

import aiohttp.test_utils
import pytest


@pytest.mark.parametrize("data", [
    {"name": "Bar"},
    {"nickname": "Bar Subtraction"},
    {"nickname": ""},
    {"name": "Bar", "nickname": "Bar Subtraction"}
])
async def test_edit(data, mocker, snapshot, spawn_client):
    mocker.patch("virtool.subtractions.db.get_linked_samples", aiohttp.test_utils.make_mocked_coro(12))

    client = await spawn_client(authorize=True, permissions=["modify_subtraction"])

    await client.db.subtraction.insert_one({
        "_id": "foo",
        "name": "Foo",
        "nickname": "Foo Subtraction"
    })

    resp = await client.patch("/api/subtractions/foo", data)

    assert resp.status == 200

    snapshot.assert_match(await resp.json(), "json")
    snapshot.assert_match(await client.db.subtraction.find_one(), "db")


@pytest.mark.parametrize("error", [None, "400_exists", "400_name", "404", "422"])
async def test_upload(error, tmpdir, spawn_client, snapshot, resp_is, pg_session):
    client = await spawn_client(authorize=True, permissions=["modify_subtraction"])
    test_dir = tmpdir.mkdir("files")
    test_dir.join("subtraction.1.bt2").write("Bowtie2 file")
    path = os.path.join(test_dir, "subtraction.1.bt2")

    files = {
        "file": open(path, "rb")
    }

    client.app["settings"]["data_path"] = str(tmpdir)

    subtraction = {
        "_id": "foo",
        "name": "Foo"
    }

    if error == "400_exists":
        subtraction["files"] = [1]

    await client.db.subtraction.insert_one(subtraction)

    url = "/api/subtractions/foo/files"

    if error == "422":
        url += "?type=fasta"
    elif error == "400_name":
        url += "?name=reference.1.bt2"
    else:
        url += "?name=subtraction.1.bt2"

    resp = await client.post_form(url, data=files)

    if error == "400_name":
        assert await resp_is.bad_request(resp, "Unsupported subtraction file name")
        return

    if error == "400_exists":
        assert await resp_is.bad_request(resp, "File name already exists")
        return

    if error == "422":
        assert await resp_is.invalid_query(resp, {'name': ['required field']})
        return

    assert resp.status == 201
    assert os.listdir(tmpdir / "subtractions" / "foo") == ["subtraction.1.bt2"]
    snapshot.assert_match(await resp.json())
    document = await client.db.subtraction.find_one("foo")
    assert document == {
        '_id': 'foo',
        'name': 'Foo',
        'files': [1]
    }


@pytest.mark.parametrize("error", [None, "404", "422"])
async def test_finalize_subtraction(error, spawn_job_client, snapshot, resp_is):
    subtraction = {
        "_id": "foo",
        "name": "Foo",
        "nickname": "Foo Subtraction"
    }

    data = {
        "gc": {
            "a": 0.319,
            "t": 0.319,
            "g": 0.18,
            "c": 0.18,
            "n": 0.002
        }
    }

    client = await spawn_job_client(authorize=True)

    if error == "422":
        data = {}

    if error != "404":
        await client.db.subtraction.insert_one(subtraction)

    resp = await client.patch(f"/api/subtractions/foo", json=data)

    if error == "404":
        assert await resp_is.not_found(resp)
        return

    if error == "422":
        assert await resp_is.invalid_input(resp, {'gc': ['required field']})
        return

    assert resp.status == 200
    snapshot.assert_match(await resp.json())
    document = await client.db.subtraction.find_one("foo")
    assert document == {
        "_id": "foo",
        "name": "Foo",
        "nickname": "Foo Subtraction",
        "gc": {
            "a": 0.319,
            "t": 0.319,
            "g": 0.18,
            "c": 0.18,
            "n": 0.002
        },
        "ready": True
    }
