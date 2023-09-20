import asyncio
import io
import json

import pytest
from aiohttp.test_utils import make_mocked_coro
from faker import Faker

from virtool.analyses.files import create_analysis_file
from virtool.config import get_config_from_app


@pytest.fixture
def files(test_files_path, tmp_path):
    path = test_files_path / "aodp" / "reference.fa"

    data = {"file": open(path, "rb")}

    return data


@pytest.mark.apitest
async def test_find(snapshot, mocker, fake2, spawn_client, resp_is, static_time):
    mocker.patch("virtool.samples.utils.get_sample_rights", return_value=(True, True))

    client = await spawn_client(authorize=True)

    user_1 = await fake2.users.create()
    user_2 = await fake2.users.create()

    job = await fake2.jobs.create(user=user_2)

    await asyncio.gather(
        client.db.references.insert_many(
            [
                {"_id": "foo", "data_type": "genome", "name": "Foo"},
                {"_id": "baz", "data_type": "genome", "name": "Baz"},
            ],
            session=None,
        ),
        client.db.samples.insert_one(
            {
                "_id": "test",
                "created_at": static_time.datetime,
                "all_read": True,
                "all_write": True,
                "user": {"id": user_1.id},
                "labels": [],
            }
        ),
        client.db.subtraction.insert_one(
            {"_id": "foo", "name": "Malus domestica", "nickname": "Apple"}
        ),
        client.db.analyses.insert_many(
            [
                {
                    "_id": "test_1",
                    "workflow": "pathoscope_bowtie",
                    "created_at": static_time.datetime,
                    "ready": True,
                    "job": {"id": job.id},
                    "index": {"version": 2, "id": "foo"},
                    "user": {"id": user_1.id},
                    "sample": {"id": "test"},
                    "reference": {"id": "baz", "name": "Baz"},
                    "results": {"hits": []},
                    "subtractions": [],
                    "foobar": True,
                },
                {
                    "_id": "test_2",
                    "workflow": "pathoscope_bowtie",
                    "created_at": static_time.datetime,
                    "ready": True,
                    "job": {"id": job.id},
                    "index": {"version": 2, "id": "foo"},
                    "user": {"id": user_1.id},
                    "sample": {"id": "test"},
                    "reference": {"id": "baz", "name": "Baz"},
                    "results": {"hits": []},
                    "subtractions": ["foo"],
                    "foobar": True,
                },
                {
                    "_id": "test_3",
                    "workflow": "pathoscope_bowtie",
                    "created_at": static_time.datetime,
                    "ready": True,
                    "job": None,
                    "index": {"version": 2, "id": "foo"},
                    "user": {"id": user_1.id},
                    "sample": {"id": "test"},
                    "reference": {"id": "foo"},
                    "results": {"hits": []},
                    "subtractions": [],
                    "foobar": False,
                },
            ],
            session=None,
        ),
    )

    resp = await client.get("/analyses")

    assert resp.status == 200
    assert await resp.json() == snapshot


@pytest.mark.apitest
@pytest.mark.parametrize("ready, job_exists", [(True, True), (False, False)])
@pytest.mark.parametrize(
    "error",
    [
        None,
        "403",
        "404_analysis",
        "404_sample",
    ],
)
async def test_get(
    ready,
    job_exists,
    fake2,
    error,
    mocker,
    snapshot,
    spawn_client,
    static_time,
    resp_is,
    pg,
):
    client = await spawn_client(authorize=True)

    user_1 = await fake2.users.create()
    user_2 = await fake2.users.create()

    job = await fake2.jobs.create(user=user_2)

    document = {
        "_id": "foobar",
        "created_at": static_time.datetime,
        "ready": ready,
        "job": {"id": job.id if job_exists else "test"},
        "index": {"version": 3, "id": "bar"},
        "workflow": "pathoscope_bowtie",
        "results": {"hits": []},
        "sample": {"id": "baz"},
        "reference": {"id": "baz"},
        "subtractions": ["plum", "apple"],
        "user": {"id": user_1.id},
    }

    await asyncio.gather(
        client.db.subtraction.insert_many(
            [{"_id": "plum", "name": "Plum"}, {"_id": "apple", "name": "Apple"}],
            session=None,
        ),
        client.db.references.insert_one(
            {"_id": "baz", "data_type": "genome", "name": "Baz"}
        ),
    )

    if error != "404_sample":
        await client.db.samples.insert_one(
            {
                "_id": "baz",
                "all_read": error != "403",
                "all_write": False,
                "group": "tech",
                "group_read": True,
                "group_write": True,
                "labels": [],
                "subtractions": ["apple", "plum"],
                "user": {"id": user_1.id},
            }
        )

    if error != "404_analysis":
        await client.db.analyses.insert_one(document)
        await create_analysis_file(pg, "foobar", "fasta", "reference.fa")

    m_format_analysis = mocker.patch(
        "virtool.analyses.format.format_analysis",
        make_mocked_coro(
            {
                "_id": "foobar",
                "created_at": static_time.datetime,
                "ready": True,
                "job": {
                    "archived": False,
                    "created_at": static_time.datetime,
                    "id": "7cf872dc",
                    "progress": 0,
                    "stage": None,
                    "state": "waiting",
                    "user": {
                        "administrator": False,
                        "handle": "zclark",
                        "id": "fb085f7f",
                    },
                    "workflow": "jobs_aodp",
                },
                "index": {"version": 3, "id": "bar"},
                "workflow": "pathoscope_bowtie",
                "results": {"hits": []},
                "sample": {"id": "baz"},
                "reference": {"_id": "baz", "data_type": "genome", "name": "Baz"},
                "subtractions": [
                    {"_id": "apple", "name": "Apple"},
                    {"_id": "plum", "name": "Plum"},
                ],
                "user": {
                    "_id": "bf1b993c",
                    "handle": "leeashley",
                    "administrator": False,
                },
                "files": [
                    {
                        "id": 1,
                        "analysis": "foobar",
                        "description": None,
                        "format": "fasta",
                        "name": "reference.fa",
                        "name_on_disk": "1-reference.fa",
                        "size": None,
                        "uploaded_at": None,
                    }
                ],
            }
        ),
    )

    resp = await client.get(url="/analyses/foobar")

    if error is None:
        assert resp.status == 200
        assert await resp.json() == snapshot

        if ready:
            args = m_format_analysis.call_args[0]
            assert args[0] == get_config_from_app(client.app)
            assert args[2] == snapshot
        else:
            assert not m_format_analysis.called

    elif error == "403":
        await resp_is.insufficient_rights(resp)

    elif error.startswith("404"):
        await resp_is.not_found(resp)


@pytest.mark.apitest
@pytest.mark.parametrize("ready", [True, False])
@pytest.mark.parametrize("error", ["304"])
async def test_get_304(
    ready, fake2, error, mocker, snapshot, spawn_client, static_time, resp_is, pg
):
    client = await spawn_client(authorize=True)

    user = await fake2.users.create()

    document = {
        "_id": "foobar",
        "created_at": static_time.datetime,
        "ready": ready,
        "job": {"id": "test"},
        "index": {"version": 3, "id": "bar"},
        "workflow": "pathoscope_bowtie",
        "results": {"hits": []},
        "sample": {"id": "baz"},
        "reference": {"id": "baz"},
        "subtractions": ["plum", "apple"],
        "user": {"id": user.id},
    }

    await asyncio.gather(
        client.db.subtraction.insert_many(
            [{"_id": "plum", "name": "Plum"}, {"_id": "apple", "name": "Apple"}],
            session=None,
        ),
        client.db.references.insert_one(
            {"_id": "baz", "data_type": "genome", "name": "Baz"}
        ),
    )

    await client.db.samples.insert_one(
        {
            "_id": "baz",
            "all_read": error != "403",
            "all_write": False,
            "group": "tech",
            "group_read": True,
            "group_write": True,
            "labels": [],
            "subtractions": ["apple", "plum"],
            "user": {"id": user.id},
        }
    )

    await client.db.analyses.insert_one(document)
    await create_analysis_file(pg, "foobar", "fasta", "reference.fa")

    resp = await client.get(
        url="/analyses/foobar", headers={"If-Modified-Since": "2015-10-06T20:00:00Z"}
    )

    if error == "304":
        assert resp.status == 304


@pytest.mark.apitest
@pytest.mark.parametrize("error", [None, "403", "404_analysis", "404_sample", "409"])
async def test_remove(
    mocker, error, fake2, spawn_client, resp_is, tmp_path, static_time
):
    client = await spawn_client(authorize=True)

    get_config_from_app(client.app).data_path = tmp_path

    user = await fake2.users.create()

    await asyncio.gather(
        client.db.indexes.insert_one(
            {"_id": "bar", "version": 3, "reference": {"id": "baz"}}
        ),
        client.db.references.insert_one(
            {"_id": "baz", "data_type": "genome", "name": "Baz"}
        ),
    )

    if error != "404_sample":
        await client.db.samples.insert_one(
            {
                "_id": "baz",
                "all_read": True,
                "all_write": error != "403",
                "created_at": static_time.datetime,
                "format": "fastq",
                "group": "tech",
                "group_read": True,
                "group_write": True,
                "hold": False,
                "host": "",
                "is_legacy": False,
                "isolate": "",
                "library_type": "normal",
                "locale": "",
                "name": "Sample 1",
                "notes": "",
                "ready": True,
                "user": {"id": user.id},
            }
        )

    if error != "404_analysis":
        await client.db.analyses.insert_one(
            {
                "_id": "foobar",
                "created_at": static_time.datetime,
                "index": {"id": "bar", "version": 3},
                "job": {"id": "hello"},
                "ready": error != "409",
                "reference": {"id": "baz"},
                "sample": {"id": "baz", "name": "Baz"},
                "user": {"id": user.id},
                "workflow": "pathoscope_bowtie",
                "results": {"hits": []},
            }
        )

    m_remove = mocker.patch("virtool_core.utils.rm")

    resp = await client.delete("/analyses/foobar")

    if error is None:
        await resp_is.no_content(resp)

        assert await client.db.analyses.find_one() is None

        assert m_remove.called_with("data/samples/baz/analyses/foobar", True)

    elif error == "403":
        await resp_is.insufficient_rights(resp)
        return

    elif error.startswith("404"):
        await resp_is.not_found(resp)
        return

    elif error == "409":
        await resp_is.conflict(resp, "Analysis is still running")
        return


@pytest.mark.apitest
@pytest.mark.parametrize("error", [None, 400, 404, 422])
async def test_upload_file(error, files, resp_is, spawn_job_client, tmp_path):
    """
    Test that an analysis result file is properly uploaded and a row is inserted into the `analysis_files` SQL table.

    """
    client = await spawn_job_client(authorize=True)

    if error == 400:
        format_ = "foo"
    else:
        format_ = "fasta"

    if error != 404:
        await client.db.analyses.insert_one(
            {"_id": "foobar", "ready": True, "job": {"id": "hello"}}
        )

    if error == 422:
        resp = await client.put("/analyses/foobar/files?format=fasta", data=files)
    else:
        resp = await client.put(
            f"/analyses/foobar/files?name=reference.fa&format={format_}", data=files
        )

    if error is None:
        assert resp.status == 201
    elif error == 400:
        await resp_is.bad_request(resp, "Unsupported analysis file format")
    elif error == 404:
        assert resp.status == 404
    elif error == 422:
        await resp_is.invalid_query(resp, {"name": ["required field"]})


@pytest.mark.apitest
@pytest.mark.parametrize("file_exists", [True, False])
@pytest.mark.parametrize("row_exists", [True, False])
async def test_download_analysis_result(
    file_exists, row_exists, files, spawn_client, spawn_job_client, snapshot, tmp_path
):
    """
    Test that you can properly download an analysis result file using details from the `analysis_files` SQL table

    """
    client = await spawn_client(authorize=True, administrator=True)
    job_client = await spawn_job_client(authorize=True)

    get_config_from_app(client.app).data_path = tmp_path
    get_config_from_app(job_client.app).data_path = tmp_path

    expected_path = (
        get_config_from_app(client.app).data_path / "analyses" / "1-reference.fa"
    )

    await client.db.analyses.insert_one(
        {"_id": "foobar", "ready": True, "job": {"id": "hello"}}
    )

    if row_exists:
        await job_client.put(
            "/analyses/foobar/files?name=reference.fa&format=fasta", data=files
        )
        assert expected_path.is_file()

    if not file_exists and row_exists:
        expected_path.unlink()

    resp = await client.get("/analyses/foobar/files/1")

    if file_exists and row_exists:
        assert resp.status == 200
        assert expected_path.read_bytes() == await resp.content.read()
    else:
        assert resp.status == 404
        assert await resp.json() == snapshot


@pytest.mark.apitest
@pytest.mark.parametrize("extension", ["csv", "xlsx", "bug"])
@pytest.mark.parametrize("exists", [True, False])
async def test_download_analysis_document(extension, exists, mocker, spawn_client):
    client = await spawn_client(authorize=True)

    if exists:
        await client.db.analyses.insert_one({"_id": "foobar", "ready": True})

    mocker.patch(
        f"virtool.analyses.format.format_analysis_to_{'excel' if extension == 'xlsx' else 'csv'}",
        return_value=io.StringIO().getvalue(),
    )

    resp = await client.get(f"/analyses/documents/foobar.{extension}")

    if extension == "bug":
        assert resp.status == 400
    elif not exists:
        assert resp.status == 404
    else:
        assert resp.status == 200


@pytest.mark.apitest
@pytest.mark.parametrize(
    "error",
    [
        None,
        "403",
        "404_analysis",
        "404_sample",
        "404_sequence",
        "409_workflow",
        "409_ready",
    ],
)
async def test_blast(error, spawn_client, resp_is, snapshot, static_time):
    """
    Test that the handler starts a BLAST for given NuVs sequence. Also check that it handles all error conditions
    correctly.

    """
    client = await spawn_client(authorize=True, base_url="https://virtool.example.com")

    if error != "404_analysis":
        analysis_document = {
            "_id": "foobar",
            "workflow": "nuvs",
            "ready": True,
            "results": {
                "hits": [
                    {"index": 3, "sequence": "ATAGAGATTAGAT"},
                    {"index": 5, "sequence": "GGAGTTAGATTGG"},
                    {"index": 8, "sequence": "ACCAATAGACATT"},
                ]
            },
            "sample": {"id": "baz"},
        }

        if error == "404_sequence":
            analysis_document["results"]["hits"].pop(1)

        elif error == "409_workflow":
            analysis_document["workflow"] = "pathoscope_bowtie"

        elif error == "409_ready":
            analysis_document["ready"] = False

        if error != "404_sample":
            await client.db.samples.insert_one(
                {
                    "_id": "baz",
                    "all_read": True,
                    "all_write": error != "403",
                    "group": "tech",
                    "group_read": True,
                    "group_write": True,
                    "user": {"id": "fred"},
                }
            )

        await client.db.analyses.insert_one(analysis_document)

    await client.put("/analyses/foobar/5/blast", {})

    resp = await client.put("/analyses/foobar/5/blast", {})

    if error is None:
        assert resp.status == 201

        assert (
            resp.headers["Location"]
            == "https://virtool.example.com/analyses/foobar/5/blast"
        )

        assert await resp.json() == snapshot

    elif error == "403":
        await resp_is.insufficient_rights(resp)

    elif error == "404_analysis":
        await resp_is.not_found(resp)

    elif error == "404_sequence":
        await resp_is.not_found(resp, "Sequence not found")

    elif error == "409_workflow":
        await resp_is.conflict(resp, "Not a NuVs analysis")

    elif error == "409_ready":
        await resp_is.conflict(resp, "Analysis is still running")


@pytest.mark.apitest
@pytest.mark.parametrize("error", [None, 422, 404, 409])
async def test_finalize(error, fake2, snapshot, spawn_job_client, static_time):
    user_1 = await fake2.users.create()
    user_2 = await fake2.users.create()

    job = await fake2.jobs.create(user=user_2)

    patch_json = {"results": {"result": "TEST_RESULT", "hits": []}}

    if error == 422:
        del patch_json["results"]

    client = await spawn_job_client(authorize=True)

    await asyncio.gather(
        client.db.references.insert_one(
            {"_id": "baz", "name": "Baz", "data_type": "genome"}
        ),
        client.db.samples.insert_one(
            {
                "_id": "sample1",
                "all_read": True,
                "all_write": True,
                "created_at": static_time.datetime,
                "format": "fastq",
                "group": "none",
                "group_read": False,
                "group_write": False,
                "hold": False,
                "host": "",
                "is_legacy": False,
                "isolate": "",
                "library_type": "normal",
                "locale": "",
                "name": "Sample 1",
                "notes": "",
                "ready": True,
                "user": {"id": user_1.id},
            }
        ),
    )

    if error != 404:
        await client.db.analyses.insert_one(
            {
                "_id": "analysis1",
                "sample": {"id": "sample1"},
                "created_at": static_time.datetime,
                "files": [],
                "index": {"version": 2, "id": "foo"},
                "job": {"id": job.id},
                "ready": error == 409,
                "reference": {"id": "baz"},
                "subtractions": [],
                "user": {"id": user_1.id},
                "workflow": "nuvs",
            }
        )

    resp = await client.patch("/analyses/analysis1", json=patch_json)

    if error:
        assert resp.status == error
    else:
        assert resp.status == 200
        assert await resp.json() == snapshot

        document = await client.db.analyses.find_one()

        assert document == snapshot
        assert document["ready"] is True


@pytest.mark.apitest
async def test_finalize_large(fake2, snapshot, spawn_job_client, static_time):
    user = await fake2.users.create()

    faker = Faker(1)

    profiles = [
        faker.profile(
            fields=[
                "job",
                "company",
                "ssn",
                "residence",
                "address",
                "mail",
                "name",
                "username",
            ]
        )
        for _ in range(100)
    ]

    patch_json = {"results": {"hits": [], "extra_data": profiles * 500}}

    # Make sure this test actually checks that the max body size is increased.
    assert len(json.dumps(patch_json)) > 1024**2

    client = await spawn_job_client(authorize=True)

    await asyncio.gather(
        client.db.analyses.insert_one(
            {
                "_id": "analysis1",
                "created_at": static_time.datetime,
                "sample": {"id": "sample1"},
                "job": {"id": "test"},
                "index": {"version": 2, "id": "foo"},
                "workflow": "nuvs",
                "reference": {"id": "baz", "name": "Baz"},
                "files": [],
                "user": {"id": user.id},
                "ready": False,
                "subtractions": [],
            }
        ),
        client.db.references.insert_one(
            {"_id": "baz", "name": "Baz", "data_type": "genome"}
        ),
        client.db.samples.insert_one(
            {
                "_id": "sample1",
                "all_read": True,
                "all_write": True,
                "created_at": static_time.datetime,
                "format": "fastq",
                "group": "none",
                "group_read": False,
                "group_write": False,
                "hold": False,
                "host": "",
                "is_legacy": False,
                "isolate": "",
                "library_type": "normal",
                "locale": "",
                "name": "Sample 1",
                "notes": "",
                "ready": True,
                "user": {"id": user.id},
            }
        ),
    )

    resp = await client.patch("/analyses/analysis1", json=patch_json)

    assert resp.status == 200
    assert await resp.json() == snapshot
