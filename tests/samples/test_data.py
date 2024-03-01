import asyncio

import pytest
from aioredis import Redis
from sqlalchemy.ext.asyncio import AsyncEngine
from syrupy import SnapshotAssertion
from virtool_core.models.enums import Permission, LibraryType
from virtool_core.models.samples import WorkflowState

from tests.fixtures.client import ClientSpawner
from virtool.data.errors import ResourceConflictError

from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.mongo.core import Mongo

from virtool.samples.oas import CreateSampleRequest
from virtool.settings.oas import UpdateSettingsRequest
from virtool.users.oas import UpdateUserRequest

from virtool.pg.utils import get_row_by_id

from virtool.uploads.models import SQLUpload


@pytest.fixture
async def get_sample_ready_false(static_time, fake2, mongo):
    label = await fake2.labels.create()
    user = await fake2.users.create()
    job = await fake2.jobs.create(user, workflow="create_sample")

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
        }
    )


class TestCreate:
    @pytest.mark.parametrize(
        "group_setting", ["none", "users_primary_group", "force_choice"]
    )
    async def test_ok(
        self,
        group_setting: str,
        data_layer: DataLayer,
        pg: AsyncEngine,
        fake2: DataFaker,
        snapshot_recent,
        spawn_client: ClientSpawner,
        redis: Redis,
    ):
        client = await spawn_client(
            authenticated=True, permissions=[Permission.create_sample]
        )

        group = await fake2.groups.create()

        await data_layer.settings.update(
            UpdateSettingsRequest(
                sample_group=group_setting,
                sample_all_write=True,
                sample_group_write=True,
            )
        )
        await data_layer.users.update(
            client.user.id,
            UpdateUserRequest(groups=[*[g.id for g in client.user.groups], group.id]),
        )

        await data_layer.users.update(
            client.user.id,
            UpdateUserRequest(primary_group=group.id),
        )

        label = await fake2.labels.create()
        upload = await fake2.uploads.create(user=await fake2.users.create())

        await asyncio.gather(
            client.mongo.subtraction.insert_one({"_id": "apple", "name": "Apple"}),
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
            client.mongo.samples.find_one(),
            get_row_by_id(pg, SQLUpload, 1),
        )

        assert sample == snapshot_recent(name="mongo")
        assert await redis.lrange("jobs_create_sample", 0, -1) == snapshot_recent(
            name="jobs_create_sample"
        )


async def test_finalize(
    data_layer: DataLayer,
    get_sample_ready_false,
    mongo: Mongo,
    snapshot_recent: SnapshotAssertion,
    spawn_client: ClientSpawner,
    tmp_path,
):
    """
    Test that sample can be finalized
    """

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
