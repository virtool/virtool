import asyncio
import os
from pathlib import Path
from pprint import pprint

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion
from virtool_core.models.job import JobState

from tests.fixtures.client import ClientSpawner, JobClientSpawner
from tests.fixtures.core import StaticTime
from tests.fixtures.response import RespIs
from virtool.analyses.files import create_analysis_file
from virtool.analyses.models import SQLAnalysisFile, SQLAnalysisResult
from virtool.config import get_config_from_app
from virtool.fake.next import DataFaker
from virtool.mongo.core import Mongo
from virtool.pg.utils import get_row_by_id


@pytest.fixture()
def create_files(test_files_path, tmp_path):
    def files():
        path = test_files_path / "aodp" / "reference.fa"
        data = {"file": open(path, "rb")}
        return data

    return files


async def test_find(
    fake: DataFaker,
    mocker: MockerFixture,
    mongo: Mongo,
    snapshot: SnapshotAssertion,
    spawn_client: ClientSpawner,
    static_time,
):
    mocker.patch("virtool.samples.utils.get_sample_rights", return_value=(True, True))

    client = await spawn_client(authenticated=True)

    user_1 = await fake.users.create()
    user_2 = await fake.users.create()

    job = await fake.jobs.create(user=user_2)

    await asyncio.gather(
        mongo.references.insert_many(
            [
                {"_id": "foo", "data_type": "genome", "name": "Foo"},
                {"_id": "baz", "data_type": "genome", "name": "Baz"},
            ],
            session=None,
        ),
        mongo.samples.insert_one(
            {
                "_id": "test",
                "created_at": static_time.datetime,
                "all_read": True,
                "all_write": True,
                "group": "none",
                "group_read": False,
                "group_write": False,
                "user": {"id": user_1.id},
                "labels": [],
            },
        ),
        mongo.subtraction.insert_one(
            {"_id": "foo", "name": "Malus domestica", "nickname": "Apple"},
        ),
        mongo.analyses.insert_many(
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
                    "reference": {"id": "baz"},
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
                    "reference": {"id": "baz"},
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


@pytest.mark.parametrize("ready, exists", [(True, True), (False, False)])
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
    ready: bool,
    exists: bool,
    error: str | None,
    fake: DataFaker,
    mongo: Mongo,
    pg: AsyncEngine,
    resp_is: RespIs,
    snapshot: SnapshotAssertion,
    spawn_client: ClientSpawner,
    static_time: StaticTime,
):
    client = await spawn_client(authenticated=True)

    user_1 = await fake.users.create()
    user_2 = await fake.users.create()

    job = await fake.jobs.create(user=user_2, state=JobState.COMPLETE)

    await asyncio.gather(
        mongo.subtraction.insert_many(
            [{"_id": "plum", "name": "Plum"}, {"_id": "apple", "name": "Apple"}],
            session=None,
        ),
        mongo.references.insert_one(
            {"_id": "baz", "data_type": "genome", "name": "Baz"},
        ),
    )

    if error != "404_sample":
        await mongo.samples.insert_one(
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
            },
        )

    if error != "404_analysis":
        await asyncio.gather(
            mongo.analyses.insert_one(
                {
                    "_id": "foobar",
                    "created_at": static_time.datetime,
                    "index": {"version": 3, "id": "bar"},
                    "job": {"id": job.id},
                    "ready": True,
                    "reference": {"id": "baz"},
                    "results": {"hits": []},
                    "sample": {"id": "baz"},
                    "subtractions": ["plum", "apple"],
                    "user": {"id": user_1.id},
                    "workflow": "pathoscope_bowtie",
                },
            ),
            create_analysis_file(pg, "foobar", "fasta", "reference.fa"),
        )

    resp = await client.get("/analyses/foobar")

    if error is None:
        assert resp.status == 200
        assert await resp.json() == snapshot

    elif error == "403":
        await resp_is.insufficient_rights(resp)

    elif error.startswith("404"):
        await resp_is.not_found(resp)


@pytest.mark.parametrize("ready", [True, False])
async def test_get_304(
    ready: bool,
    mongo: Mongo,
    fake: DataFaker,
    pg,
    spawn_client: ClientSpawner,
    static_time,
):
    client = await spawn_client(authenticated=True)

    user = await fake.users.create()

    await asyncio.gather(
        mongo.subtraction.insert_many(
            [{"_id": "plum", "name": "Plum"}, {"_id": "apple", "name": "Apple"}],
            session=None,
        ),
        mongo.references.insert_one(
            {"_id": "baz", "data_type": "genome", "name": "Baz"},
        ),
        mongo.samples.insert_one(
            {
                "_id": "baz",
                "all_read": True,
                "all_write": False,
                "group": "tech",
                "group_read": True,
                "group_write": True,
                "labels": [],
                "subtractions": ["apple", "plum"],
                "user": {"id": user.id},
            },
        ),
        mongo.analyses.insert_one(
            {
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
            },
        ),
    )

    await create_analysis_file(pg, "foobar", "fasta", "reference.fa")

    resp = await client.get(
        url="/analyses/foobar",
        headers={"If-Modified-Since": "2015-10-06T20:00:00Z"},
    )

    assert resp.status == 304


@pytest.mark.parametrize("error", [None, "403", "404_analysis", "404_sample", "409"])
async def test_remove(
    error: str | None,
    fake: DataFaker,
    mongo: Mongo,
    resp_is,
    spawn_client: ClientSpawner,
    static_time,
    tmp_path: Path,
):
    client = await spawn_client(authenticated=True)

    get_config_from_app(client.app).data_path = tmp_path

    user = await fake.users.create()

    await asyncio.gather(
        mongo.indexes.insert_one(
            {"_id": "bar", "version": 3, "reference": {"id": "baz"}},
        ),
        mongo.references.insert_one(
            {"_id": "baz", "data_type": "genome", "name": "Baz"},
        ),
        mongo.subtraction.insert_many(
            [{"_id": "plum", "name": "Plum"}, {"_id": "apple", "name": "Apple"}],
            session=None,
        ),
    )

    if error != "404_sample":
        await mongo.samples.insert_one(
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
                "subtractions": [],
                "user": {"id": user.id},
            },
        )

    if error != "404_analysis":
        await mongo.analyses.insert_one(
            {
                "_id": "foobar",
                "created_at": static_time.datetime,
                "index": {"id": "bar", "version": 3},
                "job": {"id": "hello"},
                "ready": error != "409",
                "reference": {"id": "baz"},
                "sample": {"id": "baz", "name": "Baz"},
                "subtractions": ["plum"],
                "user": {"id": user.id},
                "workflow": "pathoscope_bowtie",
                "results": {"hits": []},
            },
        )

    resp = await client.delete("/analyses/foobar")

    match error:
        case None:
            await resp_is.no_content(resp)

        case "403":
            await resp_is.insufficient_rights(resp)

        case ("404_analysis", "404_sample"):
            await resp_is.not_found(resp)

        case "409":
            await resp_is.conflict(resp, "Analysis is still running")


@pytest.mark.parametrize("error", [None, 400, 404, 422])
async def test_upload_file(
    error: str | None,
    create_files,
    mongo: Mongo,
    pg: AsyncEngine,
    resp_is,
    snapshot,
    spawn_job_client: JobClientSpawner,
    static_time,
    tmp_path,
):
    """Test that an analysis result file is properly uploaded and a row is inserted into
    the `analysis_files` SQL table.
    """
    client = await spawn_job_client(authenticated=True)

    get_config_from_app(client.app).data_path = tmp_path

    format_ = "foo" if error == 400 else "fasta"

    if error != 404:
        await mongo.analyses.insert_one(
            {"_id": "foobar", "ready": True, "job": {"id": "hello"}},
        )

    if error == 422:
        resp_put = await client.put(
            "/analyses/foobar/files?format=fasta",
            data=create_files(),
        )
        resp = await client.post(
            "/analyses/foobar/files?format=fasta",
            data=create_files(),
        )
    else:
        resp_put = await client.put(
            f"/analyses/foobar/files?name=reference.fa&format={format_}",
            data=create_files(),
        )
        resp = await client.post(
            f"/analyses/foobar/files?name=reference.fa&format={format_}",
            data=create_files(),
        )

    match error:
        case None:
            assert resp_put.status == 201
            assert await resp_put.json() == snapshot

            assert resp.status == 201
            assert await resp.json() == snapshot

            assert sorted(os.listdir(tmp_path / "analyses")) == [
                "1-reference.fa",
                "2-reference.fa",
            ]
            assert await get_row_by_id(pg, SQLAnalysisFile, 1)

        case 400:
            await resp_is.bad_request(resp_put, "Unsupported analysis file format")
            await resp_is.bad_request(resp, "Unsupported analysis file format")

        case 404:
            assert resp_put.status == 404
            assert resp.status == 404

        case 422:
            await resp_is.invalid_query(resp_put, {"name": ["required field"]})
            await resp_is.invalid_query(resp, {"name": ["required field"]})


class TestDownloadAnalysisResult:
    async def test_ok(
        self,
        create_files,
        mongo: Mongo,
        spawn_client: ClientSpawner,
        spawn_job_client: JobClientSpawner,
        test_files_path,
        tmp_path,
    ):
        """Test that an uploaded analysis result file can subsequently be downloaded."""
        client, job_client = await asyncio.gather(
            spawn_client(administrator=True, authenticated=True),
            spawn_job_client(authenticated=True),
        )

        get_config_from_app(client.app).data_path = tmp_path
        get_config_from_app(job_client.app).data_path = tmp_path

        await mongo.analyses.insert_one(
            {"_id": "foobar", "ready": True, "job": {"id": "hello"}},
        )

        await job_client.put(
            "/analyses/foobar/files?name=reference.fa&format=fasta",
            data=create_files(),
        )

        resp = await client.get("/analyses/foobar/files/1")

        assert resp.status == 200

        assert (
            await resp.read()
            == open(test_files_path / "aodp" / "reference.fa", "rb").read()
        )

    async def test_not_found(
        self,
        mongo: Mongo,
        spawn_client: ClientSpawner,
    ):
        """Test that a 404 response is returned when the requested file does not exist."""
        client = await spawn_client(administrator=True, authenticated=True)

        await mongo.analyses.insert_one(
            {"_id": "foobar", "ready": True, "job": {"id": "hello"}},
        )

        resp = await client.get("/analyses/foobar/files/2")

        assert resp.status == 404
        assert await resp.json() == {"id": "not_found", "message": "Not found"}


@pytest.mark.parametrize(
    "error",
    [
        None,
        "403",
        "404_analysis",
        "404_sample",
        "404_sequence",
        "404_sequence",
        "409_workflow",
        "409_ready",
    ],
)
async def test_blast(
    error,
    mongo: Mongo,
    spawn_client: ClientSpawner,
    resp_is,
    snapshot,
    static_time,
):
    """Test that the handler starts a BLAST for given NuVs sequence. Also check that it handles all error conditions
    correctly.

    """
    client = await spawn_client(
        authenticated=True,
        base_url="https://virtool.example.com",
    )

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
                ],
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
            await mongo.samples.insert_one(
                {
                    "_id": "baz",
                    "all_read": True,
                    "all_write": error != "403",
                    "group": "tech",
                    "group_read": True,
                    "group_write": True,
                    "user": {"id": "fred"},
                },
            )

        await mongo.analyses.insert_one(analysis_document)

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


class TestFinalize:
    async def test_not_found(self, spawn_job_client):
        """Test that a 404 response is returned when the analysis does not exist."""
        client = await spawn_job_client(authenticated=True)

        resp = await client.patch(
            "/analyses/analysis1",
            json={"results": {"result": "TEST_RESULT", "hits": []}},
        )

        assert resp.status == 404


@pytest.mark.parametrize("error", [None, 422, 409])
async def test_finalize(
    error: str | None,
    fake: DataFaker,
    mongo: Mongo,
    pg: AsyncEngine,
    snapshot: SnapshotAssertion,
    spawn_job_client: JobClientSpawner,
    static_time: StaticTime,
):
    user_1 = await fake.users.create()
    user_2 = await fake.users.create()

    job = await fake.jobs.create(user=user_2)

    client = await spawn_job_client(authenticated=True)

    await asyncio.gather(
        mongo.references.insert_one(
            {"_id": "baz", "name": "Baz", "data_type": "genome"},
        ),
        mongo.samples.insert_one(
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
                "subtractions": [],
                "user": {"id": user_1.id},
            },
        ),
    )

    if error != 404:
        await mongo.analyses.insert_one(
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
            },
        )

    if error == 422:
        data = {}
    else:
        data = {"results": {"result": "TEST_RESULT", "hits": []}}

    pprint(data)

    resp = await client.patch("/analyses/analysis1", json=data)

    if error:
        assert resp.status == error
    else:
        assert resp.status == 200
        assert await resp.json() == snapshot

        document = await mongo.analyses.find_one()

        assert document == snapshot
        assert document["ready"] is True

        async with AsyncSession(pg) as session:
            row = await get_row_by_id(pg, SQLAnalysisResult, 1)

            assert row.analysis_id == "analysis1"
            assert row.results == {"result": "TEST_RESULT", "hits": []}
