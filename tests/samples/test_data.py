import asyncio

import pytest
from aioredis import Redis
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from virtool_core.models.enums import LibraryType, Permission
from virtool_core.models.samples import WorkflowState

from tests.fixtures.client import ClientSpawner
from virtool.settings.oas import UpdateSettingsRequest
from virtool.users.oas import UpdateUserRequest
from virtool.data.layer import DataLayer
from virtool.data.utils import get_data_from_app
from virtool.fake.next import DataFaker
from virtool.jobs.client import JobsClient
from virtool.pg.utils import get_row_by_id
from virtool.samples.models import SQLSampleArtifact, SQLSampleReads
from virtool.uploads.models import SQLUpload


@pytest.fixture
async def get_sample_data(
    mongo: "Mongo", fake2: DataFaker, pg: AsyncEngine, static_time
):
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
                "quality": None,
            }
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
                ),
                SQLSampleReads(
                    name="reads_1.fq.gz",
                    name_on_disk="reads_1.fq.gz",
                    sample="test",
                    size=2903109210,
                    uploaded_at=static_time.datetime,
                    upload=None,
                ),
            ]
        )
        await session.commit()

    return user.id


@pytest.mark.apitest
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

        jobs_client = JobsClient(redis)
        get_data_from_app(client.app).jobs._client = jobs_client
        get_data_from_app(client.app).samples.jobs_client = jobs_client

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

        await client.post("/samples", data)

        sample, upload = await asyncio.gather(
            client.mongo.samples.find_one(),
            get_row_by_id(pg, SQLUpload, 1),
        )

        assert sample == snapshot_recent(name="mongo")
        assert await redis.lrange("jobs_create_sample", 0, -1) == [b"bf1b993c"]


@pytest.mark.datatest
async def test_finalize(
    data_layer: DataLayer,
    snapshot,
    tmp_path,
    get_sample_data,
):
    """
    Test that sample can be finalized
    """
    assert (
        await data_layer.samples.finalize(
            "test",
            {
                "bases": [[1543]],
                "composition": [[6372]],
                "count": 7069,
                "encoding": "OuBQPPuwYimrxkNpPWUx",
                "gc": 34222440,
                "length": [3237],
                "sequences": [7091],
            },
        )
    ).dict() == snapshot()
    sample = await data_layer.samples.get("test")
    assert sample.ready is True
