import asyncio

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine
from syrupy import SnapshotAssertion

from tests.fixtures.client import ClientSpawner
from virtool.api.client import UserClient
from virtool.data.errors import ResourceConflictError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.models.enums import LibraryType, Permission
from virtool.models.roles import AdministratorRole
from virtool.mongo.core import Mongo
from virtool.pg.utils import get_row_by_id
from virtool.redis import Redis
from virtool.samples.models import WorkflowState
from virtool.samples.oas import CreateSampleRequest
from virtool.samples.utils import SampleRight
from virtool.settings.oas import UpdateSettingsRequest
from virtool.uploads.sql import SQLUpload
from virtool.users.oas import UpdateUserRequest


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
        pg: AsyncEngine,
        mongo: Mongo,
        snapshot_recent,
        spawn_client: ClientSpawner,
        redis: Redis,
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

        await asyncio.gather(
            mongo.subtraction.insert_one({"_id": "apple", "name": "Apple"}),
        )

        data = {
            "files": [upload.id],
            "labels": [label.id],
            "name": "Foobar",
            "subtractions": ["apple"],
        }

        if group_setting == "force_choice":
            data["group"] = group.id

        await data_layer.samples.create(CreateSampleRequest(**data), client.user.id, 0)

        sample, upload = await asyncio.gather(
            mongo.samples.find_one(),
            get_row_by_id(pg, SQLUpload, 1),
        )

        assert sample == snapshot_recent(name="mongo")
        assert await redis.lrange("jobs_create_sample", 0, -1) == snapshot_recent(
            name="jobs_create_sample",
        )


async def test_finalize(
    data_layer: DataLayer,
    get_sample_ready_false,
    mongo: Mongo,
    snapshot_recent: SnapshotAssertion,
    spawn_client: ClientSpawner,
    tmp_path,
):
    """Test that sample can be finalized"""
    quality = {
        "bases": [[1543]],
        "composition": [[6372]],
        "count": 7069,
        "encoding": "OuBQPPuwYimrxkNpPWUx",
        "gc": 34222440,
        "length": [3237],
        "sequences": [7091],
    }

    assert (
        await data_layer.samples.finalize(
            "test",
            quality,
        )
    ).dict() == snapshot_recent()

    sample = await data_layer.samples.get("test")

    assert sample.quality == quality
    assert sample.ready is True


async def test_finalized_already(get_sample_ready_false, data_layer):
    quality = {
        "bases": [[1543]],
        "composition": [[6372]],
        "count": 7069,
        "encoding": "OuBQPPuwYimrxkNpPWUx",
        "gc": 34222440,
        "length": [3237],
        "sequences": [7091],
    }

    await data_layer.samples.finalize("test", quality)

    with pytest.raises(ResourceConflictError, match=r"Sample already finalized"):
        await data_layer.samples.finalize("test", quality)


class TestHasRight:
    async def test_ok(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
    ):
        """Test group member can write when group_write is True."""
        group = await fake.groups.create()
        user = await fake.users.create(groups=[group])
        sample_owner = await fake.users.create()

        client = UserClient(
            administrator_role=user.administrator_role,
            authenticated=True,
            force_reset=False,
            groups=[group.id for group in user.groups],
            permissions=user.permissions.dict(),
            user_id=user.id,
        )

        await mongo.samples.insert_one(
            {
                "_id": "sample_1",
                "all_read": False,
                "all_write": False,
                "group": group.id,
                "group_read": True,
                "group_write": True,
                "user": {"id": sample_owner.id},
            }
        )

        assert await data_layer.samples.has_right("sample_1", client, SampleRight.write)

    async def test_read_permission(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
    ):
        """Test group member can read when group_read is True."""
        group = await fake.groups.create()
        user = await fake.users.create(groups=[group])
        sample_owner = await fake.users.create()

        client = UserClient(
            administrator_role=user.administrator_role,
            authenticated=True,
            force_reset=False,
            groups=[group.id for group in user.groups],
            permissions=user.permissions.dict(),
            user_id=user.id,
        )

        await mongo.samples.insert_one(
            {
                "_id": "sample_2",
                "all_read": False,
                "all_write": False,
                "group": group.id,
                "group_read": True,
                "group_write": False,
                "user": {"id": sample_owner.id},
            }
        )

        assert await data_layer.samples.has_right("sample_2", client, SampleRight.read)

    async def test_missing_sample(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        """Test returns True when sample doesn't exist."""
        user = await fake.users.create()

        client = UserClient(
            administrator_role=user.administrator_role,
            authenticated=True,
            force_reset=False,
            groups=[group.id for group in user.groups],
            permissions=user.permissions.dict(),
            user_id=user.id,
        )

        assert await data_layer.samples.has_right(
            "nonexistent",
            client,
            SampleRight.write,
        )

    async def test_admin_full_access(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
    ):
        """Test full administrator has access regardless of permissions."""
        user = await fake.users.create(administrator_role=AdministratorRole.FULL)
        sample_owner = await fake.users.create()

        client = UserClient(
            administrator_role=AdministratorRole.FULL,
            authenticated=True,
            force_reset=False,
            groups=[group.id for group in user.groups],
            permissions=user.permissions.dict(),
            user_id=user.id,
        )

        await mongo.samples.insert_one(
            {
                "_id": "sample_3",
                "all_read": False,
                "all_write": False,
                "group": "none",
                "group_read": False,
                "group_write": False,
                "user": {"id": sample_owner.id},
            }
        )

        assert await data_layer.samples.has_right("sample_3", client, SampleRight.write)

    async def test_owner_full_access(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
    ):
        """Test sample owner has full access."""
        user = await fake.users.create()

        client = UserClient(
            administrator_role=user.administrator_role,
            authenticated=True,
            force_reset=False,
            groups=[group.id for group in user.groups],
            permissions=user.permissions.dict(),
            user_id=user.id,
        )

        await mongo.samples.insert_one(
            {
                "_id": "sample_4",
                "all_read": False,
                "all_write": False,
                "group": "none",
                "group_read": False,
                "group_write": False,
                "user": {"id": user.id},
            }
        )

        assert await data_layer.samples.has_right("sample_4", client, SampleRight.write)

    async def test_non_group_member_denied(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
    ):
        """Test non-group member is denied when all_write is False."""
        group = await fake.groups.create()
        user = await fake.users.create()
        sample_owner = await fake.users.create()

        client = UserClient(
            administrator_role=user.administrator_role,
            authenticated=True,
            force_reset=False,
            groups=[group.id for group in user.groups],
            permissions=user.permissions.dict(),
            user_id=user.id,
        )

        await mongo.samples.insert_one(
            {
                "_id": "sample_5",
                "all_read": False,
                "all_write": False,
                "group": group.id,
                "group_read": False,
                "group_write": True,
                "user": {"id": sample_owner.id},
            }
        )

        assert not await data_layer.samples.has_right(
            "sample_5",
            client,
            SampleRight.write,
        )
