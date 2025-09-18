import asyncio
import gzip
import os
from http import HTTPStatus
from pathlib import Path

import arrow
import pytest
from aiohttp.test_utils import make_mocked_coro
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

from tests.fixtures.client import ClientSpawner, JobClientSpawner, VirtoolTestClient
from virtool.data.errors import ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.data.utils import get_data_from_app
from virtool.fake.next import DataFaker
from virtool.models.enums import LibraryType, Permission
from virtool.mongo.core import Mongo
from virtool.samples.fake import create_fake_sample
from virtool.samples.models import WorkflowState
from virtool.samples.sql import SQLSampleArtifact, SQLSampleReads
from virtool.settings.oas import UpdateSettingsRequest
from virtool.users.oas import UpdateUserRequest


class MockJobInterface:
    def __init__(self):
        self.enqueue = make_mocked_coro()


@pytest.fixture
async def get_sample_ready_false(fake: DataFaker, mongo: Mongo, static_time):
    label = await fake.labels.create()
    user = await fake.users.create()
    job = await fake.jobs.create(user, workflow="create_sample")

    await mongo.subtraction.insert_many(
        [
            {"_id": "apple", "name": "Apple"},
            {"_id": "pear", "name": "Pear"},
            {"_id": "peach", "name": "Peach"},
        ],
        session=None,
    )

    await mongo.samples.insert_one(
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
                },
            ],
            "format": "fastq",
            "group": "none",
            "group_read": True,
            "group_write": True,
            "hold": False,
            "host": "",
            "is_legacy": False,
            "isolate": "",
            "job": {"id": job.id},
            "labels": [label.id],
            "library_type": LibraryType.normal.value,
            "locale": "",
            "name": "Test",
            "notes": "",
            "nuvs": False,
            "pathoscope": True,
            "ready": False,
            "subtractions": ["apple", "pear"],
            "user": {"id": user.id},
            "workflows": {
                "aodp": WorkflowState.INCOMPATIBLE.value,
                "pathoscope": WorkflowState.COMPLETE.value,
                "nuvs": WorkflowState.PENDING.value,
            },
        },
    )


@pytest.fixture
async def get_sample_data(
    mongo: "Mongo",
    fake: DataFaker,
    pg: AsyncEngine,
    static_time,
):
    label = await fake.labels.create()
    user = await fake.users.create()
    job = await fake.jobs.create(user, workflow="create_sample")

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
                    },
                ],
                "format": "fastq",
                "group": "none",
                "group_read": True,
                "group_write": True,
                "hold": False,
                "host": "",
                "is_legacy": False,
                "isolate": "",
                "job": {"id": job.id},
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
            },
        ),
    )

    async with AsyncSession(pg) as session:
        session.add_all(
            [
                SQLSampleArtifact(
                    name="reference.fa.gz",
                    sample="test",
                    type="fasta",
                    name_on_disk="reference.fa.gz",
                    size=34879234,
                ),
                SQLSampleReads(
                    name="reads_1.fq.gz",
                    name_on_disk="reads_1.fq.gz",
                    sample="test",
                    size=2903109210,
                    uploaded_at=static_time.datetime,
                    upload=None,
                ),
            ],
        )
        await session.commit()

    return user.id


@pytest.fixture
async def find_samples_client(
    fake: DataFaker,
    mongo: Mongo,
    spawn_client: ClientSpawner,
    static_time,
):
    user_1 = await fake.users.create()
    user_2 = await fake.users.create()

    label_1 = await fake.labels.create()
    label_2 = await fake.labels.create()
    label_3 = await fake.labels.create()

    job = await fake.jobs.create(user_1, workflow="create_sample")

    client = await spawn_client(authenticated=True)

    await mongo.samples.insert_many(
        [
            {
                "_id": "beb1eb10",
                "all_read": True,
                "created_at": arrow.get(static_time.datetime).shift(hours=1).datetime,
                "foobar": True,
                "host": "",
                "isolate": "Thing",
                "job": {"id": job.id},
                "labels": [label_1.id, label_2.id],
                "library_type": "normal",
                "name": "16GVP042",
                "notes": "",
                "nuvs": True,
                "pathoscope": True,
                "ready": True,
                "user": {"id": user_1.id},
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
                "job": None,
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
                "created_at": arrow.get(static_time.datetime).shift(hours=2).datetime,
                "_id": "cb400e6d",
                "job": None,
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


class TestFind:
    @pytest.mark.parametrize("find", [None, "gv", "sp"])
    async def test_term(
        self,
        find: str | None,
        snapshot: SnapshotAssertion,
        find_samples_client: VirtoolTestClient,
    ):
        path = "/samples"

        if find is not None:
            path += f"?find={find}"

        resp = await find_samples_client.get(path)
        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot

    @pytest.mark.parametrize(("per_page", "page"), [(None, None), (2, 1), (2, 2)])
    async def test_page_per_page(
        self,
        page: int | None,
        per_page: int | None,
        snapshot: SnapshotAssertion,
        find_samples_client: VirtoolTestClient,
    ):
        query = []

        if per_page is not None:
            query.append(f"per_page={per_page}")

        path = "/samples"

        if page is not None:
            query.append(f"page={page}")
            path += f"?{'&'.join(query)}"

        resp = await find_samples_client.get(path)
        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot

    @pytest.mark.parametrize("labels", [None, [3], [2, 3], [0]])
    async def test_labels(
        self,
        labels: list[int] | None,
        snapshot: SnapshotAssertion,
        find_samples_client: VirtoolTestClient,
    ):
        path = "/samples"

        if labels is not None:
            query = "&label=".join(str(label) for label in labels)
            path += f"?label={query}"

        resp = await find_samples_client.get(path)
        assert resp.status == HTTPStatus.OK
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
    async def test_workflows(
        self,
        workflows: list[str] | None,
        snapshot: SnapshotAssertion,
        find_samples_client: VirtoolTestClient,
    ):
        path = "/samples"

        if workflows is not None:
            workflows_query = "&workflows=".join(workflow for workflow in workflows)
            path += f"?workflows={workflows_query}"

        resp = await find_samples_client.get(path)
        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot


class TestGet:
    async def test_administrator(
        self,
        get_sample_data,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
    ):
        """Test that a sample can be retrieved by an administrator."""
        client = await spawn_client(administrator=True, authenticated=True)

        resp = await client.get("/samples/test")

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot(name="resp")

    async def test_owner(
        self,
        get_sample_data,
        snapshot: SnapshotAssertion,
        mongo: Mongo,
        spawn_client: ClientSpawner,
    ):
        """Test that a sample can be retrieved by its owner."""
        client = await spawn_client(authenticated=True)

        await mongo.samples.update_one(
            {"_id": "test"},
            {
                "$set": {
                    "all_read": False,
                    "group_read": False,
                    "group": "none",
                    "user": {"id": client.user.id},
                },
            },
        )

        resp = await client.get("/samples/test")

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot(name="resp")

    async def test_all_read(
        self,
        fake: DataFaker,
        get_sample_data,
        snapshot: SnapshotAssertion,
        mongo: Mongo,
        spawn_client: ClientSpawner,
    ):
        """Test that a sample can be retrieved any user when ``all_read`` is ``True`` on
        the sample.
        """
        client = await spawn_client(authenticated=True)

        user = await fake.users.create()

        await mongo.samples.update_one(
            {"_id": "test"},
            {
                "$set": {
                    "all_read": True,
                    "group_read": False,
                    "group": "none",
                    "user": {"id": user.id},
                },
            },
        )

        resp = await client.get("/samples/test")

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot(name="resp")

    @pytest.mark.parametrize("is_member", [True, False])
    async def test_group_read(
        self,
        is_member: bool,
        fake: DataFaker,
        get_sample_data,
        mongo: Mongo,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
    ):
        """Test that a sample can be retrieved by the client user when they are a member
        the sample's ``group`` and ``group_read`` is ``True``.
        """
        client = await spawn_client(authenticated=True)

        group = await fake.groups.create()
        user = await fake.users.create()

        if is_member:
            await get_data_from_app(client.app).users.update(
                client.user.id,
                UpdateUserRequest(groups=[group.id]),
            )

        await mongo.samples.update_one(
            {"_id": "test"},
            {
                "$set": {
                    "all_read": False,
                    "all_write": False,
                    "group_read": True,
                    "group": group.id,
                    "user": {"id": user.id},
                },
            },
        )

        resp = await client.get("/samples/test")

        assert resp.status == (200 if is_member else 403)
        assert await resp.json() == snapshot(name="resp")


class TestCreate:
    @pytest.mark.parametrize(
        "group_setting",
        ["none", "users_primary_group", "force_choice"],
    )
    async def test_ok(
        self,
        group_setting: str,
        data_layer: DataLayer,
        fake: DataFaker,
        snapshot_recent,
        mongo: Mongo,
        spawn_client: ClientSpawner,
    ):
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_sample],
        )

        group = await fake.groups.create()

        await data_layer.settings.update(
            UpdateSettingsRequest(
                sample_group=group_setting,
                sample_all_write=True,
                sample_group_write=True,
            ),
        )

        await data_layer.users.update(
            client.user.id,
            UpdateUserRequest(groups=[*[g.id for g in client.user.groups], group.id]),
        )

        await data_layer.users.update(
            client.user.id,
            UpdateUserRequest(primary_group=group.id),
        )

        label = await fake.labels.create()
        upload = await fake.uploads.create(user=await fake.users.create())

        await mongo.subtraction.insert_one({"_id": "apple", "name": "Apple"})

        data = {
            "files": [upload.id],
            "labels": [label.id],
            "name": "Foobar",
            "subtractions": ["apple"],
        }

        if group_setting == "force_choice":
            data["group"] = group.id

        resp = await client.post("/samples", data)

        assert resp.status == 201
        assert await resp.json() == snapshot_recent(name="resp")

    async def test_name_exists(
        self,
        fake: DataFaker,
        snapshot,
        mongo: Mongo,
        spawn_client: ClientSpawner,
        static_time,
    ):
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_sample],
        )

        upload = await fake.uploads.create(user=await fake.users.create())

        await asyncio.gather(
            mongo.samples.insert_one(
                {
                    "_id": "foobar",
                    "name": "Foobar",
                    "lower_name": "foobar",
                    "created_at": static_time.datetime,
                    "nuvs": False,
                    "pathoscope": False,
                    "ready": True,
                },
            ),
            mongo.subtraction.insert_one({"_id": "apple", "name": "Apple"}),
        )

        resp = await client.post(
            "/samples",
            {"name": "Foobar", "files": [upload.id], "subtractions": ["apple"]},
        )

        assert resp.status == 400
        assert await resp.json() == snapshot(name="json")

    @pytest.mark.parametrize("error", [None, "400"])
    async def test_force_choice(
        self,
        error: str | None,
        fake: DataFaker,
        resp_is,
        mongo: Mongo,
        spawn_client: ClientSpawner,
    ):
        """Test that when ``force_choice`` is enabled, a request with no group field passed
        results in an error response, that "" is accepted as a valid user group and
        that valid user groups are accepted as expected

        """
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_sample],
        )

        group = await fake.groups.create()

        upload = await fake.uploads.create(user=await fake.users.create())

        await asyncio.gather(
            get_data_from_app(client.app).settings.update(
                UpdateSettingsRequest(sample_group="force_choice"),
            ),
            mongo.subtraction.insert_one({"_id": "apple", "name": "Apple"}),
        )

        data = {
            "name": "Foobar",
            "files": [upload.id],
            "subtractions": ["apple"],
        }

        if error is None:
            data["group"] = group.id
            resp = await client.post("/samples", data)
            assert resp.status == 201
        else:
            resp = await client.post("/samples", data)
            await resp_is.bad_request(resp, "Group value required for sample creation")

    async def test_group_dne(
        self,
        fake: DataFaker,
        resp_is,
        mongo: Mongo,
        spawn_client: ClientSpawner,
    ):
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_sample],
        )

        await get_data_from_app(client.app).settings.update(
            UpdateSettingsRequest(sample_group="force_choice"),
        )

        upload = await fake.uploads.create(user=await fake.users.create())

        await asyncio.gather(
            get_data_from_app(client.app).settings.update(
                UpdateSettingsRequest(
                    sample_group="force_choice",
                ),
            ),
            mongo.subtraction.insert_one({"_id": "apple", "name": "Apple"}),
        )

        resp = await client.post(
            "/samples",
            {
                "name": "Foobar",
                "files": [upload.id],
                "subtractions": ["apple"],
                "group": 5,
            },
        )

        await resp_is.bad_request(resp, "Group does not exist")

    async def test_subtraction_dne(
        self,
        fake: DataFaker,
        resp_is,
        spawn_client: ClientSpawner,
    ):
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_sample],
        )

        upload = await fake.uploads.create(user=await fake.users.create())

        resp = await client.post(
            "/samples",
            {"name": "Foobar", "files": [upload.id], "subtractions": ["apple"]},
        )

        await resp_is.bad_request(resp, "Subtractions do not exist: apple")

    @pytest.mark.parametrize("one_exists", [True, False])
    async def test_file_dne(
        self,
        one_exists: bool,
        fake: DataFaker,
        mongo: Mongo,
        spawn_client: ClientSpawner,
        resp_is,
    ):
        """Test that a ``404`` is returned if one or more of the file ids passed in
        ``files`` do not exist.

        """
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_sample],
        )

        await mongo.subtraction.insert_one(
            {
                "_id": "apple",
            },
        )

        if one_exists:
            upload = await fake.uploads.create(user=await fake.users.create())
            files = [upload.id, 21]
        else:
            files = [20, 21]

        resp = await client.post(
            "/samples",
            {"name": "Foobar", "files": files, "subtractions": ["apple"]},
        )

        await resp_is.bad_request(resp, "File does not exist")

    async def test_label_dne(
        self,
        fake: DataFaker,
        resp_is,
        spawn_client: ClientSpawner,
    ):
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_sample],
        )

        upload = await fake.uploads.create(user=await fake.users.create())

        resp = await client.post(
            "/samples",
            {"name": "Foobar", "files": [upload.id], "labels": [1]},
        )

        await resp_is.bad_request(resp, "Labels do not exist: [1]")


class TestEdit:
    async def test_ok(self, get_sample_data, snapshot, spawn_client: ClientSpawner):
        """Test that an existing sample can be edited correctly."""
        client = await spawn_client(administrator=True, authenticated=True)

        resp = await client.patch(
            "/samples/test",
            {
                "name": "test_sample",
                "subtractions": ["peach"],
                "labels": [1],
                "notes": "This is a test.",
            },
        )

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot

    async def test_name_exists(
        self,
        resp_is,
        mongo: Mongo,
        spawn_client: ClientSpawner,
    ):
        """Test that a ``bad_request`` is returned if the sample name passed in ``name``
        already exists.
        """
        client = await spawn_client(administrator=True, authenticated=True)

        await mongo.samples.insert_many(
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
        mongo: Mongo,
        spawn_client: ClientSpawner,
    ):
        """Test that a ``bad_request`` is returned if the label passed in ``labels`` does
        not exist.

        """
        client = await spawn_client(administrator=True, authenticated=True)

        await mongo.samples.insert_one(
            {
                "_id": "foo",
                "name": "Foo",
                "all_read": True,
                "all_write": True,
                "subtractions": [],
                "user": {"id": "test"},
                "labels": [2, 3],
                "ready": True,
            },
        )

        resp = await client.patch("/samples/foo", {"labels": [1]})

        assert resp.status == 400
        assert await resp.json() == snapshot(name="json")

    async def test_subtraction_exists(
        self,
        fake: DataFaker,
        snapshot,
        mongo: Mongo,
        spawn_client: ClientSpawner,
    ):
        """Test that a ``bad_request`` is returned if the subtraction passed in
        ``subtractions`` does not exist.

        """
        client = await spawn_client(administrator=True, authenticated=True)

        user = await fake.users.create()

        await asyncio.gather(
            mongo.samples.insert_one(
                {
                    "_id": "test",
                    "name": "Test",
                    "all_read": True,
                    "all_write": True,
                    "ready": True,
                    "subtractions": ["apple"],
                    "user": {"id": user.id},
                },
            ),
            mongo.subtraction.insert_one({"_id": "foo", "name": "Foo"}),
        )

        resp = await client.patch("/samples/test", {"subtractions": ["foo", "bar"]})

        assert resp.status == 400
        assert await resp.json() == snapshot(name="json")


@pytest.mark.parametrize("field", ["quality", "not_quality"])
async def test_finalize(
    field: str,
    snapshot,
    resp_is,
    spawn_job_client,
    tmp_path,
    get_sample_ready_false,
):
    """Test that sample can be finalized using the Jobs API."""
    client = await spawn_job_client(authenticated=True)

    json = {
        field: {
            "bases": [[1543]],
            "composition": [[6372]],
            "count": 7069,
            "encoding": "OuBQPPuwYimrxkNpPWUx",
            "gc": 34222440,
            "length": [3237],
            "sequences": [7091],
        },
    }

    resp = await client.patch("/samples/test", json=json)

    if field == "quality":
        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot

        with pytest.raises(ResourceNotFoundError):
            await get_data_from_app(client.app).uploads.get(1)

        resp = await client.patch("/samples/test", json=json)
        assert resp.status == 500
    else:
        assert resp.status == 422
        await resp_is.invalid_input(resp, {"quality": ["required field"]})


class TestDelete:
    @pytest.mark.parametrize("finalized", [True, False])
    async def test_ok(
        self,
        data_path: Path,
        finalized: bool,
        fake: DataFaker,
        spawn_client: ClientSpawner,
        tmp_path: Path,
    ):
        client = await spawn_client(authenticated=True)

        (data_path / "samples/test").mkdir(parents=True)

        user = await fake.users.create()

        await create_fake_sample(client.app, "test", user.id, finalized=finalized)

        resp = await client.delete("/samples/test")

        assert resp.status == 204 if finalized else 400

    @pytest.mark.parametrize("finalized", [True, False])
    async def test_from_job(
        self,
        finalized: bool,
        data_path: Path,
        fake: DataFaker,
        spawn_job_client,
    ):
        """Test that job client can delete a sample only when it is unfinalized."""
        client = await spawn_job_client(authenticated=True)

        (data_path / "samples/test").mkdir(parents=True)

        user = await fake.users.create()

        await create_fake_sample(client.app, "test", user.id, finalized=finalized)

        resp = await client.delete("/samples/test")

        if finalized:
            assert resp.status == 400
        else:
            assert resp.status == 204

    async def test_not_found(self, spawn_client: ClientSpawner):
        client = await spawn_client(authenticated=True)
        resp = await client.delete("/samples/test")
        assert resp.status == 404

    async def test_not_found_from_job(self, spawn_job_client):
        client = await spawn_job_client(authenticated=True)
        resp = await client.delete("/samples/test")
        assert resp.status == 404


async def test_find_analyses(
    fake: DataFaker,
    snapshot: SnapshotAssertion,
    mongo: Mongo,
    spawn_client: ClientSpawner,
    static_time,
):
    client = await spawn_client(authenticated=True)

    user_1 = await fake.users.create()
    user_2 = await fake.users.create()

    job = await fake.jobs.create(user=user_1)

    await mongo.samples.insert_one(
        {
            "_id": "test",
            "created_at": static_time.datetime,
            "all_read": True,
            "all_write": True,
            "group": "none",
            "group_read": True,
            "group_write": True,
            "ready": True,
            "user": {"id": user_1.id},
        },
    )

    await asyncio.gather(
        mongo.subtraction.insert_one(
            {"_id": "foo", "name": "Malus domestica", "nickname": "Apple"},
        ),
        mongo.references.insert_many(
            [
                {"_id": "foo", "data_type": "genome", "name": "Foo"},
                {"_id": "baz", "data_type": "genome", "name": "Baz"},
            ],
            session=None,
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
                {
                    "_id": "test_4",
                    "workflow": "pathoscope_bowtie",
                    "created_at": static_time.datetime,
                    "ready": True,
                    "job": None,
                    "index": {"version": 2, "id": "foo"},
                    "reference": {"id": "foo", "name": "Foo"},
                    "sample": {"id": "test-not-found"},
                    "subtractions": ["foo"],
                    "user": {"id": user_2.id},
                    "foobar": False,
                },
            ],
            session=None,
        ),
    )

    resp = await client.get("/samples/test/analyses")

    assert resp.status == HTTPStatus.OK
    assert await resp.json() == snapshot


@pytest.mark.parametrize(
    "error",
    [None, "400_reference", "400_index", "400_ready_index", "400_subtraction", "404"],
)
async def test_analyze(
    error: str | None,
    mocker,
    mongo: Mongo,
    resp_is,
    snapshot: SnapshotAssertion,
    spawn_client: ClientSpawner,
    static_time,
):
    mocker.patch("virtool.samples.utils.get_sample_rights", return_value=(True, True))

    client = await spawn_client(authenticated=True)
    client.app["jobs"] = MockJobInterface()

    if error != "400_reference":
        await mongo.references.insert_one(
            {
                "_id": "test_ref",
                "name": "Test Reference",
                "data_type": "genome",
            },
        )

    if error != "400_index":
        await mongo.indexes.insert_one(
            {
                "_id": "test",
                "reference": {"id": "test_ref"},
                "ready": error != "400_ready_index",
                "version": 4,
            },
        )

    if error != "400_subtraction":
        await mongo.subtraction.insert_one(
            {"_id": "subtraction_1", "name": "Subtraction 1"},
        )

    if error != "404":
        await mongo.samples.insert_one(
            {
                "_id": "test",
                "name": "Test",
                "created_at": static_time.datetime,
                "all_read": True,
                "all_write": True,
                "ready": True,
            },
        )

    resp = await client.post(
        "/samples/test/analyses",
        data={
            "workflow": "pathoscope_bowtie",
            "ref_id": "test_ref",
            "subtractions": [
                "subtraction_1",
            ],
        },
    )

    match error:
        case None:
            assert resp.status == 201
            assert resp.headers["Location"] == "/analyses/bf1b993c"
            assert await resp.json() == snapshot
        case "400_reference":
            await resp_is.bad_request(resp, "Reference does not exist")
        case ("400_index", "400_ready_index"):
            await resp_is.bad_request(resp, "No ready index")
        case "400_subtraction":
            await resp_is.bad_request(resp, "Subtractions do not exist: subtraction_1")
        case "404":
            await resp_is.not_found(resp)


@pytest.mark.parametrize("error", [None, 400, 409])
async def test_upload_artifact(
    error: int | None,
    data_path: Path,
    example_path: Path,
    mongo: Mongo,
    resp_is,
    snapshot: SnapshotAssertion,
    spawn_job_client: JobClientSpawner,
    static_time,
):
    """Test that new artifacts can be uploaded after sample creation using the Jobs API."""
    path = example_path / "sample" / "reads_1.fq.gz"

    client = await spawn_job_client(authenticated=True)

    sample_file_path = data_path / "samples" / "test"

    await mongo.samples.insert_one(
        {
            "_id": "test",
            "ready": True,
        },
    )

    artifact_type = "fastq" if error != 400 else "foo"

    data = {"file": open(path, "rb")}

    resp = await client.post(
        f"/samples/test/artifacts?name=small.fq.gz&type={artifact_type}",
        data=data,
    )

    if error == 409:
        resp_2 = await client.post(
            f"/samples/test/artifacts?name=small.fq.gz&type={artifact_type}",
            data={**data, "file": open(path, "rb")},
        )

        await resp_is.conflict(
            resp_2,
            "Artifact file has already been uploaded for this sample",
        )

    if not error:
        assert resp.status == 201
        assert await resp.json() == snapshot
        assert os.listdir(sample_file_path) == ["small.fq.gz"]
    elif error == 400:
        await resp_is.bad_request(resp, "Unsupported sample artifact type")


class TestUploadReads:
    async def test(
        self,
        data_path: Path,
        example_path: Path,
        mongo: Mongo,
        snapshot: SnapshotAssertion,
        spawn_job_client: JobClientSpawner,
    ):
        """Test that paired sample reads can be uploaded using the Jobs API and that
        conflicts are properly handled.
        """
        client = await spawn_job_client(authenticated=True)

        await mongo.samples.insert_one(
            {
                "_id": "test",
                "ready": True,
            },
        )

        resp_1 = await client.put(
            "/samples/test/reads/reads_1.fq.gz",
            data={"file": open(example_path / "sample" / "reads_1.fq.gz", "rb")},
        )

        assert resp_1.status == 201

        resp_2 = await client.put(
            "/samples/test/reads/reads_2.fq.gz",
            data={"file": open(example_path / "sample" / "reads_2.fq.gz", "rb")},
        )

        assert resp_2.status == 201

        resp_3 = await client.put(
            "/samples/test/reads/reads_2.fq.gz",
            data={"file": open(example_path / "sample" / "reads_2.fq.gz", "rb")},
        )

        assert resp_3.status == 409
        assert await resp_3.json() == snapshot(name="409")

        assert set(os.listdir(data_path / "samples" / "test")) == {
            "reads_1.fq.gz",
            "reads_2.fq.gz",
        }

    async def test_uncompressed(
        self,
        example_path: Path,
        fake: DataFaker,
        mongo: Mongo,
        snapshot: SnapshotAssertion,
        spawn_job_client: JobClientSpawner,
    ):
        """Test that uncompressed sample reads are rejected."""
        client = await spawn_job_client(authenticated=True)

        await mongo.samples.insert_one(
            {
                "_id": "test",
                "ready": True,
            },
        )

        upload = await fake.uploads.create(user=await fake.users.create())

        resp = await client.put(
            f"/samples/test/reads/reads_1.fq.gz?upload={upload.id}",
            data={
                "file": gzip.open(example_path / "sample" / "reads_1.fq.gz", "rb"),
            },
        )

        assert resp.status == 400
        assert await resp.json() == snapshot


@pytest.mark.parametrize("suffix", ["1", "2"])
@pytest.mark.parametrize("error", [None, "404_sample", "404_reads", "404_file"])
async def test_download_reads(
    suffix: str,
    error: str | None,
    data_path: Path,
    mongo: Mongo,
    pg: AsyncEngine,
    spawn_client: ClientSpawner,
    spawn_job_client: JobClientSpawner,
):
    client = await spawn_client(authenticated=True)
    job_client = await spawn_job_client(authenticated=True)

    file_name = f"reads_{suffix}.fq.gz"

    if error != "404_file":
        path = data_path / "samples" / "foo"
        path.mkdir(parents=True)
        path.joinpath(file_name).write_text("test")

    if error != "404_sample":
        await mongo.samples.insert_one(
            {
                "_id": "foo",
                "ready": True,
            },
        )

    if error != "404_reads":
        async with AsyncSession(pg) as session:
            session.add(
                SQLSampleReads(
                    id=1,
                    sample="foo",
                    name=file_name,
                    name_on_disk=file_name,
                ),
            )
            await session.commit()

    resp = await client.get(f"/samples/foo/reads/{file_name}")
    job_resp = await job_client.get(f"/samples/foo/reads/{file_name}")

    if error:
        assert resp.status == job_resp.status == 404
    else:
        assert resp.status == job_resp.status == HTTPStatus.OK
        assert (
            (data_path / "samples" / "foo" / file_name).read_bytes()
            == await resp.content.read()
            == await job_resp.content.read()
        )


@pytest.mark.parametrize("error", [None, "404_sample", "404_artifact", "404_file"])
async def test_download_artifact(
    error: str | None,
    data_path: Path,
    mongo: Mongo,
    pg: AsyncEngine,
    spawn_job_client: JobClientSpawner,
):
    client = await spawn_job_client(authenticated=True)

    if error != "404_file":
        path = data_path / "samples" / "foo"
        path.mkdir(parents=True)
        path.joinpath("fastqc.txt").write_text("test")

    if error != "404_sample":
        await mongo.samples.insert_one(
            {
                "_id": "foo",
                "ready": True,
            },
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
                ),
            )

            await session.commit()

    resp = await client.get("/samples/foo/artifacts/fastqc.txt")

    if error:
        assert resp.status == 404
        return

    assert resp.status == HTTPStatus.OK
    assert (
        data_path / "samples" / "foo" / "fastqc.txt"
    ).read_bytes() == await resp.content.read()


class TestChangeSampleRights:
    async def test_update_group_id(
        self,
        fake: DataFaker,
        get_sample_data,
        mongo: Mongo,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
    ):
        group = await fake.groups.create()

        client = await spawn_client(administrator=True, authenticated=True)
        resp = await client.patch("/samples/test/rights", data={"group": group.id})

        assert await resp.json() == snapshot(name="resp")
        assert await mongo.samples.find_one("test") == snapshot(name="mongo")

    async def test_set_none_group_id(
        self,
        get_sample_data,
        fake: DataFaker,
        mongo: Mongo,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
    ):
        await mongo.samples.find_one_and_update(
            {"_id": "test"},
            {"$set": {"group": "fake_group"}},
        )

        client = await spawn_client(administrator=True, authenticated=True)

        resp = await client.patch(
            "/samples/test/rights",
            data={
                "group": "none",
            },
        )

        assert await resp.json() == snapshot(name="resp")
        assert await mongo.samples.find_one("test") == snapshot(name="mongo")

    async def test_update_group_rights(
        self,
        get_sample_data,
        mongo: Mongo,
        snapshot,
        spawn_client,
    ):
        client = await spawn_client(administrator=True, authenticated=True)
        resp = await client.patch(
            "/samples/test/rights",
            data={"group_read": False, "group_write": False},
        )

        assert await resp.json() == snapshot(name="resp")
        assert await mongo.samples.find_one("test") == snapshot(name="mongo")

    async def test_update_all_user_rights(
        self,
        get_sample_data,
        mongo: Mongo,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
    ):
        client = await spawn_client(administrator=True, authenticated=True)
        resp = await client.patch(
            "/samples/test/rights",
            data={"all_read": False, "all_write": False},
        )

        assert await resp.json() == snapshot(name="resp")
        assert await mongo.samples.find_one("test") == snapshot(name="mongo")

    async def test_update_all_rights(
        self,
        get_sample_data,
        fake: DataFaker,
        mongo: Mongo,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
    ):
        group = await fake.groups.create()

        client = await spawn_client(administrator=True, authenticated=True)
        resp = await client.patch(
            "/samples/test/rights",
            data={
                "group": group.id,
                "group_read": False,
                "group_write": False,
                "all_read": False,
                "all_write": False,
            },
        )

        assert await resp.json() == snapshot(name="resp")
        assert await mongo.samples.find_one("test") == snapshot(name="mongo")
