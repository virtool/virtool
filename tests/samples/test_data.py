import asyncio

import pytest
from aioredis import Redis
from sqlalchemy.ext.asyncio import AsyncEngine
from virtool_core.models.enums import Permission

from tests.fixtures.client import ClientSpawner
from tests.samples.test_api import get_sample_data
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.samples.oas import CreateSampleRequest
from virtool.settings.oas import UpdateSettingsRequest
from virtool.subtractions.db import lookup_nested_subtractions
from virtool.users.oas import UpdateUserRequest

from virtool.pg.utils import get_row_by_id

from virtool.uploads.models import SQLUpload

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
    snapshot_recent,
    tmp_path,
    spawn_client: ClientSpawner,
    get_sample_data,
):
    """
    Test that sample can be finalized
    """
    client = await spawn_client(
        authenticated=True, permissions=[Permission.create_sample]
    )

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

    assert (
        await client.mongo.samples.aggregate(
            [
                {"$match": {"_id": "test"}},
                *lookup_nested_subtractions(local_field="subtractions"),
            ]
        ).to_list(length=1)
        == snapshot_recent()
    )

    assert sample.quality == quality
    assert sample.ready is True
