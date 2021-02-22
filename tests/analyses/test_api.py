import os
import sys
from pathlib import Path

import pytest
from aiohttp.test_utils import make_mocked_coro

import virtool.analyses.db
import virtool.analyses.files
from virtool.utils import base_processor


@pytest.fixture
def files(tmpdir):
    tmpdir.mkdir("files")

    path = Path(sys.path[0]) / "tests" / "test_files" / "aodp" / "reference.fa"

    data = {
        "file": open(path, "rb")
    }

    return data


@pytest.mark.parametrize("ready", [True, False])
@pytest.mark.parametrize("error", [None, "400", "403", "404"])
async def test_get(ready, files, error, mocker, snapshot, spawn_client, static_time, resp_is, pg_engine):
    client = await spawn_client(authorize=True)

    document = {
        "_id": "foobar",
        "created_at": static_time.datetime,
        "files": ["1-reference.fa"],
        "ready": ready,
        "workflow": "pathoscope_bowtie",
        "results": {},
        "sample": {
            "id": "baz"
        },
        "subtraction": {
            "id": "plum"
        }
    }

    await client.db.subtraction.insert_one({
        "_id": "plum",
        "name": "Plum"
    })

    if error != "400":
        await client.db.samples.insert_one({
            "_id": "baz",
            "all_read": error != "403",
            "all_write": False,
            "group": "tech",
            "group_read": True,
            "group_write": True,
            "subtraction": {
                "id": "Apple"
            },
            "user": {
                "id": "fred"
            }
        })

    if error != "404":
        await client.db.analyses.insert_one(document)

        await virtool.analyses.files.create_analysis_file(pg_engine, "foobar", "fasta", "reference.fa")

    m_format_analysis = mocker.patch(
        "virtool.analyses.format.format_analysis",
        make_mocked_coro({
            "_id": "foo",
            "created_at": static_time.datetime,
            "formatted": True
        })
    )

    resp = await client.get("/api/analyses/foobar")

    if error == "400":
        assert await resp_is.bad_request(resp, "Parent sample does not exist")
        return

    if error == "403":
        assert await resp_is.insufficient_rights(resp)
        return

    if error == "404":
        assert await resp_is.not_found(resp)
        return

    assert resp.status == 200

    snapshot.assert_match(await resp.json())

    if ready:
        args = m_format_analysis.call_args[0]
        assert args[0] == client.app
        snapshot.assert_match(args[1], "format_analysis")
    else:
        assert not m_format_analysis.called


async def test_find(snapshot, mocker, spawn_client, resp_is, static_time):
    mocker.patch("virtool.samples.utils.get_sample_rights", return_value=(True, True))

    client = await spawn_client(authorize=True)

    await client.db.samples.insert_one({
        "_id": "test",
        "created_at": static_time.datetime,
        "all_read": True,
        "all_write": True
    })

    await client.db.analyses.insert_many([
        {
            "_id": "test_1",
            "workflow": "pathoscope_bowtie",
            "created_at": static_time.datetime,
            "ready": True,
            "job": {
                "id": "test"
            },
            "index": {
                "version": 2,
                "id": "foo"
            },
            "user": {
                "id": "bob"
            },
            "sample": {
                "id": "test"
            },
            "reference": {
                "id": "baz",
                "name": "Baz"
            },
            "foobar": True
        },
        {
            "_id": "test_2",
            "workflow": "pathoscope_bowtie",
            "created_at": static_time.datetime,
            "ready": True,
            "job": {
                "id": "test"
            },
            "index": {
                "version": 2,
                "id": "foo"
            },
            "user": {
                "id": "fred"
            },
            "sample": {
                "id": "test"
            },
            "reference": {
                "id": "baz",
                "name": "Baz"
            },
            "foobar": True
        },
        {
            "_id": "test_3",
            "workflow": "pathoscope_bowtie",
            "created_at": static_time.datetime,
            "ready": True,
            "job": {
                "id": "test"
            },
            "index": {
                "version": 2,
                "id": "foo"
            },
            "user": {
                "id": "fred"
            },
            "sample": {
                "id": "test"
            },
            "reference": {
                "id": "foo",
                "name": "Foo"
            },
            "foobar": False
        },
    ])

    resp = await client.get("/api/analyses")

    assert resp.status == 200

    snapshot.assert_match(await resp.json())


@pytest.mark.parametrize("error", [None, "400", "403", "404", "409"])
async def test_remove(mocker, error, spawn_client, resp_is):
    client = await spawn_client(authorize=True)

    client.app["settings"]["data_path"] = "data"

    if error != "400":
        await client.db.samples.insert_one({
            "_id": "baz",
            "all_read": True,
            "all_write": error != "403",
            "group": "tech",
            "group_read": True,
            "group_write": True,
            "user": {
                "id": "fred"
            }
        })

    if error != "404":
        await client.db.analyses.insert_one({
            "_id": "foobar",
            "ready": error != "409",
            "sample": {
                "id": "baz",
                "name": "Baz"
            },
            "job": {
                "id": "hello"
            }
        })

    m_remove = mocker.patch("virtool.utils.rm")

    resp = await client.delete("/api/analyses/foobar")

    if error == "400":
        assert await resp_is.bad_request(resp, "Parent sample does not exist")
        return

    if error == "403":
        assert await resp_is.insufficient_rights(resp)
        return

    if error == "404":
        assert await resp_is.not_found(resp)
        return

    if error == "409":
        assert await resp_is.conflict(resp, "Analysis is still running")
        return

    assert resp.status == 204

    assert await client.db.analyses.find_one() is None

    assert m_remove.called_with("data/samples/baz/analyses/foobar", True)


@pytest.mark.parametrize("error", [None, 400, 404, 422])
async def test_upload_file(error, files, resp_is, spawn_client, static_time, snapshot, tmpdir):
    """
    Test that an analysis result file is properly uploaded, a record is inserted into the `analysis_files` SQL table,
    and that the `list` field in a given analysis is updated to reflect the new file.

    """
    client = await spawn_client(authorize=True, administrator=True)

    client.app["settings"]["data_path"] = str(tmpdir)

    if error == 400:
        format_ = "foo"
    else:
        format_ = "fasta"

    if error != 404:
        await client.db.analyses.insert_one({
            "_id": "foobar",
            "ready": True,
            "job": {
                "id": "hello"
            },
            "files": []
        })

    if error == 422:
        resp = await client.post_form("/api/analyses/foobar/files?format=fasta", data=files)
    else:
        resp = await client.post_form(f"/api/analyses/foobar/files?name=reference.fa&format={format_}", data=files)

    if error is None:
        assert resp.status == 201

        snapshot.assert_match(await resp.json())

        assert os.listdir(tmpdir / "analyses") == ["1-reference.fa"]

        document = await client.db.analyses.find_one("foobar")

        assert document["files"] == [1]

    elif error == 400:
        assert await resp_is.bad_request(resp, "Unsupported analysis file format")

    elif error == 404:
        assert resp.status == 404

    elif error == 422:
        assert await resp_is.invalid_query(resp, {
            "name": ["required field"]
        })


@pytest.mark.parametrize("file_exists", [True, False])
@pytest.mark.parametrize("row_exists", [True, False])
async def test_download_file(file_exists, row_exists, files, spawn_client, snapshot, tmpdir):
    """
    Test that you can properly download an analysis result file using details from the `analysis_files` SQL table

    """
    client = await spawn_client(authorize=True, administrator=True)

    client.app["settings"]["data_path"] = str(tmpdir)

    expected_path = Path(client.app["settings"]["data_path"]) / "analyses" / "1-reference.fa"

    await client.db.analyses.insert_one({
        "_id": "foobar",
        "ready": True,
        "job": {
            "id": "hello"
        },
        "files": []
    })

    if row_exists:
        await client.post_form("/api/analyses/foobar/files?name=reference.fa&format=fasta", data=files)

        assert expected_path.is_file()

    if not file_exists and row_exists:
        expected_path.unlink()

    resp = await client.get("/api/analyses/foobar/files/1")

    if file_exists and row_exists:
        assert resp.status == 200
        assert expected_path.read_bytes() == await resp.content.read()
    else:
        assert resp.status == 404
        snapshot.assert_match(await resp.json())


@pytest.mark.parametrize("error", [None, "400", "403", "404_analysis", "404_sequence", "409_workflow", "409_ready"])
async def test_blast(error, mocker, spawn_client, resp_is, static_time):
    """
    Test that the handler starts a BLAST for given NuVs sequence. Also check that it handles all error conditions
    correctly.

    """
    client = await spawn_client(authorize=True)

    if error != "404_analysis":
        analysis_document = {
            "_id": "foobar",
            "workflow": "nuvs",
            "ready": True,
            "results": [
                {"index": 3, "sequence": "ATAGAGATTAGAT"},
                {"index": 5, "sequence": "GGAGTTAGATTGG"},
                {"index": 8, "sequence": "ACCAATAGACATT"}
            ],
            "sample": {
                "id": "baz"
            }
        }

        if error == "404_sequence":
            analysis_document["results"].pop(1)

        elif error == "409_workflow":
            analysis_document["workflow"] = "pathoscope_bowtie"

        elif error == "409_ready":
            analysis_document["ready"] = False

        if error != "400":
            await client.db.samples.insert_one({
                "_id": "baz",
                "all_read": True,
                "all_write": error != "403",
                "group": "tech",
                "group_read": True,
                "group_write": True,
                "user": {
                    "id": "fred"
                }
            })

        await client.db.analyses.insert_one(analysis_document)

    m_initialize_ncbi_blast = mocker.patch("virtool.bio.initialize_ncbi_blast", make_mocked_coro(("FOOBAR1337", 23)))

    m_check_rid = mocker.patch("virtool.bio.check_rid", make_mocked_coro(return_value=False))

    m_wait_for_blast_result = mocker.patch("virtool.bio.wait_for_blast_result", make_mocked_coro())

    await client.put("/api/analyses/foobar/5/blast", {})

    resp = await client.put("/api/analyses/foobar/5/blast", {})

    if error == "400":
        assert await resp_is.bad_request(resp, "Parent sample does not exist")
        return

    if error == "403":
        assert await resp_is.insufficient_rights(resp)
        return

    if error == "404_analysis":
        assert await resp_is.not_found(resp, "Analysis not found")
        return

    if error == "404_sequence":
        assert await resp_is.not_found(resp, "Sequence not found")
        return

    if error == "409_workflow":
        assert await resp_is.conflict(resp, "Not a NuVs analysis")
        return

    if error == "409_ready":
        assert await resp_is.conflict(resp, "Analysis is still running")
        return

    assert resp.status == 201
    assert resp.headers["Location"] == "/api/analyses/foobar/5/blast"

    blast = {
        "rid": "FOOBAR1337",
        "interval": 3,
        "last_checked_at": static_time.iso,
        "ready": False,
        "result": None
    }

    assert await resp.json() == blast

    m_initialize_ncbi_blast.assert_called_with(
        client.app["settings"],
        "GGAGTTAGATTGG"
    )

    m_check_rid.assert_called_with(
        client.app["settings"],
        "FOOBAR1337"
    )

    m_wait_for_blast_result.assert_called_with(
        client.app,
        "foobar",
        5,
        "FOOBAR1337"
    )


@pytest.mark.parametrize("error", [None, 422, 404, 409])
async def test_patch_to_set_result(spawn_job_client, error, resp_is):
    analysis_document = {
        "_id": "analysis1",
        "sample": {"id": "sample1"},
        "workflow": "test_workflow",
    }

    patch_json = {
        "results": {
            "result": "TEST_RESULT"
        }
    }

    client = await spawn_job_client(authorize=True)

    if error == 409:
        analysis_document["ready"] = True
    elif error == 422:
        patch_json = {}

    if error != 404:
        insert_result = await client.db.analyses.insert_one(analysis_document)
        assert insert_result["_id"] == analysis_document["_id"]

    response = await client.patch(f"/api/analyses/{analysis_document['_id']}", json=patch_json)

    if error:
        assert response.status == error
    else:
        assert response.status == 200
        document = await client.db.analyses.find_one({"_id": analysis_document["_id"]})

        assert document["results"] == patch_json["results"]
        assert document["ready"] is True

        response_json = await response.json()

        assert response_json == base_processor(document)
