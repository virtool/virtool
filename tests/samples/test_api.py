import asyncio
import datetime
import os

import arrow
import pytest
from aiohttp.test_utils import make_mocked_coro
from pymongo import ASCENDING
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from virtool_core.models.enums import LibraryType, Permission
from virtool_core.models.samples import WorkflowState

import virtool.caches.db
import virtool.pg.utils
from virtool.caches.models import SQLSampleArtifactCache, SQLSampleReadsCache
from virtool.caches.utils import join_cache_path
from virtool.config import get_config_from_app
from virtool.config.cls import ServerConfig
from virtool.data.errors import ResourceNotFoundError
from virtool.data.utils import get_data_from_app
from virtool.fake.next import DataFaker
from virtool.jobs.client import DummyJobsClient
from virtool.pg.utils import get_row_by_id
from virtool.samples.fake import create_fake_sample
from virtool.samples.models import SQLSampleArtifact, SQLSampleReads
from virtool.settings.oas import UpdateSettingsRequest
from virtool.uploads.models import SQLUpload


class MockJobInterface:
    def __init__(self):
        self.enqueue = make_mocked_coro()


@pytest.fixture
async def get_sample_data(mongo, fake2, pg, static_time):
    label = await fake2.labels.create()
    await fake2.labels.create()

    user = await fake2.users.create()

    await asyncio.gather(
        mongo.subtraction.insert_many(
            [
                {"_id": "apple", "name": "Apple"},
                {"_id": "pear", "name": "Pear"},
                {"_id": "peach", "name": "Peach"},
            ],
            session=None,
        ),
        mongo.samples.insert_one(
            {
                "_id": "test",
                "all_read": True,
                "all_write": True,
                "created_at": static_time.datetime,
                "files": [
                    {
                        "id": "foo",
                        "name": "Bar.fq.gz",
                        "download_url": "/download/samples/files/file_1.fq.gz",
                    }
                ],
                "format": "fastq",
                "group": "none",
                "group_read": True,
                "group_write": True,
                "hold": False,
                "host": "",
                "is_legacy": False,
                "isolate": "",
                "labels": [label.id],
                "library_type": LibraryType.normal.value,
                "locale": "",
                "name": "Test",
                "notes": "",
                "nuvs": False,
                "pathoscope": True,
                "ready": True,
                "subtractions": ["apple", "pear"],
                "user": {"id": user.id},
                "workflows": {
                    "aodp": WorkflowState.INCOMPATIBLE.value,
                    "pathoscope": WorkflowState.COMPLETE.value,
                    "nuvs": WorkflowState.PENDING.value,
                },
            }
        ),
    )

    reads = SQLSampleReads(
        name="reads_1.fq.gz",
        name_on_disk="reads_1.fq.gz",
        sample="test",
        size=2903109210,
        uploaded_at=static_time.datetime,
        upload=None,
    )

    async with AsyncSession(pg) as session:
        session.add_all(
            [
                SQLSampleArtifact(
                    name="reference.fa.gz",
                    sample="test",
                    type="fasta",
                    name_on_disk="reference.fa.gz",
                ),
                reads,
            ]
        )
        await session.commit()

    return user.id


@pytest.fixture
async def setup_find_samples_client(fake2, spawn_client, static_time):
    async def setup():
        user_1 = await fake2.users.create()
        user_2 = await fake2.users.create()

        label_1 = await fake2.labels.create()
        label_2 = await fake2.labels.create()
        label_3 = await fake2.labels.create()

        client = await spawn_client(authorize=True)

        await client.db.samples.insert_many(
            [
                {
                    "user": {"id": user_1.id},
                    "nuvs": True,
                    "host": "",
                    "foobar": True,
                    "isolate": "Thing",
                    "created_at": arrow.get(static_time.datetime)
                    .shift(hours=1)
                    .datetime,
                    "_id": "beb1eb10",
                    "name": "16GVP042",
                    "pathoscope": True,
                    "library_type": "normal",
                    "all_read": True,
                    "ready": True,
                    "labels": [label_1.id, label_2.id],
                    "notes": "",
                    "workflows": {"aodp": "none", "nuvs": "none", "pathoscope": "none"},
                },
                {
                    "user": {"id": user_2.id},
                    "nuvs": False,
                    "host": "",
                    "foobar": True,
                    "isolate": "Test",
                    "library_type": "srna",
                    "created_at": arrow.get(static_time.datetime).datetime,
                    "_id": "72bb8b31",
                    "name": "16GVP043",
                    "pathoscope": False,
                    "all_read": True,
                    "ready": True,
                    "labels": [label_1.id],
                    "notes": "This is a good sample.",
                    "workflows": {"aodp": "none", "nuvs": "none", "pathoscope": "none"},
                },
                {
                    "user": {"id": user_2.id},
                    "nuvs": False,
                    "host": "",
                    "library_type": "amplicon",
                    "notes": "",
                    "foobar": True,
                    "ready": True,
                    "isolate": "",
                    "created_at": arrow.get(static_time.datetime)
                    .shift(hours=2)
                    .datetime,
                    "_id": "cb400e6d",
                    "name": "16SPP044",
                    "pathoscope": False,
                    "all_read": True,
                    "labels": [label_3.id],
                    "workflows": {"aodp": "none", "nuvs": "none", "pathoscope": "none"},
                },
            ],
            session=None,
        )

        return client

    return setup()


@pytest.mark.apitest
class TestFindSamples:
    @pytest.mark.parametrize("path", ["/samples", "/spaces/0/samples"])
    @pytest.mark.parametrize("find", [None, "gv", "sp"])
    async def test_term(self, find, path, snapshot, setup_find_samples_client):
        client = await setup_find_samples_client

        if find is not None:
            path += f"?find={find}"

        resp = await client.get(path)
        assert resp.status == 200
        assert await resp.json() == snapshot

    @pytest.mark.parametrize("per_page,page", [(None, None), (2, 1), (2, 2)])
    async def test_page_perpage(
        self, per_page, page, fake2, spawn_client, snapshot, setup_find_samples_client
    ):
        client = await setup_find_samples_client
        path = "/samples"
        query = []
        if per_page is not None:
            query.append(f"per_page={per_page}")
        if page is not None:
            query.append(f"page={page}")
            path += f"?{'&'.join(query)}"

        resp = await client.get(path)
        assert resp.status == 200
        assert await resp.json() == snapshot

    @pytest.mark.parametrize("labels", [None, [3], [2, 3], [0]])
    async def test_labels(self, labels, snapshot, setup_find_samples_client):
        client = await setup_find_samples_client
        path = "/samples"

        if labels is not None:
            label_query = "&label=".join(str(label) for label in labels)
            path += f"?label={label_query}"

        resp = await client.get(path)
        assert resp.status == 200
        assert await resp.json() == snapshot

    @pytest.mark.parametrize(
        "workflows",
        [
            None,
            ["nuvs:ready", "pathoscope:ready"],
            ["pathoscope:ready", "pathoscope:none"],
            ["nuvs:none", "pathoscope:none", "pathoscope:ready"],
        ],
    )
    async def test_workflows(self, workflows, snapshot, setup_find_samples_client):
        client = await setup_find_samples_client
        path = "/samples"

        if workflows is not None:
            workflows_query = "&workflows=".join(workflow for workflow in workflows)
            path += f"?workflows={workflows_query}"

        resp = await client.get(path)
        assert resp.status == 200
        assert await resp.json() == snapshot


@pytest.mark.apitest
class TestGet:
    @pytest.mark.parametrize(
        "administrator,owner,all_read,group_read,group,status",
        [
            # User is administrator.
            (True, False, False, False, "none", 200),
            # User is owner.
            (False, True, False, False, "none", 200),
            # Anyone can read because of all_read.
            (False, False, True, False, "none", 200),
            # User is part of group with read right.
            (False, False, False, True, "technicians", 200),
            # User is not part of a group with read right.
            (False, False, False, True, "managers", 403),
        ],
        ids=[
            "administrator",
            "owner",
            "all_read",
            "group_read",
            "not_in_group",
        ],
    )
    async def test_get(
        self,
        administrator,
        owner,
        all_read,
        group_read,
        group,
        status,
        get_sample_data,
        snapshot,
        spawn_client,
        static_time,
    ):
        client = await spawn_client(
            authorize=True, administrator=administrator, groups=["technicians"]
        )

        update = {"all_read": all_read, "group_read": group_read, "group": group}

        if owner:
            update["user"] = {"id": "test"}

        await client.db.samples.update_one(
            {"_id": "test"},
            {"$set": update},
        )

        resp = await client.get("/samples/test")

        assert resp.status == status
        assert await resp.json() == snapshot(name="json")

    async def test_not_found(self, spawn_client):
        client = await spawn_client(authorize=True)
        resp = await client.get("/samples/dne")
        assert resp.status == 404


@pytest.mark.apitest
class TestCreate:
    @pytest.mark.parametrize(
        "group_setting", ["none", "users_primary_group", "force_choice"]
    )
    async def test(
        self,
        fake2,
        group_setting,
        snapshot,
        spawn_client,
        pg: AsyncEngine,
        static_time,
        test_upload,
    ):
        client = await spawn_client(
            authorize=True, permissions=[Permission.create_sample]
        )

        await get_data_from_app(client.app).settings.update(
            UpdateSettingsRequest(
                sample_group=group_setting,
                sample_all_write=True,
                sample_group_write=True,
            )
        )

        data = get_data_from_app(client.app)
        dummy_jobs_client = DummyJobsClient()
        data.jobs._client = dummy_jobs_client
        data.samples.jobs_client = dummy_jobs_client

        label = await fake2.labels.create()

        await client.db.subtraction.insert_one({"_id": "apple", "name": "Apple"})

        async with AsyncSession(pg) as session:
            session.add(test_upload)
            await session.commit()

        await client.db.groups.insert_many(
            [{"_id": "diagnostics"}, {"_id": "technician"}], session=None
        )

        request_data = {
            "name": "Foobar",
            "files": [1],
            "labels": [label.id],
            "subtractions": ["apple"],
        }

        if group_setting == "force_choice":
            request_data["group"] = "diagnostics"

        resp = await client.post("/samples", request_data)

        assert resp.status == 201
        assert resp.headers["Location"] == snapshot
        assert await resp.json() == snapshot

        assert await client.db.samples.find_one() == snapshot

        assert data.jobs._client.enqueued == [("create_sample", "bf1b993c")]

        upload = await get_row_by_id(pg, SQLUpload, 1)

        assert upload.reserved is True

    @pytest.mark.parametrize("path", ["/samples", "/spaces/0/samples"])
    async def test_name_exists(
        self,
        pg,
        spawn_client,
        static_time,
        resp_is,
        test_upload,
        path,
    ):
        client = await spawn_client(
            authorize=True, permissions=[Permission.create_sample]
        )

        async with AsyncSession(pg) as session:
            session.add(test_upload)

            await asyncio.gather(
                client.db.samples.insert_one(
                    {
                        "_id": "foobar",
                        "name": "Foobar",
                        "lower_name": "foobar",
                        "created_at": static_time.datetime,
                        "nuvs": False,
                        "pathoscope": False,
                        "ready": True,
                    }
                ),
                client.db.subtraction.insert_one({"_id": "apple", "name": "Apple"}),
                session.commit(),
            )

        resp = await client.post(
            path, {"name": "Foobar", "files": [1], "subtractions": ["apple"]}
        )

        await resp_is.bad_request(resp, "Sample name is already in use")

    @pytest.mark.parametrize("group", ["", "diagnostics", None])
    async def test_force_choice(
        self, spawn_client, pg: AsyncEngine, resp_is, group, test_upload
    ):
        """
        Test that when ``force_choice`` is enabled, a request with no group field passed results in
        an error response, that "" is accepted as a valid user group and that valid user groups are accepted as expected

        """
        client = await spawn_client(
            authorize=True, permissions=[Permission.create_sample]
        )

        async with AsyncSession(pg) as session:
            session.add(test_upload)

            await asyncio.gather(
                session.commit(),
                client.db.groups.insert_one(
                    {"_id": "diagnostics", "name": "Diagnostics"},
                ),
                get_data_from_app(client.app).settings.update(
                    UpdateSettingsRequest(sample_group="force_choice")
                ),
                client.db.subtraction.insert_one({"_id": "apple", "name": "Apple"}),
            )

        request_data = {"name": "Foobar", "files": [1], "subtractions": ["apple"]}

        if group is None:
            resp = await client.post("/samples", request_data)
            await resp_is.bad_request(resp, "Group value required for sample creation")
        else:
            request_data["group"] = group
            resp = await client.post("/samples", request_data)
            assert resp.status == 201

    async def test_group_dne(self, spawn_client, pg: AsyncEngine, resp_is, test_upload):
        client = await spawn_client(
            authorize=True, permissions=[Permission.create_sample]
        )

        await get_data_from_app(client.app).settings.update(
            UpdateSettingsRequest(sample_group="force_choice")
        )

        async with AsyncSession(pg) as session:
            session.add(test_upload)

            await asyncio.gather(
                session.commit(),
                get_data_from_app(client.app).settings.update(
                    UpdateSettingsRequest(
                        sample_group="force_choice",
                    )
                ),
                client.db.subtraction.insert_one({"_id": "apple", "name": "Apple"}),
            )

        resp = await client.post(
            "/samples",
            {
                "name": "Foobar",
                "files": [1],
                "subtractions": ["apple"],
                "group": "foobar",
            },
        )
        await resp_is.bad_request(resp, "Group does not exist")

    async def test_subtraction_dne(
        self, pg: AsyncEngine, spawn_client, resp_is, test_upload
    ):
        client = await spawn_client(
            authorize=True, permissions=[Permission.create_sample]
        )

        async with AsyncSession(pg) as session:
            session.add(test_upload)
            await session.commit()

        resp = await client.post(
            "/samples", {"name": "Foobar", "files": [1], "subtractions": ["apple"]}
        )
        await resp_is.bad_request(resp, "Subtractions do not exist: apple")

    @pytest.mark.parametrize("one_exists", [True, False])
    async def test_file_dne(
        self, one_exists, spawn_client, pg: AsyncEngine, resp_is, test_upload
    ):
        """
        Test that a ``404`` is returned if one or more of the file ids passed in ``files`` does not
        exist.

        """
        client = await spawn_client(
            authorize=True, permissions=[Permission.create_sample]
        )

        await client.db.subtraction.insert_one(
            {
                "_id": "apple",
            }
        )

        if one_exists:
            async with AsyncSession(pg) as session:
                session.add(test_upload)
                await session.commit()

        resp = await client.post(
            "/samples", {"name": "Foobar", "files": [1, 2], "subtractions": ["apple"]}
        )

        await resp_is.bad_request(resp, "File does not exist")

    async def test_label_dne(self, spawn_client, pg: AsyncEngine, resp_is, test_upload):
        client = await spawn_client(
            authorize=True, permissions=[Permission.create_sample]
        )

        async with AsyncSession(pg) as session:
            session.add(test_upload)
            await session.commit()

        resp = await client.post(
            "/samples", {"name": "Foobar", "files": [1], "labels": [1]}
        )

        await resp_is.bad_request(resp, "Labels do not exist: [1]")


@pytest.mark.apitest
class TestEdit:
    async def test(self, get_sample_data, snapshot, spawn_client):
        """
        Test that an existing sample can be edited correctly.

        """
        client = await spawn_client(authorize=True, administrator=True)

        resp = await client.patch(
            "/samples/test",
            {
                "name": "test_sample",
                "subtractions": ["peach"],
                "labels": [1],
                "notes": "This is a test.",
            },
        )

        assert resp.status == 200
        assert await resp.json() == snapshot

    async def test_name_exists(self, spawn_client, resp_is):
        """
        Test that a ``bad_request`` is returned if the sample name passed in ``name``
        already exists.

        """
        client = await spawn_client(authorize=True, administrator=True)

        await client.db.samples.insert_many(
            [
                {
                    "_id": "foo",
                    "name": "Foo",
                    "all_read": True,
                    "all_write": True,
                    "ready": True,
                    "subtractions": [],
                    "user": {
                        "id": "test",
                    },
                },
                {
                    "_id": "bar",
                    "name": "Bar",
                    "ready": True,
                    "subtractions": [],
                    "user": {
                        "id": "test",
                    },
                },
            ],
            session=None,
        )

        resp = await client.patch("/samples/foo", {"name": "Bar"})

        assert resp.status == 400
        await resp_is.bad_request(resp, "Sample name is already in use")

    async def test_label_exists(
        self,
        snapshot,
        spawn_client,
    ):
        """
        Test that a ``bad_request`` is returned if the label passed in ``labels`` does
        not exist.

        """
        client = await spawn_client(authorize=True, administrator=True)

        await client.db.samples.insert_one(
            {
                "_id": "foo",
                "name": "Foo",
                "all_read": True,
                "all_write": True,
                "subtractions": [],
                "user": {"id": "test"},
                "labels": [2, 3],
                "ready": True,
            }
        )
        resp = await client.patch("/samples/foo", {"labels": [1]})

        assert resp.status == 400
        assert await resp.json() == snapshot(name="json")

    async def test_subtraction_exists(self, fake2, snapshot, spawn_client):
        """
        Test that a ``bad_request`` is returned if the subtraction passed in
        ``subtractions`` does not exist.

        """
        client = await spawn_client(authorize=True, administrator=True)

        user = await fake2.users.create()

        await asyncio.gather(
            client.db.samples.insert_one(
                {
                    "_id": "test",
                    "name": "Test",
                    "all_read": True,
                    "all_write": True,
                    "ready": True,
                    "subtractions": ["apple"],
                    "user": {"id": user.id},
                }
            ),
            client.db.subtraction.insert_one({"_id": "foo", "name": "Foo"}),
        )

        resp = await client.patch("/samples/test", {"subtractions": ["foo", "bar"]})

        assert resp.status == 400
        assert await resp.json() == snapshot(name="json")


@pytest.mark.apitest
@pytest.mark.parametrize("field", ["quality", "not_quality"])
async def test_finalize(
    field, snapshot, fake2, spawn_job_client, resp_is, pg, tmp_path
):
    """
    Test that sample can be finalized using the Jobs API.

    """
    label = await fake2.labels.create()
    await fake2.labels.create()

    user = await fake2.users.create()

    client = await spawn_job_client(authorize=True)

    get_config_from_app(client.app).data_path = tmp_path
    data = {
        field: {
            "bases": [[1543]],
            "composition": [[6372]],
            "count": 7069,
            "encoding": "OuBQPPuwYimrxkNpPWUx",
            "gc": 34222440,
            "length": [3237],
            "sequences": [7091],
        }
    }

    await client.db.samples.insert_one(
        {
            "_id": "test",
            "all_read": True,
            "all_write": True,
            "created_at": 13,
            "files": [
                {
                    "id": "foo",
                    "name": "Bar.fq.gz",
                    "download_url": "/download/samples/files/file_1.fq.gz",
                }
            ],
            "format": "fastq",
            "group": "none",
            "group_read": True,
            "group_write": True,
            "hold": False,
            "host": "",
            "is_legacy": False,
            "isolate": "",
            "labels": [label.id],
            "library_type": LibraryType.normal.value,
            "locale": "",
            "name": "Test",
            "notes": "",
            "nuvs": False,
            "pathoscope": True,
            "ready": True,
            "subtractions": ["apple", "pear"],
            "user": {"id": user.id},
            "workflows": {
                "aodp": WorkflowState.INCOMPATIBLE.value,
                "pathoscope": WorkflowState.COMPLETE.value,
                "nuvs": WorkflowState.PENDING.value,
            },
            "quality": None,
        }
    )

    async with AsyncSession(pg) as session:
        upload = SQLUpload(name="test", name_on_disk="test.fq.gz")

        artifact = SQLSampleArtifact(
            name="reference.fa.gz",
            sample="test",
            type="fasta",
            name_on_disk="reference.fa.gz",
        )

        reads = SQLSampleReads(
            name="reads_1.fq.gz",
            name_on_disk="reads_1.fq.gz",
            sample="test",
            size=12,
            uploaded_at=datetime.datetime(2023, 9, 1, 1, 1),
        )

        upload.reads.append(reads)

        session.add_all([upload, artifact, reads])

        await session.commit()

    resp = await client.patch("/samples/test", json=data)

    if field == "quality":
        assert resp.status == 200
        assert await resp.json() == snapshot
        with pytest.raises(ResourceNotFoundError):
            await get_data_from_app(client.app).uploads.get(1)
        assert not (await virtool.pg.utils.get_row_by_id(pg, SQLSampleReads, 1)).upload
    else:
        assert resp.status == 422
        await resp_is.invalid_input(resp, {"quality": ["required field"]})


@pytest.mark.apitest
async def test_delete(fake2, spawn_client, tmpdir):
    """Test the ability to delete a sample."""
    client = await spawn_client(authorize=True)

    user = await fake2.users.create()

    await create_fake_sample(client.app, "test", user.id, finalized=True)

    resp = await client.get("/samples/test")
    assert resp.status == 200

    resp = await client.delete("/samples/test")
    assert resp.status == 204

    resp = await client.get("/samples/test")
    assert resp.status == 404


class TestDelete:
    @pytest.mark.parametrize("finalized", [True, False])
    async def test(
        self,
        config: ServerConfig,
        finalized: bool,
        fake2: DataFaker,
        spawn_client,
        tmp_path,
    ):
        client = await spawn_client(authorize=True)

        (config.data_path / "samples/test").mkdir(parents=True)

        user = await fake2.users.create()

        await create_fake_sample(client.app, "test", user.id, finalized=finalized)

        resp = await client.delete("/samples/test")

        assert resp.status == 204 if finalized else 400

    @pytest.mark.parametrize("finalized", [True, False])
    async def test_from_job(
        self,
        finalized: bool,
        config: ServerConfig,
        fake2: DataFaker,
        spawn_job_client,
    ):
        """Test that job client can delete a sample only when it is unfinalized."""
        client = await spawn_job_client(authorize=True)

        (config.data_path / "samples/test").mkdir(parents=True)

        user = await fake2.users.create()

        await create_fake_sample(client.app, "test", user.id, finalized=finalized)

        resp = await client.delete("/samples/test")

        if finalized:
            assert resp.status == 400
        else:
            assert resp.status == 204

    async def test_not_found(self, spawn_client):
        client = await spawn_client(authorize=True)
        resp = await client.delete("/samples/test")
        assert resp.status == 404

    async def test_not_found_from_job(self, spawn_job_client):
        client = await spawn_job_client(authorize=True)
        resp = await client.delete("/samples/test")
        assert resp.status == 404


@pytest.mark.apitest
@pytest.mark.parametrize("error", [None, "404"])
@pytest.mark.parametrize("term", [None, "Baz"])
async def test_find_analyses(
    error, term, snapshot, mocker, fake2, spawn_client, resp_is, static_time
):
    mocker.patch("virtool.samples.utils.get_sample_rights", return_value=(True, True))

    client = await spawn_client(authorize=True)

    if not error:
        await client.db.samples.insert_one(
            {
                "_id": "test",
                "created_at": static_time.datetime,
                "all_read": True,
                "all_write": True,
                "ready": True,
            }
        )

    user_1 = await fake2.users.create()
    user_2 = await fake2.users.create()

    job = await fake2.jobs.create(user=user_1)

    await asyncio.gather(
        client.db.subtraction.insert_one(
            {"_id": "foo", "name": "Malus domestica", "nickname": "Apple"}
        ),
        client.db.references.insert_many(
            [
                {"_id": "foo", "data_type": "genome", "name": "Foo"},
                {"_id": "baz", "data_type": "genome", "name": "Baz"},
            ],
            session=None,
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
                    "reference": {"id": "baz", "name": "Baz"},
                    "sample": {"id": "test"},
                    "subtractions": [],
                    "user": {"id": user_1.id},
                    "foobar": True,
                },
                {
                    "_id": "test_2",
                    "workflow": "pathoscope_bowtie",
                    "created_at": static_time.datetime,
                    "ready": True,
                    "job": {"id": "foo"},
                    "index": {"version": 2, "id": "foo"},
                    "user": {"id": user_1.id},
                    "reference": {"id": "baz", "name": "Baz"},
                    "sample": {"id": "test"},
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
                    "reference": {"id": "foo", "name": "Foo"},
                    "sample": {"id": "test"},
                    "subtractions": ["foo"],
                    "user": {"id": user_2.id},
                    "foobar": False,
                },
            ],
            session=None,
        ),
    )

    url = "/samples/test/analyses"

    if term:
        url = f"{url}?term={term}"

    resp = await client.get(url)

    if error:
        await resp_is.not_found(resp)

    else:
        assert resp.status == 200
        assert await resp.json() == snapshot


@pytest.mark.apitest
@pytest.mark.parametrize(
    "error",
    [None, "400_reference", "400_index", "400_ready_index", "400_subtraction", "404"],
)
async def test_analyze(
    error,
    mocker,
    snapshot,
    spawn_client,
    static_time,
    resp_is,
    test_random_alphanumeric,
):
    mocker.patch("virtool.samples.utils.get_sample_rights", return_value=(True, True))

    client = await spawn_client(authorize=True)
    client.app["jobs"] = MockJobInterface()

    if error != "400_reference":
        await client.db.references.insert_one({"_id": "foo"})

    if error != "400_index":
        await client.db.indexes.insert_one(
            {
                "_id": "test",
                "reference": {"id": "foo"},
                "ready": error != "400_ready_index",
                "version": 4,
            }
        )

    if error != "400_subtraction":
        await client.db.subtraction.insert_one({"_id": "bar"})

    if error != "404":
        await client.db.samples.insert_one(
            {
                "_id": "test",
                "name": "Test",
                "created_at": static_time.datetime,
                "all_read": True,
                "all_write": True,
                "ready": True,
            }
        )

    resp = await client.post(
        "/samples/test/analyses",
        data={
            "workflow": "pathoscope_bowtie",
            "ref_id": "foo",
            "subtractions": ["bar"],
        },
    )

    if error == "400_reference":
        await resp_is.bad_request(resp, "Reference does not exist")
        return

    if error in ["400_index", "400_ready_index"]:
        await resp_is.bad_request(resp, "No ready index")
        return

    if error == "400_subtraction":
        await resp_is.bad_request(resp, "Subtractions do not exist: bar")
        return

    if error == "404":
        await resp_is.not_found(resp)
        return

    assert resp.status == 201
    assert resp.headers["Location"] == "/analyses/fb085f7f"
    assert await resp.json() == snapshot


@pytest.mark.apitest
@pytest.mark.parametrize("ready", [True, False])
@pytest.mark.parametrize("exists", [True, False])
async def test_cache_job_remove(exists, ready, tmp_path, spawn_job_client, resp_is):
    client = await spawn_job_client(authorize=True)

    get_config_from_app(client.app).data_path = tmp_path

    path = tmp_path / "caches" / "foo"
    path.mkdir(parents=True)
    path.joinpath("reads_1.fq.gz").write_text("Cache file")

    if exists:
        await client.db.caches.insert_one(
            {"_id": "foo", "key": "abc123", "sample": {"id": "bar"}, "ready": ready}
        )

    resp = await client.delete("/samples/bar/caches/abc123")

    if not exists:
        assert resp.status == 404
        return

    if ready:
        await resp_is.conflict(resp, "Jobs cannot delete finalized caches")
        return

    await resp_is.no_content(resp)
    assert await client.db.caches.find_one("foo") is None
    assert not (tmp_path / "caches" / "foo").is_dir()


@pytest.mark.apitest
@pytest.mark.parametrize("error", [None, 400, 409])
async def test_upload_artifact(
    error, snapshot, spawn_job_client, static_time, resp_is, test_files_path, tmp_path
):
    """
    Test that new artifacts can be uploaded after sample creation using the Jobs API.

    """
    path = test_files_path / "nuvs" / "reads_1.fq"

    client = await spawn_job_client(authorize=True)

    get_config_from_app(client.app).data_path = tmp_path
    sample_file_path = tmp_path / "samples" / "test"

    await client.db.samples.insert_one(
        {
            "_id": "test",
            "ready": True,
        }
    )

    artifact_type = "fastq" if error != 400 else "foo"

    data = {"file": open(path, "rb")}

    resp = await client.post(
        f"/samples/test/artifacts?name=small.fq&type={artifact_type}", data=data
    )

    if error == 409:
        resp_2 = await client.post(
            f"/samples/test/artifacts?name=small.fq&type={artifact_type}",
            data={**data, "file": open(path, "rb")},
        )

        await resp_is.conflict(
            resp_2, "Artifact file has already been uploaded for this sample"
        )

    if not error:
        assert resp.status == 201
        assert await resp.json() == snapshot
        assert os.listdir(sample_file_path) == ["small.fq"]
    elif error == 400:
        await resp_is.bad_request(resp, "Unsupported sample artifact type")


@pytest.mark.apitest
class TestUploadReads:
    @pytest.mark.parametrize("compressed", [True, False])
    async def test_upload_reads(
        self,
        compressed,
        mocker,
        snapshot,
        spawn_job_client,
        static_time,
        resp_is,
        test_files_path,
        tmp_path,
        fake2,
    ):
        """
        Test that new sample reads can be uploaded using the Jobs API.

        """
        path = test_files_path / "samples"

        data = {"file": open(path / "reads_1.fq.gz", "rb")}

        client = await spawn_job_client(authorize=True)

        get_config_from_app(client.app).data_path = tmp_path

        await client.db.samples.insert_one(
            {
                "_id": "test",
                "ready": True,
            }
        )

        user = await fake2.users.create()

        await get_data_from_app(client.app).uploads.create(
            "test", "reads", False, user=user.id
        )

        if not compressed:
            mocker.patch(
                "virtool.uploads.utils.naive_writer",
                side_effect=OSError("Not a gzipped file"),
            )

        resp = await client.put("/samples/test/reads/reads_1.fq.gz?upload=1", data=data)

        if compressed:
            assert resp.status == 201
            assert await resp.json() == snapshot
        else:
            await resp_is.bad_request(resp, "File is not compressed")

    @pytest.mark.parametrize("conflict", [True, False])
    async def test_upload_paired_reads(
        self, conflict, resp_is, spawn_job_client, test_files_path, tmp_path
    ):
        """
        Test that paired sample reads can be uploaded using the Jobs API and that
        conflicts are properly handled.

        """
        path = test_files_path / "samples"

        data = {"file": open(path / "reads_1.fq.gz", "rb")}

        client = await spawn_job_client(authorize=True)

        get_config_from_app(client.app).data_path = tmp_path
        sample_file_path = tmp_path / "samples" / "test"

        await client.db.samples.insert_one(
            {
                "_id": "test",
                "ready": True,
            }
        )

        resp = await client.put("/samples/test/reads/reads_1.fq.gz", data=data)

        data["file"] = open(path / "reads_2.fq.gz", "rb")
        resp_2 = await client.put("/samples/test/reads/reads_2.fq.gz", data=data)

        if conflict:
            data["file"] = open(path / "reads_2.fq.gz", "rb")
            resp_3 = await client.put("/samples/test/reads/reads_2.fq.gz", data=data)

            await resp_is.conflict(
                resp_3, "Reads file name is already uploaded for this sample"
            )

        assert resp.status == 201
        assert resp_2.status == 201
        assert set(os.listdir(sample_file_path)) == {"reads_1.fq.gz", "reads_2.fq.gz"}


@pytest.mark.apitest
@pytest.mark.parametrize("error", [None, "404"])
async def test_get_cache(error, snapshot, spawn_job_client, resp_is, static_time):
    client = await spawn_job_client(authorize=True)

    cache = {
        "_id": "bar",
        "program": "skewer-0.2.2",
        "key": "test" if error == "404" else "abc123",
        "sample": {"id": "foo"},
    }

    await client.db.caches.insert_one(cache)

    resp = await client.get("/samples/foo/caches/abc123")

    if error == "404":
        await resp_is.not_found(resp)
        return

    assert resp.status == 200
    assert await resp.json() == snapshot


@pytest.mark.apitest
@pytest.mark.parametrize("suffix", ["1", "2"])
@pytest.mark.parametrize("error", [None, "404_sample", "404_reads", "404_file"])
async def test_download_reads(
    suffix, error, tmp_path, spawn_client, spawn_job_client, pg
):
    client = await spawn_client(authorize=True)
    job_client = await spawn_job_client(authorize=True)

    get_config_from_app(client.app).data_path = tmp_path
    get_config_from_app(job_client.app).data_path = tmp_path

    file_name = f"reads_{suffix}.fq.gz"

    if error != "404_file":
        path = tmp_path / "samples" / "foo"
        path.mkdir(parents=True)
        path.joinpath(file_name).write_text("test")

    if error != "404_sample":
        await client.db.samples.insert_one(
            {
                "_id": "foo",
                "ready": True,
            }
        )

    if error != "404_reads":
        async with AsyncSession(pg) as session:
            session.add(
                SQLSampleReads(
                    id=1, sample="foo", name=file_name, name_on_disk=file_name
                )
            )
            await session.commit()

    resp = await client.get(f"/samples/foo/reads/{file_name}")
    job_resp = await job_client.get(f"/samples/foo/reads/{file_name}")

    expected_path = (
        get_config_from_app(client.app).data_path / "samples" / "foo" / file_name
    )

    if error:
        assert resp.status == job_resp.status == 404
        return

    assert resp.status == job_resp.status == 200
    assert (
        expected_path.read_bytes()
        == await resp.content.read()
        == await job_resp.content.read()
    )


@pytest.mark.apitest
@pytest.mark.parametrize("error", [None, "404_sample", "404_artifact", "404_file"])
async def test_download_artifact(error, tmp_path, spawn_job_client, pg):
    client = await spawn_job_client(authorize=True)

    get_config_from_app(client.app).data_path = tmp_path

    if error != "404_file":
        path = tmp_path / "samples" / "foo"
        path.mkdir(parents=True)
        path.joinpath("fastqc.txt").write_text("test")

    if error != "404_sample":
        await client.db.samples.insert_one(
            {
                "_id": "foo",
                "ready": True,
            }
        )

    if error != "404_artifact":
        async with AsyncSession(pg) as session:
            session.add(
                SQLSampleArtifact(
                    id=1,
                    sample="foo",
                    name="fastqc.txt",
                    name_on_disk="fastqc.txt",
                    type="fastq",
                )
            )

            await session.commit()

    resp = await client.get("/samples/foo/artifacts/fastqc.txt")

    expected_path = (
        get_config_from_app(client.app).data_path / "samples" / "foo" / "fastqc.txt"
    )

    if error:
        assert resp.status == 404
        return

    assert resp.status == 200
    assert expected_path.read_bytes() == await resp.content.read()


@pytest.mark.apitest
class TestCreateCache:
    @pytest.mark.parametrize("key", ["key", "not_key"])
    async def test(
        self, key, mongo, mocker, resp_is, snapshot, static_time, spawn_job_client
    ):
        """
        Test that a new cache document can be created in the `caches` db using the Jobs API.

        """
        client = await spawn_job_client(authorize=True)

        await client.db.samples.insert_one(
            {
                "_id": "test",
                "paired": False,
                "ready": True,
            }
        )

        data = {key: "aodp-abcdefgh"}

        mocker.patch("virtool.utils.random_alphanumeric", return_value="a1b2c3d4")

        resp = await client.post("/samples/test/caches", json=data)

        if key == "key":
            assert resp.status == 201
            assert resp.headers["Location"] == snapshot

            resp_json = await resp.json()
            assert resp_json == snapshot
            assert await virtool.caches.db.get(mongo, resp_json["id"])
        else:
            await resp_is.invalid_input(resp, {"key": ["required field"]})

    async def test_duplicate_cache(self, mongo, spawn_job_client, static_time):
        """
        Test that uniqueness is enforced on `key`-`sample.id` pairs for `caches`

        """
        await mongo.caches.create_index(
            [("key", ASCENDING), ("sample.id", ASCENDING)], unique=True
        )

        client = await spawn_job_client(authorize=True)

        await client.db.samples.insert_one(
            {
                "_id": "test",
                "paired": False,
                "ready": True,
            }
        )

        await client.db.caches.insert_one(
            {"key": "aodp-abcdefgh", "sample": {"id": "test"}}
        )

        data = {"key": "aodp-abcdefgh"}

        resp = await client.post("/samples/test/caches", json=data)

        assert resp.status == 409
        assert await mongo.caches.count_documents({}) == 1


@pytest.mark.apitest
@pytest.mark.parametrize("error", [None, 400, 409])
async def test_upload_artifact_cache(
    error, resp_is, snapshot, static_time, spawn_job_client, test_files_path, tmp_path
):
    """
    Test that a new artifact cache can be uploaded after sample creation using the Jobs API.

    """
    path = test_files_path / "nuvs" / "reads_1.fq"
    artifact_type = "fastq" if error != 400 else "foo"

    data = {"file": open(path, "rb")}

    client = await spawn_job_client(authorize=True)

    get_config_from_app(client.app).data_path = tmp_path

    cache_path = join_cache_path(get_config_from_app(client.app), "aodp-abcdefgh")

    await client.db.samples.insert_one(
        {
            "_id": "test",
            "ready": True,
        }
    )

    await client.db.caches.insert_one(
        {
            "_id": "test",
            "key": "aodp-abcdefgh",
            "sample": {"id": "test"},
        }
    )

    resp = await client.post(
        f"/samples/test/caches/aodp-abcdefgh/artifacts?name=small.fq&type={artifact_type}",
        data=data,
    )

    if error == 409:
        data["file"] = open(path, "rb")
        resp_2 = await client.post(
            f"/samples/test/caches/aodp-abcdefgh/artifacts?name=small.fq&type={artifact_type}",
            data=data,
        )

        await resp_is.conflict(
            resp_2, "Artifact file has already been uploaded for this sample cache"
        )

    if not error:
        assert resp.status == 201
        assert await resp.json() == snapshot
        assert os.listdir(cache_path) == ["small.fq"]
    elif error == 400:
        await resp_is.bad_request(resp, "Unsupported sample artifact type")


@pytest.mark.apitest
@pytest.mark.parametrize("paired", [True, False])
async def test_upload_reads_cache(
    paired, snapshot, static_time, spawn_job_client, test_files_path, tmp_path
):
    """
    Test that sample reads' files cache can be uploaded using the Jobs API.

    """
    path = test_files_path / "samples"

    data = {"file": open(path / "reads_1.fq.gz", "rb")}

    client = await spawn_job_client(authorize=True)

    get_config_from_app(client.app).data_path = tmp_path
    cache_path = join_cache_path(get_config_from_app(client.app), "aodp-abcdefgh")

    await client.db.samples.insert_one(
        {
            "_id": "test",
            "ready": True,
        }
    )

    await client.db.caches.insert_one(
        {"_id": "test", "key": "aodp-abcdefgh", "sample": {"id": "test"}}
    )

    resp = await client.put(
        "/samples/test/caches/aodp-abcdefgh/reads/reads_1.fq.gz", data=data
    )

    assert resp.status == 201

    if paired:
        data["file"] = open(path / "reads_2.fq.gz", "rb")

        resp = await client.put(
            "/samples/test/caches/aodp-abcdefgh/reads/reads_2.fq.gz", data=data
        )

        assert resp.status == 201
        assert await resp.json() == snapshot

        assert set(os.listdir(cache_path)) == {"reads_1.fq.gz", "reads_2.fq.gz"}
    else:
        assert await resp.json() == snapshot
        assert os.listdir(cache_path) == ["reads_1.fq.gz"]


@pytest.mark.apitest
@pytest.mark.parametrize(
    "error", [None, "404_sample", "404_reads", "404_file", "404_cache"]
)
async def test_download_reads_cache(error, spawn_job_client, pg, tmp_path):
    """
    Test that a sample reads cache can be downloaded using the Jobs API.

    """
    client = await spawn_job_client(authorize=True)

    get_config_from_app(client.app).data_path = tmp_path

    filename = "reads_1.fq.gz"
    key = "aodp-abcdefgh"

    if error != "404_file":
        path = tmp_path / "caches" / key
        path.mkdir(parents=True)
        path.joinpath(filename).write_text("test")

    if error != "404_sample":
        await client.db.samples.insert_one(
            {
                "_id": "foo",
                "ready": True,
            }
        )

    if error != "404_cache":
        await client.db.caches.insert_one({"key": key, "sample": {"id": "test"}})
    if error != "404_reads":
        sample_reads_cache = SQLSampleReadsCache(
            id=1,
            sample="foo",
            name=filename,
            name_on_disk=filename,
            key="aodp-abcdefgh",
        )

        async with AsyncSession(pg) as session:
            session.add(sample_reads_cache)
            await session.commit()

    resp = await client.get(f"/samples/foo/caches/{key}/reads/{filename}")

    expected_path = (
        get_config_from_app(client.app).data_path / "caches" / key / filename
    )

    if error:
        assert resp.status == 404
    else:
        assert resp.status == 200
        assert expected_path.read_bytes() == await resp.content.read()


@pytest.mark.apitest
@pytest.mark.parametrize(
    "error", [None, "404_sample", "404_artifact", "404_file", "404_cache"]
)
async def test_download_artifact_cache(
    error, spawn_job_client, pg: AsyncEngine, tmp_path
):
    """
    Test that a sample artifact cache can be downloaded using the Jobs API.

    """
    client = await spawn_job_client(authorize=True)
    get_config_from_app(client.app).data_path = tmp_path

    key = "aodp-abcdefgh"
    name = "fastqc.txt"
    name_on_disk = "1-fastqc.txt"

    if error != "404_file":
        path = tmp_path / "caches" / key
        path.mkdir(parents=True)
        path.joinpath(name_on_disk).write_text("text")

    if error != "404_sample":
        await client.db.samples.insert_one(
            {
                "_id": "foo",
                "ready": True,
            }
        )

    if error != "404_artifact":
        sample_artfact_cache = SQLSampleArtifactCache(
            id=1,
            sample="foo",
            name=name,
            name_on_disk=name_on_disk,
            type="fastq",
            key="aodp-abcdefgh",
        )

        async with AsyncSession(pg) as session:
            session.add(sample_artfact_cache)

            await session.commit()

    if error != "404_cache":
        await client.db.caches.insert_one({"key": key, "sample": {"id": "test"}})

    resp = await client.get(f"/samples/foo/caches/{key}/artifacts/{name}")
    expected_path = (
        get_config_from_app(client.app).data_path / "caches" / key / name_on_disk
    )

    if error:
        assert resp.status == 404
    else:
        assert resp.status == 200
        assert expected_path.read_bytes() == await resp.content.read()


@pytest.mark.apitest
@pytest.mark.parametrize("field", ["quality", "not_quality"])
async def test_finalize_cache(field, resp_is, snapshot, spawn_job_client):
    client = await spawn_job_client(authorize=True)

    data = {field: {}}

    await client.db.samples.insert_one(
        {
            "_id": "test",
            "ready": True,
        }
    )

    await client.db.caches.insert_one(
        {"_id": "test", "key": "aodp-abcdefgh", "sample": {"id": "test"}}
    )

    resp = await client.patch("/samples/test/caches/aodp-abcdefgh", json=data)

    if field == "quality":
        assert resp.status == 200
        assert await resp.json() == snapshot
    else:
        assert resp.status == 422
        await resp_is.invalid_input(resp, {"quality": ["required field"]})
