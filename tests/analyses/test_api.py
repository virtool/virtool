import io
import os
from pathlib import Path

import pytest
from aiohttp.test_utils import make_mocked_coro
from tests.fixtures.fake import FakeGenerator
from virtool.analyses.files import create_analysis_file
from virtool.analyses.models import AnalysisFile
from virtool.pg.utils import get_row_by_id


@pytest.fixture
def files(tmp_path):
    path = Path.cwd() / "tests" / "test_files" / "aodp" / "reference.fa"

    data = {
        "file": open(path, "rb")
    }

    return data


async def test_find(snapshot, mocker, fake, spawn_client, resp_is, static_time):
    mocker.patch("virtool.samples.utils.get_sample_rights",
                 return_value=(True, True))

    client = await spawn_client(authorize=True)

    user = await fake.users.insert()

    await client.db.samples.insert_one({
        "_id": "test",
        "created_at": static_time.datetime,
        "all_read": True,
        "all_write": True,
        "user": {
            "id": user["_id"]
        }
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
                "id": user["_id"]
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
                "id": user["_id"]
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
                "id": user["_id"]
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
    assert await resp.json() == snapshot


@pytest.mark.parametrize("ready", [True, False])
@pytest.mark.parametrize("error", [None, "400", "403", "404"])
async def test_get(ready, fake: FakeGenerator, error, mocker, snapshot, spawn_client, static_time, resp_is, pg):
    client = await spawn_client(authorize=True)

    user = await fake.users.insert()

    document = {
        "_id": "foobar",
        "created_at": static_time.datetime,
        "ready": ready,
        "workflow": "pathoscope_bowtie",
        "results": {},
        "sample": {
            "id": "baz"
        },
        "subtractions": ["plum", "apple"],
        "user": {
            "id": user["_id"]
        }
    }

    await client.db.subtraction.insert_many([
        {
            "_id": "plum",
            "name": "Plum"
        },
        {
            "_id": "apple",
            "name": "Apple"
        }
    ])

    if error != "400":
        await client.db.samples.insert_one({
            "_id": "baz",
            "all_read": error != "403",
            "all_write": False,
            "group": "tech",
            "group_read": True,
            "group_write": True,
            "subtractions": ["apple", "plum"],
            "user": {
                "id": "fred"
            }
        })

    if error != "404":
        await client.db.analyses.insert_one(document)
        await create_analysis_file(pg, "foobar", "fasta", "reference.fa")

    m_format_analysis = mocker.patch(
        "virtool.analyses.format.format_analysis",
        make_mocked_coro({
            "_id": "foo",
            "created_at": static_time.datetime,
            "formatted": True,
            "user": {
                "id": user["_id"]
            }
        })
    )

    resp = await client.get("/api/analyses/foobar")

    if error == "400":
        await resp_is.bad_request(resp, "Parent sample does not exist")
        return

    if error == "403":
        await resp_is.insufficient_rights(resp)
        return

    if error == "404":
        await resp_is.not_found(resp)
        return

    assert resp.status == 200
    assert await resp.json() == snapshot

    if ready:
        args = m_format_analysis.call_args[0]
        assert args[0] == client.app
        assert args[1] == snapshot
    else:
        assert not m_format_analysis.called


@pytest.mark.parametrize("error", [None, "400", "403", "404", "409"])
async def test_remove(mocker, error, fake, spawn_client, resp_is, tmp_path):
    client = await spawn_client(authorize=True)

    client.app["config"].data_path = tmp_path

    user = await fake.users.insert()

    if error != "400":
        await client.db.samples.insert_one({
            "_id": "baz",
            "all_read": True,
            "all_write": error != "403",
            "group": "tech",
            "group_read": True,
            "group_write": True,
            "user": {
                "id": user["_id"]
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
        await resp_is.bad_request(resp, "Parent sample does not exist")
        return

    if error == "403":
        await resp_is.insufficient_rights(resp)
        return

    if error == "404":
        await resp_is.not_found(resp)
        return

    if error == "409":
        await resp_is.conflict(resp, "Analysis is still running")
        return

    await resp_is.no_content(resp)

    assert await client.db.analyses.find_one() is None

    assert m_remove.called_with("data/samples/baz/analyses/foobar", True)


@pytest.mark.parametrize("error", [None, 400, 404, 422])
async def test_upload_file(error, files, resp_is, spawn_job_client, static_time, snapshot, pg, tmp_path):
    """
    Test that an analysis result file is properly uploaded and a row is inserted into the `analysis_files` SQL table.

    """
    client = await spawn_job_client(authorize=True)

    client.app["config"].data_path = tmp_path

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
        })

    if error == 422:
        resp = await client.put("/api/analyses/foobar/files?format=fasta", data=files)
    else:
        resp = await client.put(f"/api/analyses/foobar/files?name=reference.fa&format={format_}", data=files)

    if error is None:
        assert resp.status == 201
        assert await resp.json() == snapshot
        assert os.listdir(tmp_path / "analyses") == ["1-reference.fa"]
        assert await get_row_by_id(pg, AnalysisFile, 1)

    elif error == 400:
        await resp_is.bad_request(resp, "Unsupported analysis file format")

    elif error == 404:
        assert resp.status == 404

    elif error == 422:
        await resp_is.invalid_query(resp, {
            "name": ["required field"]
        })


@pytest.mark.parametrize("file_exists", [True, False])
@pytest.mark.parametrize("row_exists", [True, False])
async def test_download_analysis_result(
    file_exists,
    row_exists,
    files,
    spawn_client,
    spawn_job_client,
    snapshot,
    tmp_path
):
    """
    Test that you can properly download an analysis result file using details from the `analysis_files` SQL table

    """
    client = await spawn_client(authorize=True, administrator=True)
    job_client = await spawn_job_client(authorize=True)

    client.app["config"].data_path = tmp_path
    job_client.app["config"].data_path = tmp_path

    expected_path = client.app["config"].data_path / \
        "analyses" / "1-reference.fa"

    await client.db.analyses.insert_one({
        "_id": "foobar",
        "ready": True,
        "job": {
            "id": "hello"
        },
    })

    if row_exists:
        await job_client.put("/api/analyses/foobar/files?name=reference.fa&format=fasta", data=files)
        assert expected_path.is_file()

    if not file_exists and row_exists:
        expected_path.unlink()

    resp = await client.get("/api/analyses/foobar/files/1")

    if file_exists and row_exists:
        assert resp.status == 200
        assert expected_path.read_bytes() == await resp.content.read()
    else:
        assert resp.status == 404
        assert await resp.json() == snapshot


@pytest.mark.parametrize("extension", ["csv", "xlsx"])
@pytest.mark.parametrize("exists", [True, False])
async def test_download_analysis_document(extension, exists, mocker, spawn_client):
    client = await spawn_client(authorize=True)

    if exists:
        await client.db.analyses.insert_one({
            "_id": "foobar",
            "ready": True,
        })

    mocker.patch(
        f"virtool.analyses.format.format_analysis_to_{'excel' if extension == 'xlsx' else 'csv'}",
        return_value=io.StringIO().getvalue()
    )

    resp = await client.get(f"/api/analyses/documents/foobar.{extension}")

    assert resp.status == 200 if exists else 400


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

    m_initialize_ncbi_blast = mocker.patch(
        "virtool.bio.initialize_ncbi_blast", make_mocked_coro(("FOOBAR1337", 23)))

    m_check_rid = mocker.patch(
        "virtool.bio.check_rid", make_mocked_coro(return_value=False))

    m_wait_for_blast_result = mocker.patch(
        "virtool.bio.wait_for_blast_result", make_mocked_coro())

    await client.put("/api/analyses/foobar/5/blast", {})

    resp = await client.put("/api/analyses/foobar/5/blast", {})

    if error == "400":
        await resp_is.bad_request(resp, "Parent sample does not exist")
        return

    if error == "403":
        await resp_is.insufficient_rights(resp)
        return

    if error == "404_analysis":
        await resp_is.not_found(resp, "Analysis not found")
        return

    if error == "404_sequence":
        await resp_is.not_found(resp, "Sequence not found")
        return

    if error == "409_workflow":
        await resp_is.conflict(resp, "Not a NuVs analysis")
        return

    if error == "409_ready":
        await resp_is.conflict(resp, "Analysis is still running")
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
        client.app["config"],
        "GGAGTTAGATTGG"
    )

    m_check_rid.assert_called_with(
        client.app["config"],
        "FOOBAR1337"
    )

    m_wait_for_blast_result.assert_called_with(
        client.app,
        "foobar",
        5,
        "FOOBAR1337"
    )


@pytest.mark.parametrize("error", [None, 422, 404, 409])
async def test_finalize(fake, snapshot, spawn_job_client, faker, error, resp_is):
    user = await fake.users.insert()

    analysis_document = {
        "_id": "analysis1",
        "sample": {
            "id": "sample1"
        },
        "workflow": "test_workflow",
        "user": {
            "id": user["_id"]
        },
        "ready": error == 409
    }

    patch_json = {
        "results": {
            "result": "TEST_RESULT"
        }
    }

    if error == 422:
        del patch_json["results"]

    client = await spawn_job_client(authorize=True)

    if error != 404:
        insert_result = await client.db.analyses.insert_one(analysis_document)
        assert insert_result["_id"] == analysis_document["_id"]

    resp = await client.patch(f"/api/analyses/{analysis_document['_id']}", json=patch_json)

    if error:
        assert resp.status == error
    else:
        assert resp.status == 200
        assert await resp.json() == snapshot

        document = await client.db.analyses.find_one()

        assert document == snapshot
        assert document["ready"] is True
