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


@pytest.mark.parametrize("name_exists", [True, False])
async def test_upload(name_exists, tmpdir, spawn_client, resp_is):
    client = await spawn_client(authorize=True, permissions=["modify_subtraction"])

    test_dir = tmpdir.mkdir("subtractions").mkdir("foo")
    test_dir.join("subtraction.1.bt2").write("Bowtie2 file")

    client.app["settings"]["data_path"] = str(tmpdir)
    subtraction = {
        "_id": "foo",
        "name": "Foo"
    }

    if name_exists:
        subtraction["files"] = [
            {
                "name": "subtraction.1.bt2",
                "type": "bowtie2"
            }
        ]

    await client.db.subtraction.insert_one(subtraction)

    resp = await client.post("/api/subtractions/foo/files", {"name": "subtraction.1.bt2"})

    if name_exists:
        assert resp.status == 400
        assert await resp_is.bad_request(resp, "File name already exists")
        return

    assert resp.status == 200
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
