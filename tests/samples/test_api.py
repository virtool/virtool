import os
from pathlib import Path

import arrow
import pytest
from aiohttp.test_utils import make_mocked_coro
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.caches.db
import virtool.caches.utils
import virtool.pg.utils
import virtool.samples.db
import virtool.uploads.db
from virtool.caches.models import SampleArtifactCache, SampleReadsCache
from virtool.labels.models import Label
from virtool.samples.files import create_reads_file
from virtool.samples.models import SampleReads, SampleArtifact
from virtool.uploads.models import Upload


class MockJobInterface:

    def __init__(self):
        self.enqueue = make_mocked_coro()


@pytest.mark.parametrize("find,per_page,page,labels", [
    (None, None, None, None),
    (None, 2, 1, None),
    (None, 2, 2, None),
    ("gv", None, None, None),
    ("sp", None, None, None),
    ("fred", None, None, None),
    (None, None, None, [3]),
    (None, None, None, [2, 3]),
    (None, None, None, [0]),
    (None, None, None, [3, "info"]),
])
async def test_find(
        find,
        per_page,
        page,
        labels,
        snapshot,
        spawn_client,
        static_time,
        pg_session
):
    client = await spawn_client(authorize=True)

    async with pg_session as session:
        session.add_all([
            Label(id=1, name="Bug", color="#a83432", description="This is a bug"),
            Label(id=2, name="Info", color="#03fc20", description="This is a info"),
            Label(id=3, name="Question", color="#0d321d", description="This is a question")
        ])
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
            "created_at": arrow.get(static_time.datetime).shift(hours=1).datetime,
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
            "created_at": arrow.get(static_time.datetime).datetime,
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
            "created_at": arrow.get(static_time.datetime).shift(hours=2).datetime,
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
        query.append(f"find={find}")

    if per_page is not None:
        query.append(f"per_page={per_page}")

    if page is not None:
        query.append(f"page={page}")

    if labels is not None:
        label_query = "&label=".join(str(label) for label in labels)
        query.append(f"label={label_query}")

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

    if not error:
        await client.db.subtraction.insert_many([
            {
                "_id": "foo",
                "name": "Foo"
            },
            {
                "_id": "bar",
                "name": "Bar"
            }
        ])

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
            "labels": [1],
            "subtractions": ["foo", "bar"]
        })

        label = Label(id=1, name="Bug", color="#a83432", description="This is a bug")

        artifact = SampleArtifact(
            name="reference.fa.gz",
            sample="test",
            type="fasta",
            name_on_disk="reference.fa.gz"
        )

        reads = SampleReads(name="reads_1.fq.gz", name_on_disk="reads_1.fq.gz", sample="test")

        upload = Upload(name="test")
        upload.reads.append(reads)

        async with pg_session as session:
            session.add_all([label, artifact, reads, upload])
            await session.commit()

    resp = await client.get("api/samples/test")

    if error:
        assert await resp_is.not_found(resp)
        return

    assert resp.status == 200

    snapshot.assert_match(await resp.json())


class TestCreate:

    @pytest.mark.parametrize("group_setting", ["none", "users_primary_group", "force_choice"])
    async def test(
            self,
            group_setting,
            snapshot,
            mocker,
            spawn_client,
            pg: AsyncEngine,
            static_time,
            test_random_alphanumeric
    ):
        client = await spawn_client(authorize=True, permissions=["create_sample"])

        client.app["settings"].update({
            "sm_proc": 2,
            "sm_mem": 4,
        })

        await client.db.subtraction.insert_one({
            "_id": "apple"
        })

        upload = Upload(id=1, name="test.fq.gz", size=123456)
        label = Label(id=1, name="bug", color="#FF0000")

        async with AsyncSession(pg) as session:
            session.add_all([upload, label])
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
            "labels": [1],
            "subtractions": ["apple"],
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
            "subtractions": ["apple"]
        })

        assert await resp_is.bad_request(resp, "Sample name is already in use")

    @pytest.mark.parametrize("group", ["", "diagnostics", None])
    async def test_force_choice(self, spawn_client, pg: AsyncEngine, resp_is, group):
        """
        Test that when ``force_choice`` is enabled, a request with no group field passed results in
        an error response, that "" is accepted as a valid user group and that valid user groups are accepted as expected

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

        request_data = {
            "name": "Foobar",
            "files": [1],
            "subtractions": ["apple"]
        }
        await client.db.groups.insert_one(
            {"_id": "diagnostics"},
        )

        if group is None:
            resp = await client.post("/api/samples", request_data)
            assert await resp_is.bad_request(resp, "Group value required for sample creation")
        else:
            request_data["group"] = group
            resp = await client.post("/api/samples", request_data)
            assert resp.status == 201

    async def test_group_dne(self, spawn_client, pg: AsyncEngine, resp_is):
        client = await spawn_client(authorize=True, permissions=["create_sample"])

        client.app["settings"]["sample_group"] = "force_choice"
        client.app["settings"]["sample_unique_names"] = True

        await client.db.subtraction.insert_one({
            "_id": "apple"
        })

        upload = Upload(id=1, name="test.fq.gz", size=123456)

        async with AsyncSession(pg) as session:
            session.add(upload)
            await session.commit()

        resp = await client.post("/api/samples", {
            "name": "Foobar",
            "files": [1],
            "subtractions": ["apple"],
            "group": "foobar"
        })

        assert await resp_is.bad_request(resp, "Group does not exist")

    async def test_subtraction_dne(self, pg: AsyncEngine, spawn_client, resp_is):
        client = await spawn_client(authorize=True, permissions=["create_sample"])

        upload = Upload(id=1, name="test.fq.gz", size=123456)

        async with AsyncSession(pg) as session:
            session.add(upload)
            await session.commit()

        resp = await client.post("/api/samples", {
            "name": "Foobar",
            "files": [1],
            "subtractions": ["apple"]
        })

        assert await resp_is.bad_request(resp, "Subtractions do not exist: apple")

    @pytest.mark.parametrize("one_exists", [True, False])
    async def test_file_dne(self, one_exists, spawn_client, pg: AsyncEngine, resp_is):
        """
        Test that a ``404`` is returned if one or more of the file ids passed in ``files`` does not
        exist.

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
            "subtractions": ["apple"]
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
            "labels": [1]
        })

        assert resp.status == 400

        if not exists:
            assert await resp_is.bad_request(resp, "Labels do not exist: 1")


class TestEdit:
    async def test(self, snapshot, spawn_client, pg: AsyncEngine, pg_session):
        """
        Test that an existing sample can be edited correctly.

        """
        client = await spawn_client(authorize=True, administrator=True)

        await client.db.samples.insert_one({
            "_id": "test",
            "name": "Test",
            "all_read": True,
            "all_write": True,
            "labels": [2, 3],
            "subtractions": ["apple"]
        })

        await client.db.subtraction.insert_one({
            "_id": "foo",
            "name": "Foo"
        })

        label = Label(id=1, name="Bug", color="#a83432", description="This is a bug")
        async with pg_session as session:
            session.add(label)
            await session.commit()

        data = {
            "name": "test_sample",
            "subtractions": ["foo"],
            "labels": [1],
            "notes": "This is a test."
        }

        resp = await client.patch("/api/samples/test", data)

        assert resp.status == 200
        snapshot.assert_match(await resp.json())

    @pytest.mark.parametrize("exists", [True, False])
    async def test_name_exists(self, exists, snapshot, spawn_client, resp_is):
        """
        Test that a ``bad_request`` is returned if the sample name passed in ``name`` already exists.

        """
        client = await spawn_client(authorize=True, administrator=True)

        samples = [
            {
                "_id": "foo",
                "name": "Foo",
                "all_read": True,
                "all_write": True,
            }
        ]

        if exists:
            samples.append(
                {
                    "_id": "bar",
                    "name": "Bar"
                }
            )

        await client.db.samples.insert_many(samples)

        data = {
            "name": "Bar"
        }

        resp = await client.patch("/api/samples/foo", data)

        if exists:
            assert await resp_is.bad_request(resp, "Sample name is already in use")
            return

        assert resp.status == 200
        snapshot.assert_match(await resp.json())

    @pytest.mark.parametrize("exists", [True, False])
    async def test_label_exists(self, exists, snapshot, spawn_client, resp_is, pg_session):
        """
        Test that a ``bad_request`` is returned if the label passed in ``labels`` does not exist.

        """
        client = await spawn_client(authorize=True, administrator=True)

        await client.db.samples.insert_one(
            {
                "_id": "foo",
                "name": "Foo",
                "all_read": True,
                "all_write": True,
                "labels": [2, 3]
            }
        )
        if exists:
            label = Label(id=1, name="Bug", color="#a83432", description="This is a bug")
            async with pg_session as session:
                session.add(label)
                await session.commit()

        data = {
            "labels": [1]
        }

        resp = await client.patch("/api/samples/foo", data)

        if not exists:
            assert await resp_is.bad_request(resp, "Labels do not exist: 1")
            return

        assert resp.status == 200
        snapshot.assert_match(await resp.json())

    @pytest.mark.parametrize("exists", [True, False])
    async def test_subtraction_exists(self, exists, snapshot, spawn_client, resp_is):
        """
        Test that a ``bad_request`` is returned if the subtraction passed in ``subtractions`` does not exist.

        """
        client = await spawn_client(authorize=True, administrator=True)

        await client.db.samples.insert_one({
            "_id": "test",
            "name": "Test",
            "all_read": True,
            "all_write": True,
            "subtractions": ["apple"]
        })

        subtractions = [
            {
                "_id": "foo",
                "name": "Foo"
            }
        ]

        if exists:
            subtractions.append(
                {
                    "_id": "bar",
                    "name": "Bar"
                }
            )

        await client.db.subtraction.insert_many(subtractions)

        data = {
            "subtractions": ["foo", "bar"]
        }

        resp = await client.patch("/api/samples/test", data)

        if not exists:
            assert await resp_is.bad_request(resp, "Subtractions do not exist: bar")
            return

        assert resp.status == 200
        snapshot.assert_match(await resp.json())


@pytest.mark.parametrize("field", ["quality", "not_quality"])
async def test_finalize(field, snapshot, spawn_job_client, resp_is, pg, pg_session, tmp_path):
    """
    Test that sample can be finalized using the Jobs API.

    """
    client = await spawn_job_client(authorize=True)

    client.app["settings"]["data_path"] = tmp_path

    data = {field: {}}

    await client.db.samples.insert_one({
        "_id": "test",
    })

    async with pg_session as session:
        upload = Upload(name="test", name_on_disk="test.fq.gz")
        artifact = SampleArtifact(name="reference.fa.gz", sample="test", type="fasta",
                                  name_on_disk="reference.fa.gz")
        reads = SampleReads(name="reads_1.fq.gz", name_on_disk="reads_1.fq.gz", sample="test")

        upload.reads.append(reads)
        session.add_all([upload, artifact, reads])

        await session.commit()

    resp = await client.patch("/api/samples/test", json=data)

    if field == "quality":
        assert resp.status == 200
        snapshot.assert_match(await resp.json())
        assert not await virtool.uploads.db.get(pg, 1)
        assert not (await virtool.pg.utils.get_row_by_id(pg, SampleReads, 1)).upload
    else:
        assert resp.status == 422
        assert await resp_is.invalid_input(resp, {"quality": ['required field']})


@pytest.mark.parametrize("delete_result,resp_is_attr", [(1, "no_content"), (0, "not_found")])
async def test_remove(
        delete_result,
        resp_is_attr,
        mocker,
        spawn_client,
        resp_is,
        create_delete_result
):
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
async def test_job_remove(
        exists,
        ready,
        mocker,
        resp_is,
        static_time,
        spawn_job_client,
        pg,
        tmp_path
):
    """
    Test that a sample can be removed when called using the Jobs API.

    """
    client = await spawn_job_client(authorize=True)
    client.app["settings"]["data_path"] = tmp_path

    mocker.patch("virtool.samples.utils.get_sample_rights", return_value=(True, True))

    if exists:
        file = await virtool.uploads.db.create(pg, "test", "reads", reserved=True)
        await create_reads_file(pg, 0, "test", "test", "test", upload_id=1)

        await client.db.samples.insert_one({
            "_id": "test",
            "all_read": True,
            "all_write": True,
            "ready": ready
        })

    mocker.patch("virtool.utils.rm", return_value=True)

    resp = await client.delete("/api/samples/test")

    if exists and not ready:
        assert resp.status == 204
        assert not await virtool.samples.db.check_name(
            client.app["db"],
            client.app["settings"],
            "test",
            "test"
        )

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


@pytest.mark.parametrize("error", [
    None,
    "400_reference",
    "400_index",
    "400_ready_index",
    "400_subtraction",
    "404"
])
async def test_analyze(error, mocker, spawn_client, static_time, resp_is,
                       test_random_alphanumeric):
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

    if error != "400_subtraction":
        await client.db.subtraction.insert_one({
            "_id": "bar"
        })

    if error != "404":
        await client.db.samples.insert_one({
            "_id": "test",
            "name": "Test",
            "created_at": static_time.datetime,
            "all_read": True,
            "all_write": True
        })

    m_create = mocker.patch("virtool.analyses.db.create", new=make_mocked_coro(test_analysis))

    resp = await client.post("/api/samples/test/analyses", data={
        "workflow": "pathoscope_bowtie",
        "ref_id": "foo",
        "subtractions": ["bar"]
    })

    if error == "400_reference":
        assert await resp_is.bad_request(resp, "Reference does not exist")
        return

    if error == "400_index" or error == "400_ready_index":
        assert await resp_is.bad_request(resp, "No ready index")
        return

    if error == "400_subtraction":
        assert await resp_is.bad_request(resp, "Subtractions do not exist: bar")
        return

    if error == "404":
        assert await resp_is.not_found(resp)
        return

    assert resp.status == 201

    assert resp.headers["Location"] == "/api/analyses/test_analysis"

    test_analysis["id"] = test_analysis.pop("_id")

    assert await resp.json() == test_analysis

    m_create.assert_called_with(
        client.db,
        "test",
        "foo",
        ["bar"],
        "test",
        "pathoscope_bowtie",
        test_random_alphanumeric.history[0]
    )


@pytest.mark.parametrize("ready", [True, False])
@pytest.mark.parametrize("exists", [True, False])
async def test_cache_job_remove(exists, ready, tmp_path, spawn_job_client, snapshot, resp_is):
    client = await spawn_job_client(authorize=True)

    client.app["settings"]["data_path"] = tmp_path

    path = tmp_path / "caches" / "foo"
    path.mkdir(parents=True)
    path.joinpath("reads_1.fq.gz").write_text("Cache file")

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
    assert not (tmp_path / "caches" / "foo").is_dir()


@pytest.mark.parametrize("error", [None, 400, 409])
async def test_upload_artifact(
        error,
        snapshot,
        spawn_job_client,
        static_time,
        resp_is,
        tmp_path
):
    """
    Test that new artifacts can be uploaded after sample creation using the Jobs API.

    """
    path = Path.cwd() / "tests" / "test_files" / "nuvs" / "reads_1.fq"
    artifact_type = "fastq" if error != 400 else "foo"

    data = {
        "file": open(path, "rb")
    }

    client = await spawn_job_client(authorize=True)

    client.app["settings"]["data_path"] = tmp_path
    sample_file_path = client.app["settings"]["data_path"] / "samples" / "test"

    await client.db.samples.insert_one({
        "_id": "test",
    })

    resp = await client.post(f"/api/samples/test/artifacts?name=small.fq&type={artifact_type}",
                             data=data)

    if error == 409:
        data["file"] = open(path, "rb")
        resp_2 = await client.post(
            f"/api/samples/test/artifacts?name=small.fq&type={artifact_type}", data=data)

        assert await resp_is.conflict(resp_2,
                                      "Artifact file has already been uploaded for this sample")

    if not error:
        assert resp.status == 201
        snapshot.assert_match(await resp.json())
        assert os.listdir(sample_file_path) == ["small.fq"]
    elif error == 400:
        assert await resp_is.bad_request(resp, "Unsupported sample artifact type")


class TestUploadReads:
    @pytest.mark.parametrize("compressed", [True, False])
    async def test_upload_reads(self, compressed, mocker, snapshot, spawn_job_client, static_time,
                                resp_is, pg,
                                tmp_path):
        """
        Test that new sample reads can be uploaded using the Jobs API.

        """
        path = Path.cwd() / "tests" / "test_files" / "samples"

        data = {
            "file": open(path / "reads_1.fq.gz", "rb")
        }

        client = await spawn_job_client(authorize=True)

        client.app["settings"]["data_path"] = tmp_path

        await client.db.samples.insert_one({
            "_id": "test",
        })

        await virtool.uploads.db.create(pg, "test", "reads")

        if not compressed:
            mocker.patch("virtool.uploads.utils.naive_writer",
                         side_effect=OSError("Not a gzipped file"))

        resp = await client.put("/api/samples/test/reads/reads_1.fq.gz?upload=1", data=data)

        if compressed:
            assert resp.status == 201
            snapshot.assert_match(await resp.json())
        else:
            assert await resp_is.bad_request(resp, "File is not compressed")

    @pytest.mark.parametrize("conflict", [True, False])
    async def test_upload_paired_reads(self, conflict, resp_is, spawn_job_client, tmp_path):
        """
        Test that paired sample reads can be uploaded using the Jobs API and that conflicts are properly handled.

        """
        path = Path.cwd() / "tests" / "test_files" / "samples"

        data = {
            "file": open(path / "reads_1.fq.gz", "rb")
        }

        client = await spawn_job_client(authorize=True)

        client.app["settings"]["data_path"] = tmp_path
        sample_file_path = client.app["settings"]["data_path"] / "samples" / "test"

        await client.db.samples.insert_one({
            "_id": "test",
        })

        resp = await client.put("/api/samples/test/reads/reads_1.fq.gz", data=data)

        data["file"] = open(path / "reads_2.fq.gz", "rb")
        resp_2 = await client.put("/api/samples/test/reads/reads_2.fq.gz", data=data)

        if conflict:
            data["file"] = open(path / "reads_2.fq.gz", "rb")
            resp_3 = await client.put("/api/samples/test/reads/reads_2.fq.gz", data=data)

            assert await resp_is.conflict(resp_3,
                                          "Reads file name is already uploaded for this sample")

        assert resp.status == 201
        assert resp_2.status == 201
        assert set(os.listdir(sample_file_path)) == {"reads_1.fq.gz", "reads_2.fq.gz"}


@pytest.mark.parametrize("error", [None, "404"])
async def test_get_cache(error, snapshot, spawn_job_client, resp_is, static_time):
    client = await spawn_job_client(authorize=True)

    cache = {
        "_id": "bar",
        "program": "skewer-0.2.2",
        "key": "abc123",
        "sample": {
            "id": "foo"
        }
    }

    if error == "404":
        cache["key"] = "test"

    await client.db.caches.insert_one(cache)

    resp = await client.get("api/samples/foo/caches/abc123")

    if error == "404":
        assert await resp_is.not_found(resp)
        return

    assert resp.status == 200

    snapshot.assert_match(await resp.json())


@pytest.mark.parametrize("suffix", ["1", "2"])
@pytest.mark.parametrize("error", [None, "404_sample", "404_reads", "404_file"])
async def test_download_reads(suffix, error, tmp_path, spawn_client, spawn_job_client, pg):
    client = await spawn_client(authorize=True)
    job_client = await spawn_job_client(authorize=True)

    client.app["settings"]["data_path"] = tmp_path
    job_client.app["settings"]["data_path"] = tmp_path

    file_name = f"reads_{suffix}.fq.gz"

    if error != "404_file":
        path = tmp_path / "samples" / "foo"
        path.mkdir(parents=True)
        path.joinpath(file_name).write_text("test")

    if error != "404_sample":
        await client.db.samples.insert_one({
            "_id": "foo",
        })

    sample_reads = SampleReads(id=1, sample="foo", name=file_name, name_on_disk=file_name)

    if error != "404_reads":
        async with AsyncSession(pg) as session:
            session.add(sample_reads)

            await session.commit()

    resp = await client.get(f"/api/samples/foo/reads/{file_name}")
    job_resp = await job_client.get(f"/api/samples/foo/reads/{file_name}")

    expected_path = client.app["settings"]["data_path"] / "samples" / "foo" / file_name

    if error:
        assert resp.status == job_resp.status == 404
        return

    assert resp.status == job_resp.status == 200
    assert expected_path.read_bytes() == await resp.content.read() == await job_resp.content.read()


@pytest.mark.parametrize("error", [None, "404_sample", "404_artifact", "404_file"])
async def test_download_artifact(error, tmp_path, spawn_job_client, pg):
    client = await spawn_job_client(authorize=True)

    client.app["settings"]["data_path"] = tmp_path

    if error != "404_file":
        path = (tmp_path / "samples" / "foo")
        path.mkdir(parents=True)
        path.joinpath("fastqc.txt").write_text("test")

    if error != "404_sample":
        await client.db.samples.insert_one({
            "_id": "foo",
        })

    if error != "404_artifact":
        sample_artfact = SampleArtifact(
            id=1,
            sample="foo",
            name="fastqc.txt",
            name_on_disk="fastqc.txt",
            type="fastq"
        )

        async with AsyncSession(pg) as session:
            session.add(sample_artfact)

            await session.commit()

    resp = await client.get("/api/samples/foo/artifacts/fastqc.txt")

    expected_path = client.app["settings"]["data_path"] / "samples" / "foo" / "fastqc.txt"

    if error:
        assert resp.status == 404
        return

    assert resp.status == 200
    assert expected_path.read_bytes() == await resp.content.read()


class TestCreateCache:

    @pytest.mark.parametrize("key", ["key", "not_key"])
    async def test(self, key, dbi, mocker, resp_is, snapshot, static_time, spawn_job_client):
        """
        Test that a new cache document can be created in the `caches` db using the Jobs API.

        """
        client = await spawn_job_client(authorize=True)

        await client.db.samples.insert_one({
            "_id": "test",
            "paired": False,
        })

        data = {key: "aodp-abcdefgh"}

        mocker.patch("virtool.utils.random_alphanumeric", return_value="a1b2c3d4")

        resp = await client.post("/api/samples/test/caches", json=data)

        if key == "key":
            assert resp.status == 201
            document = await resp.json()

            snapshot.assert_match(document)
            assert await virtool.caches.db.get(dbi, document["id"])
        else:
            assert await resp_is.invalid_input(resp, {"key": ['required field']})

    async def test_duplicate_cache(self, dbi, spawn_job_client, static_time):
        """
        Test that uniqueness is enforced on `key`-`sample.id` pairs for `caches`

        """
        client = await spawn_job_client(authorize=True)

        await client.db.samples.insert_one({
            "_id": "test",
            "paired": False,
        })

        await client.db.caches.insert_one({
            "key": "aodp-abcdefgh",
            "sample": {
                "id": "test"
            }
        })

        data = {"key": "aodp-abcdefgh"}

        resp = await client.post("/api/samples/test/caches", json=data)

        assert resp.status == 409
        assert await dbi.caches.count_documents({}) == 1


@pytest.mark.parametrize("error", [None, 400, 409])
async def test_upload_artifact_cache(
        error,
        resp_is,
        snapshot,
        static_time,
        spawn_job_client,
        tmp_path
):
    """
    Test that a new artifact cache can be uploaded after sample creation using the Jobs API.

    """
    path = Path.cwd() / "tests" / "test_files" / "nuvs" / "reads_1.fq"
    artifact_type = "fastq" if error != 400 else "foo"

    data = {
        "file": open(path, "rb")
    }

    client = await spawn_job_client(authorize=True)

    client.app["settings"]["data_path"] = tmp_path

    cache_path = virtool.caches.utils.join_cache_path(client.app["settings"], "aodp-abcdefgh")

    await client.db.samples.insert_one({
        "_id": "test",
    })

    await client.db.caches.insert_one({
        "_id": "test",
        "key": "aodp-abcdefgh",
        "sample": {
            "id": "test"
        },
    })

    resp = await client.post(
        f"/api/samples/test/caches/aodp-abcdefgh/artifacts?name=small.fq&type={artifact_type}",
        data=data)

    if error == 409:
        data["file"] = open(path, "rb")
        resp_2 = await client.post(
            f"/api/samples/test/caches/aodp-abcdefgh/artifacts?name=small.fq&type={artifact_type}",
            data=data)

        assert await resp_is.conflict(resp_2,
                                      "Artifact file has already been uploaded for this sample cache")

    if not error:
        assert resp.status == 201
        snapshot.assert_match(await resp.json())
        assert os.listdir(cache_path) == ["small.fq"]
    elif error == 400:
        assert await resp_is.bad_request(resp, "Unsupported sample artifact type")


@pytest.mark.parametrize("paired", [True, False])
async def test_upload_reads_cache(paired, snapshot, static_time, spawn_job_client, tmp_path):
    """
    Test that sample reads' files cache can be uploaded using the Jobs API.

    """
    path = Path.cwd() / "tests" / "test_files" / "samples"

    data = {
        "file": open(path / "reads_1.fq.gz", "rb")
    }

    client = await spawn_job_client(authorize=True)

    client.app["settings"]["data_path"] = tmp_path
    cache_path = virtool.caches.utils.join_cache_path(client.app["settings"], "aodp-abcdefgh")

    await client.db.samples.insert_one({
        "_id": "test",
    })

    await client.db.caches.insert_one({
        "_id": "test",
        "key": "aodp-abcdefgh",
        "sample": {
            "id": "test"
        }
    })

    resp = await client.put(
        "/api/samples/test/caches/aodp-abcdefgh/reads/reads_1.fq.gz",
        data=data
    )

    assert resp.status == 201

    if paired:
        data["file"] = open(path / "reads_2.fq.gz", "rb")

        resp_2 = await client.put(
            "/api/samples/test/caches/aodp-abcdefgh/reads/reads_2.fq.gz",
            data=data
        )

        assert resp.status, resp_2.status == 201
        snapshot.assert_match(await resp_2.json())
        assert set(os.listdir(cache_path)) == {"reads_1.fq.gz", "reads_2.fq.gz"}
    else:
        snapshot.assert_match(await resp.json())
        assert os.listdir(cache_path) == ["reads_1.fq.gz"]


@pytest.mark.parametrize("error", [None, "404_sample", "404_reads", "404_file", "404_cache"])
async def test_download_reads_cache(error, spawn_job_client, pg, tmp_path):
    """
    Test that a sample reads cache can be downloaded using the Jobs API.

    """
    client = await spawn_job_client(authorize=True)

    client.app["settings"]["data_path"] = tmp_path

    filename = "reads_1.fq.gz"
    key = "aodp-abcdefgh"

    if error != "404_file":
        path = tmp_path / "caches" / key
        path.mkdir(parents=True)
        path.joinpath(filename).write_text("test")

    if error != "404_sample":
        await client.db.samples.insert_one({
            "_id": "foo",
        })

    if error != "404_cache":
        await client.db.caches.insert_one({
            "key": key,
            "sample": {
                "id": "test"
            }
        })
    if error != "404_reads":
        sample_reads_cache = SampleReadsCache(
            id=1,
            sample="foo",
            name=filename,
            name_on_disk=filename,
            key="aodp-abcdefgh"
        )

        async with AsyncSession(pg) as session:
            session.add(sample_reads_cache)
            await session.commit()

    resp = await client.get(f"/api/samples/foo/caches/{key}/reads/{filename}")

    expected_path = client.app["settings"]["data_path"] / "caches" / key / filename

    if error:
        assert resp.status == 404
    else:
        assert resp.status == 200
        assert expected_path.read_bytes() == await resp.content.read()


@pytest.mark.parametrize("error", [None, "404_sample", "404_artifact", "404_file", "404_cache"])
async def test_download_artifact_cache(error, spawn_job_client, pg: AsyncEngine, tmp_path):
    """
    Test that a sample artifact cache can be downloaded using the Jobs API.

    """
    client = await spawn_job_client(authorize=True)

    client.app["settings"]["data_path"] = tmp_path

    key = "aodp-abcdefgh"
    name = "fastqc.txt"
    name_on_disk = "1-fastqc.txt"

    if error != "404_file":
        path = tmp_path / "caches" / key
        path.mkdir(parents=True)
        path.joinpath(name_on_disk).write_text("text")

    if error != "404_sample":
        await client.db.samples.insert_one({
            "_id": "foo",
        })

    if error != "404_artifact":
        sample_artfact_cache = SampleArtifactCache(
            id=1,
            sample="foo",
            name=name,
            name_on_disk=name_on_disk,
            type="fastq",
            key="aodp-abcdefgh"
        )

        async with AsyncSession(pg) as session:
            session.add(sample_artfact_cache)

            await session.commit()

    if error != "404_cache":
        await client.db.caches.insert_one({
            "key": key,
            "sample": {
                "id": "test"
            }
        })

    resp = await client.get(f"/api/samples/foo/caches/{key}/artifacts/{name}")

    expected_path = client.app["settings"]["data_path"] / "caches" / key / name_on_disk

    if error:
        assert resp.status == 404
    else:
        assert resp.status == 200
        assert expected_path.read_bytes() == await resp.content.read()


@pytest.mark.parametrize("field", ["quality", "not_quality"])
async def test_finalize_cache(field, resp_is, snapshot, spawn_job_client):
    client = await spawn_job_client(authorize=True)

    data = {field: {}}

    await client.db.samples.insert_one({
        "_id": "test",
    })

    await client.db.caches.insert_one({
        "_id": "test",
        "key": "aodp-abcdefgh",
        "sample": {
            "id": "test"
        }
    })

    resp = await client.patch("/api/samples/test/caches/aodp-abcdefgh", json=data)

    if field == "quality":
        assert resp.status == 200
        snapshot.assert_match(await resp.json())
    else:
        assert resp.status == 422
        assert await resp_is.invalid_input(resp, {"quality": ["required field"]})
