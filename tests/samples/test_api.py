import os
from pathlib import Path

import arrow
import pytest
from aiohttp.test_utils import make_mocked_coro
from sqlalchemy.ext.asyncio import AsyncSession

import virtool.samples.db
import virtool.uploads.db
from virtool.labels.models import Label
from virtool.samples.models import SampleReadsFile, SampleArtifact
from virtool.uploads.models import Upload


class MockJobInterface:

    def __init__(self):
        self.enqueue_job = make_mocked_coro()


@pytest.mark.parametrize("find,per_page,page,label_filter,d_range,meta", [
    (None, None, None, None, range(0, 3), {
        "page": 1,
        "per_page": 25,
        "page_count": 1,
        "found_count": 3,
        "total_count": 3
    }),
    # Test ``label_filter`` query param.
    (None, None, None, ["Question", "Info"], range(0, 3), {
        "page": 1,
        "per_page": 25,
        "page_count": 1,
        "found_count": 2,
        "total_count": 3
    }),
    # Test ``per_page`` query param.
    (None, 2, 1, None, range(0, 2), {
        "page": 1,
        "per_page": 2,
        "page_count": 2,
        "found_count": 3,
        "total_count": 3
    }),
    # Test ``per_page`` and ``page`` query param.
    (None, 2, 2, None, range(2, 3), {
        "page": 2,
        "per_page": 2,
        "page_count": 2,
        "found_count": 3,
        "total_count": 3
    }),
    # Test ``find`` query param and ``found_count`` response field.
    ("gv", None, None, None, range(1, 3), {
        "page": 1,
        "per_page": 25,
        "page_count": 1,
        "found_count": 2,
        "total_count": 3
    }),
    ("sp", None, None, None, range(0, 1), {
        "page": 1,
        "per_page": 25,
        "page_count": 1,
        "found_count": 1,
        "total_count": 3
    }),
    ("fred", None, None, None, [0, 2], {
        "page": 1,
        "per_page": 25,
        "page_count": 1,
        "found_count": 2,
        "total_count": 3
    })
])
async def test_find(find, per_page, page, label_filter, d_range, meta, snapshot, spawn_client, static_time,
                    pg_session):
    client = await spawn_client(authorize=True)

    time_1 = arrow.get(static_time.datetime).datetime
    time_2 = arrow.get(static_time.datetime).shift(hours=1).datetime
    time_3 = arrow.get(static_time.datetime).shift(hours=2).datetime

    label_1 = Label(id=1, name="Bug", color="#a83432", description="This is a bug")
    label_2 = Label(id=2, name="Info", color="#03fc20", description="This is a info")
    label_3 = Label(id=3, name="Question", color="#0d321d", description="This is a question")

    async with pg_session as session:
        session.add_all([label_1, label_2, label_3])
        await session.commit()

    await client.db.samples.insert_many([
        {
            "user": {
                "id": "bob"
            },
            "nuvs": False,
            "host": "",
            "foobar": True,
            "isolate": "Thing",
            "created_at": time_2,
            "_id": "beb1eb10",
            "name": "16GVP042",
            "pathoscope": False,
            "all_read": True,
            "ready": True,
            "labels": [1, 2]
        },
        {
            "user": {
                "id": "fred"
            },
            "nuvs": False,
            "host": "",
            "foobar": True,
            "isolate": "Test",
            "created_at": time_1,
            "_id": "72bb8b31",
            "name": "16GVP043",
            "pathoscope": False,
            "all_read": True,
            "ready": True,
            "labels": [1]
        },
        {
            "user": {
                "id": "fred"
            },
            "nuvs": False,
            "host": "",
            "foobar": True,
            "ready": True,
            "isolate": "",
            "created_at": time_3,
            "_id": "cb400e6d",
            "name": "16SPP044",
            "pathoscope": False,
            "all_read": True,
            "labels": [3]
        }
    ])

    path = "/api/samples"
    query = list()

    if find is not None:
        query.append("find={}".format(find))

    if per_page is not None:
        query.append("per_page={}".format(per_page))

    if page is not None:
        query.append("page={}".format(page))

    if label_filter is not None:
        filter_query = '&filter='.join(label_filter)
        query.append(("filter={}".format(filter_query)))

    if len(query):
        path += "?{}".format("&".join(query))

    resp = await client.get(path)

    assert resp.status == 200

    snapshot.assert_match(await resp.json())


@pytest.mark.parametrize("error", [None, "404"])
@pytest.mark.parametrize("ready", [True, False])
async def test_get(error, ready, mocker, snapshot, spawn_client, resp_is, static_time, pg_session):
    mocker.patch("virtool.samples.utils.get_sample_rights", return_value=(True, True))

    client = await spawn_client(authorize=True)

    label_1 = Label(id=1, name="Bug", color="#a83432", description="This is a bug")
    async with pg_session as session:
        session.add(label_1)
        await session.commit()

    if not error:
        await client.db.samples.insert_one({
            "_id": "test",
            "name": "Test",
            "created_at": static_time.datetime,
            "ready": ready,
            "files": [
                {
                    "id": "foo",
                    "name": "Bar.fq.gz",
                    "download_url": "/download/samples/files/file_1.fq.gz"
                }
            ],
            "labels": [1]
        })

    resp = await client.get("api/samples/test")

    if error:
        assert await resp_is.not_found(resp)
        return

    assert resp.status == 200

    snapshot.assert_match(await resp.json())


class TestCreate:

    @pytest.mark.parametrize("group_setting", ["none", "users_primary_group", "force_choice"])
    async def test(self, group_setting, snapshot, mocker, spawn_client, pg, static_time, test_random_alphanumeric):

        client = await spawn_client(authorize=True, permissions=["create_sample"])

        client.app["settings"].update({
            "sm_proc": 2,
            "sm_mem": 4,
        })

        await client.db.subtraction.insert_one({
            "_id": "apple",
            "is_host": True
        })

        upload = Upload(id=1, name="test.fq.gz", size=123456)

        async with AsyncSession(pg) as session:
            session.add(upload)

            await session.commit()

        await client.db.groups.insert_many([
            {"_id": "diagnostics"},
            {"_id": "technician"}
        ])

        client.app["settings"].update({
            "sample_group": group_setting,
            "sample_all_read": True,
            "sample_all_write": True,
            "sample_group_read": True,
            "sample_group_write": True,
            "sample_unique_names": True
        })

        m_reserve = mocker.patch("virtool.uploads.db.reserve", make_mocked_coro())

        client.app["jobs"] = mocker.Mock()

        m_enqueue = mocker.patch.object(client.app["jobs"], "enqueue", make_mocked_coro())

        request_data = {
            "name": "Foobar",
            "files": [1],
            "subtraction": "apple",
        }

        if group_setting == "force_choice":
            request_data["group"] = "diagnostics"

        resp = await client.post("/api/samples", request_data)

        assert resp.status == 201

        assert resp.headers["Location"] == "/api/samples/" + test_random_alphanumeric.history[0]

        snapshot.assert_match(await resp.json())

        snapshot.assert_match(await client.db.samples.find_one())

        # Check call to file.reserve.
        m_reserve.assert_called_with(
            client.app["pg"],
            [1]
        )

        m_enqueue.assert_called_with(test_random_alphanumeric.history[1])

    async def test_name_exists(self, spawn_client, static_time, resp_is):
        client = await spawn_client(authorize=True, permissions=["create_sample"])

        client.app["settings"]["sample_unique_names"] = True

        await client.db.samples.insert_one({
            "_id": "foobar",
            "name": "Foobar",
            "lower_name": "foobar",
            "created_at": static_time.datetime,
            "nuvs": False,
            "pathoscope": False
        })

        resp = await client.post("/api/samples", {
            "name": "Foobar",
            "files": [1],
            "subtraction": "apple"
        })

        assert await resp_is.bad_request(resp, "Sample name is already in use")

    async def test_force_choice(self, spawn_client, pg, resp_is):
        """
        Test that when ``force_choice`` is enabled, a request with no group field passed results in an error.
        response.

        """
        client = await spawn_client(authorize=True, permissions=["create_sample"])

        client.app["settings"]["sample_group"] = "force_choice"
        client.app["settings"]["sample_unique_names"] = True

        await client.db.subtraction.insert_one({
            "_id": "apple",
            "is_host": True
        })

        upload = Upload(id=1, name="test.fq.gz", size=123456)

        async with AsyncSession(pg) as session:
            session.add(upload)

            await session.commit()

        resp = await client.post("/api/samples", {
            "name": "Foobar",
            "files": [1],
            "subtraction": "apple"
        })

        assert await resp_is.bad_request(resp, "Group value required for sample creation")

    async def test_group_dne(self, spawn_client, pg, resp_is):
        client = await spawn_client(authorize=True, permissions=["create_sample"])

        client.app["settings"]["sample_group"] = "force_choice"
        client.app["settings"]["sample_unique_names"] = True

        await client.db.subtraction.insert_one({
            "_id": "apple",
            "is_host": True
        })

        upload = Upload(id=1, name="test.fq.gz", size=123456)

        async with AsyncSession(pg) as session:
            session.add(upload)

            await session.commit()

        resp = await client.post("/api/samples", {
            "name": "Foobar",
            "files": [1],
            "subtraction": "apple",
            "group": "foobar"
        })

        assert await resp_is.bad_request(resp, "Group does not exist")

    @pytest.mark.parametrize("in_db", [True, False])
    async def test_subtraction_dne(self, in_db, spawn_client, resp_is):
        client = await spawn_client(authorize=True, permissions=["create_sample"])

        client.app["settings"]["sample_unique_names"] = True

        resp = await client.post("/api/samples", {
            "name": "Foobar",
            "files": [1],
            "subtraction": "apple"
        })

        if in_db:
            await client.db.subtraction.insert_one({
                "_id": "apple",
                "is_host": False
            })

        assert await resp_is.bad_request(resp, "Subtraction does not exist")

    @pytest.mark.parametrize("one_exists", [True, False])
    async def test_file_dne(self, one_exists, spawn_client, pg, resp_is):
        """
        Test that a ``404`` is returned if one or more of the file ids passed in ``files`` does not exist.

        """
        client = await spawn_client(authorize=True, permissions=["create_sample"])

        client.app["settings"]["sample_unique_names"] = True

        await client.db.subtraction.insert_one({
            "_id": "apple",
            "is_host": True
        })

        if one_exists:
            upload = Upload(id=1, name="test.fq.gz", size=123456)

            async with AsyncSession(pg) as session:
                session.add(upload)

                await session.commit()

        resp = await client.post("/api/samples", {
            "name": "Foobar",
            "files": [1, 2],
            "subtraction": "apple"
        })

        assert await resp_is.bad_request(resp, "File does not exist")

    @pytest.mark.parametrize("exists", [True, False])
    async def test_label_dne(self, exists, spawn_client, pg_session, resp_is):
        client = await spawn_client(authorize=True, permissions=["create_sample"])

        client.app["settings"]["sample_unique_names"] = True

        if exists:
            label = Label(id=1, name="Orange", color="#FFA500", description="An orange")
            async with pg_session as session:
                session.add(label)
                await session.commit()

        resp = await client.post("/api/samples", {
            "name": "Foobar",
            "files": [1],
            "subtraction": "apple",
            "labels": [1]
        })

        assert resp.status == 400

        if not exists:
            assert await resp_is.bad_request(resp, "Labels do not exist: 1")


@pytest.mark.parametrize("field", ["quality", "not_quality"])
async def test_finalize(field, snapshot, spawn_job_client, resp_is):
    """
    Test that sample can be finalized using the Jobs API.

    """
    client = await spawn_job_client(authorize=True)

    data = {field: {}}

    await client.db.samples.insert_one({
        "_id": "test",
    })

    resp = await client.patch("/api/samples/test", json=data)

    if field == "quality":
        assert resp.status == 200
        snapshot.assert_match(await resp.json())
    else:
        assert resp.status == 422
        assert await resp_is.invalid_input(resp, {"quality": ['required field']})


@pytest.mark.parametrize("delete_result,resp_is_attr", [(1, "no_content"), (0, "not_found")])
async def test_remove(delete_result, resp_is_attr, mocker, spawn_client, resp_is, create_delete_result):
    client = await spawn_client(authorize=True)

    mocker.patch("virtool.samples.utils.get_sample_rights", return_value=(True, True))

    if resp_is_attr == "no_content":
        await client.db.samples.insert_one({
            "_id": "test",
            "all_read": True,
            "all_write": True
        })

    m = mocker.stub(name="remove_samples")

    async def mock_remove_samples(*args, **kwargs):
        m(*args, **kwargs)
        return create_delete_result(delete_result)

    mocker.patch("virtool.samples.db.remove_samples", new=mock_remove_samples)

    resp = await client.delete("/api/samples/test")

    assert await getattr(resp_is, resp_is_attr)(resp)

    if resp_is_attr == "no_content":
        m.assert_called_with(client.db, client.app["settings"], ["test"])
    else:
        assert not m.called


@pytest.mark.parametrize("ready", [True, False])
@pytest.mark.parametrize("exists", [True, False])
async def test_job_remove(exists, ready, mocker, resp_is, static_time, spawn_job_client, pg, tmpdir):
    """
    Test that a sample can be removed when called using the Jobs API.

    """
    client = await spawn_job_client(authorize=True)
    client.app["settings"]["data_path"] = str(tmpdir)

    mocker.patch("virtool.samples.utils.get_sample_rights", return_value=(True, True))

    if exists:
        file = await virtool.uploads.db.create(pg, "test", "reads", reserved=True)

        await client.db.samples.insert_one({
            "_id": "test",
            "all_read": True,
            "all_write": True,
            "files": [file["id"]],
            "ready": ready
        })

    mocker.patch("virtool.utils.rm", return_value=True)

    resp = await client.delete("/api/samples/test")

    if exists and not ready:
        assert resp.status == 204
        assert not await virtool.samples.db.check_name(client.app["db"], client.app["settings"], "test", "test")

        upload = await virtool.uploads.db.get(pg, file["id"])
        assert not upload.reserved
    elif exists:
        assert resp.status == 400
    else:
        assert resp.status == 404


@pytest.mark.parametrize("error", [None, "404"])
@pytest.mark.parametrize("term", [None, "bob", "Baz"])
async def test_find_analyses(error, term, snapshot, mocker, spawn_client, resp_is, static_time):
    mocker.patch("virtool.samples.utils.get_sample_rights", return_value=(True, True))

    client = await spawn_client(authorize=True)

    if not error:
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

    url = "/api/samples/test/analyses"

    if term:
        url += "?term={}".format(term)

    resp = await client.get(url)

    if error:
        assert await resp_is.not_found(resp)
        return

    assert resp.status == 200

    snapshot.assert_match(await resp.json())


@pytest.mark.parametrize("error", [None, "400_reference", "400_index", "400_ready_index", "404"])
async def test_analyze(error, mocker, spawn_client, static_time, resp_is):
    mocker.patch("virtool.samples.utils.get_sample_rights", return_value=(True, True))

    client = await spawn_client(authorize=True)

    client.app["jobs"] = MockJobInterface()

    test_analysis = {
        "_id": "test_analysis",
        "ready": False,
        "created_at": static_time.iso,
        "job": {
            "id": "baz"
        },
        "workflow": "pathoscope_bowtie",
        "reference": {
            "id": "foo"
        },
        "sample": {
            "id": "test"
        },
        "index": {
            "id": "foobar",
            "version": 3
        },
        "user": {
            "id": "test",
        }
    }

    if error != "400_reference":
        await client.db.references.insert_one({
            "_id": "foo"
        })

    if error != "400_index":
        await client.db.indexes.insert_one({
            "_id": "test",
            "reference": {
                "id": "foo"
            },
            "ready": error != "400_ready_index"
        })

    if error != "404":
        await client.db.samples.insert_one({
            "_id": "test",
            "created_at": static_time.datetime,
            "all_read": True,
            "all_write": True
        })

    m_new = mocker.patch("virtool.analyses.db.create", new=make_mocked_coro(test_analysis))

    resp = await client.post("/api/samples/test/analyses", data={
        "workflow": "pathoscope_bowtie",
        "ref_id": "foo",
        "subtraction_id": "bar"
    })

    if error == "400_reference":
        assert await resp_is.bad_request(resp, "Reference does not exist")
        return

    if error == "400_index" or error == "400_ready_index":
        assert await resp_is.bad_request(resp, "No ready index")
        return

    if error == "404":
        assert await resp_is.not_found(resp)
        return

    assert resp.status == 201

    assert resp.headers["Location"] == "/api/analyses/test_analysis"

    test_analysis["id"] = test_analysis.pop("_id")

    assert await resp.json() == test_analysis

    m_new.assert_called_with(
        client.app,
        "test",
        "foo",
        "bar",
        "test",
        "pathoscope_bowtie"
    )


@pytest.mark.parametrize("ready", [True, False])
@pytest.mark.parametrize("exists", [True, False])
async def test_cache_job_remove(exists, ready, tmpdir, spawn_job_client, snapshot, resp_is):
    client = await spawn_job_client(authorize=True)

    client.app["settings"]["data_path"] = str(tmpdir)

    tmpdir.mkdir("caches").mkdir("foo").join("reads_1.fq.gz").write("Cache file")

    if exists:
        await client.db.caches.insert_one({
            "_id": "foo",
            "key": "abc123",
            "sample": {
                "id": "bar"
            },
            "ready": ready
        })

    resp = await client.delete("/api/samples/bar/caches/abc123")

    if not exists:
        assert resp.status == 404
        return

    if ready:
        assert await resp_is.conflict(resp, "Jobs cannot delete finalized caches")
        return

    assert await resp_is.no_content(resp)
    assert await client.db.caches.find_one("foo") is None
    assert not os.path.isdir(tmpdir / "caches" / "foo")

    
@pytest.mark.parametrize("artifact_type", ["fastq", "foo"])
async def test_upload_artifacts(artifact_type, snapshot, spawn_job_client, static_time, resp_is, tmpdir):
    """
    Test that new artifacts can be uploaded after sample creation using the Jobs API.

    """
    path = Path.cwd() / "tests" / "test_files" / "nuvs" / "reads_1.fq"

    data = {
        "file": open(path, "rb")
    }

    client = await spawn_job_client(authorize=True)

    client.app["settings"]["data_path"] = str(tmpdir)
    sample_file_path = Path(client.app["settings"]["data_path"]) / "samples" / "test"

    await client.db.samples.insert_one({
        "_id": "test",
    })

    resp = await client.post(f"/api/samples/test/artifacts?name=small.fq&type={artifact_type}", data=data)

    if artifact_type == "fastq":
        assert resp.status == 201
        assert os.listdir(sample_file_path) == ["1-small.fq"]
        snapshot.assert_match(await resp.json())
    else:
        assert await resp_is.bad_request(resp, "Unsupported sample artifact type")


@pytest.mark.parametrize("paired, conflict", [(True, False), (True, True), (False, False)])
@pytest.mark.parametrize("compressed", [True, False])
async def test_upload_reads(paired, conflict, compressed, snapshot, spawn_job_client, static_time, resp_is, tmpdir):
    """
    Test that new sample reads can be uploaded using the Jobs API.

    """
    path = Path.cwd() / "tests" / "test_files" / "samples"

    data = {
        "file": open(path / ("reads_1.fq.gz" if compressed else "fake_reads_1.fq.gz"), "rb")
    }

    client = await spawn_job_client(authorize=True)

    client.app["settings"]["data_path"] = str(tmpdir)
    sample_file_path = Path(client.app["settings"]["data_path"]) / "samples" / "test"

    await client.db.samples.insert_one({
        "_id": "test",
    })

    resp = await client.post("/api/samples/test/reads", data=data)

    if compressed and paired:
        data["file"] = open(path / "reads_2.fq.gz", "rb")
        resp_2 = await client.post("/api/samples/test/reads", data=data)

        if conflict:
            data["file"] = open(path / "reads_2.fq.gz", "rb")
            resp_3 = await client.post("/api/samples/test/reads", data=data)

            assert await resp_is.conflict(resp_3, "Sample is already associated with two reads files")
            return

    if compressed:
        assert resp.status == 201

        snapshot.assert_match(await resp.json())

        if paired:
            assert resp_2.status == 201
            assert set(os.listdir(sample_file_path)) == {"reads_1.fq.gz", "reads_2.fq.gz"}
        else:
            assert os.listdir(sample_file_path) == ["reads_1.fq.gz"]
    else:
        assert await resp_is.bad_request(resp, "File is not compressed")


@pytest.mark.parametrize("suffix", ["1", "2"])
@pytest.mark.parametrize("error", [None, "404_sample", "404_reads", "404_file"])
async def test_download_reads(suffix, error, tmpdir, spawn_job_client, pg):
    client = await spawn_job_client(authorize=True)

    client.app["settings"]["data_path"] = str(tmpdir)

    file_name = f"reads_{suffix}.fq.gz"

    if error != "404_file":
        tmpdir.mkdir("samples").mkdir("foo").join(file_name).write("test")

    if error != "404_sample":
        await client.db.samples.insert_one({
            "_id": "foo",
        })

    sample_reads = SampleReadsFile(id=1, sample="foo", name=file_name, name_on_disk=file_name)

    if error != "404_reads":
        async with AsyncSession(pg) as session:
            session.add(sample_reads)

            await session.commit()


    resp = await client.get(f"/api/samples/foo/reads/{suffix}")

    expected_path = Path(client.app["settings"]["data_path"]) / "samples" / "foo" / file_name

    if error:
        assert resp.status == 404
        return

    assert resp.status == 200
    assert expected_path.read_bytes() == await resp.content.read()


@pytest.mark.parametrize("error", [None, "404_sample", "404_artifact", "404_file"])
async def test_download_artifact(error, tmpdir, spawn_job_client, pg):
    client = await spawn_job_client(authorize=True)

    client.app["settings"]["data_path"] = str(tmpdir)

    if error != "404_file":
        tmpdir.mkdir("samples").mkdir("foo").join("1-fastqc.txt").write("test")

    if error != "404_sample":
        await client.db.samples.insert_one({
            "_id": "foo",
        })

    if error != "404_artifact":
        sample_artfact = SampleArtifact(id=1, sample="foo", name="fastqc.txt", name_on_disk="1-fastqc.txt", type="fastq")

        async with AsyncSession(pg) as session:
            session.add(sample_artfact)

            await session.commit()

    resp = await client.get("/api/samples/foo/artifacts/fastqc.txt")

    expected_path = Path(client.app["settings"]["data_path"]) / "samples" / "foo" / "1-fastqc.txt"

    if error:
        assert resp.status == 404
        return

    assert resp.status == 200
    assert expected_path.read_bytes() == await resp.content.read()