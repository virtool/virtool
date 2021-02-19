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


@pytest.mark.parametrize("error", [None, "400_exists", "400_name", "422"])
async def test_upload(error, tmpdir, spawn_client, resp_is):
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
        subtraction["files"] = [
            {
                "name": "subtraction.1.bt2",
                "size": 1234567,
                "type": "bowtie2"
            }
        ]

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
        assert await resp_is.bad_request(resp, "Unaccepted subtraction file name")
        return

    if error == "400_exists":
        assert await resp_is.bad_request(resp, "File name already exists")
        return

    if error == "422":
        assert await resp_is.invalid_query(resp, {'name': ['required field']})
        return

    assert resp.status == 201
    assert os.listdir(tmpdir / "subtractions" / "foo") == ["subtraction.1.bt2"]
    assert await resp.json() == {
        'id': 'foo',
        'name': 'Foo',
        'files': [
            {
                'size': os.stat(os.path.join(test_dir, "subtraction.1.bt2")).st_size,
                'name': 'subtraction.1.bt2',
                'type': 'bowtie2'
            }
        ]
    }
