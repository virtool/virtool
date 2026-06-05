import asyncio
from collections.abc import AsyncIterator

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

import virtool.utils
from tests.fixtures.client import ClientSpawner
from virtool.analyses.sql import SQLAnalysis
from virtool.api.client import UserClient
from virtool.data.errors import ResourceConflictError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.models.enums import AnalysisWorkflow, LibraryType, Permission
from virtool.models.roles import AdministratorRole
from virtool.mongo.core import Mongo
from virtool.pg.utils import get_row, get_row_by_id
from virtool.samples.models import WorkflowState
from virtool.samples.oas import CreateAnalysisRequest, CreateSampleRequest
from virtool.samples.sql import SQLSampleReads
from virtool.samples.utils import SampleRight
from virtool.settings.oas import UpdateSettingsRequest
from virtool.storage.errors import StorageKeyNotFoundError
from virtool.storage.protocol import StorageBackend
from virtool.uploads.sql import SQLUpload, UploadType
from virtool.uploads.utils import upload_file_key
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
        assert upload.reserved is True

    async def test_already_reserved(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        spawn_client: ClientSpawner,
    ):
        """A reserved file cannot be used to create a sample."""
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_sample],
        )

        upload = await fake.uploads.create(
            user=await fake.users.create(),
            reserved=True,
        )

        with pytest.raises(ResourceConflictError, match=r"File is already reserved"):
            await data_layer.samples.create(
                CreateSampleRequest(files=[upload.id], name="Foobar"),
                client.user.id,
                0,
            )

        assert await mongo.samples.find_one() is None

    async def test_reservation_rolled_back_on_failure(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mocker,
        mongo: Mongo,
        pg: AsyncEngine,
        spawn_client: ClientSpawner,
    ):
        """A failed sample insert leaves no reserved upload and no sample behind."""
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_sample],
        )

        upload = await fake.uploads.create(user=await fake.users.create())

        mocker.patch.object(
            mongo.samples,
            "insert_one",
            side_effect=RuntimeError("boom"),
        )

        with pytest.raises(RuntimeError, match=r"boom"):
            await data_layer.samples.create(
                CreateSampleRequest(files=[upload.id], name="Foobar"),
                client.user.id,
                0,
            )

        row = await get_row_by_id(pg, SQLUpload, upload.id)
        assert row.reserved is False
        assert await mongo.samples.find_one() is None


async def test_finalize(
    data_layer: DataLayer,
    fake: DataFaker,
    get_sample_ready_false,
    memory_storage: StorageBackend,
    mongo: Mongo,
    pg: AsyncEngine,
    snapshot_recent: SnapshotAssertion,
    spawn_client: ClientSpawner,
):
    """Test that finalizing a sample deletes its upload files from storage."""
    upload = await fake.uploads.create(user=await fake.users.create())

    upload_row = await get_row_by_id(pg, SQLUpload, upload.id)
    upload_name_on_disk = upload_row.name_on_disk

    async with AsyncSession(pg) as session:
        session.add(
            SQLSampleReads(
                name="reads.fq.gz",
                name_on_disk="reads_1.fq.gz",
                sample="test",
                size=len(b"upload contents"),
                upload=upload.id,
                uploaded_at=virtool.utils.timestamp(),
            ),
        )

        await session.commit()

    async def _chunks() -> AsyncIterator[bytes]:
        yield b"upload contents"

    upload_key = upload_file_key(upload_name_on_disk)
    await memory_storage.write(upload_key, _chunks())

    assert await memory_storage.size(upload_key) == len(b"upload contents")

    quality = {
        "bases": [[1543]],
        "composition": [[6372]],
        "count": 7069,
        "encoding": "OuBQPPuwYimrxkNpPWUx",
        "gc": 34222440,
        "length": [3237],
        "sequences": [7091],
    }

    sample = await data_layer.samples.finalize("test", quality)

    assert sample.dict() == snapshot_recent()
    assert sample.quality == quality
    assert sample.ready is True

    with pytest.raises(StorageKeyNotFoundError):
        await memory_storage.size(upload_key)


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


class TestHasResourcesForAnalysisJob:
    @staticmethod
    async def _seed(
        fake: DataFaker,
        mongo: Mongo,
        *,
        archived: bool = False,
    ) -> str:
        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )

        _, _, subtraction = await asyncio.gather(
            mongo.references.insert_one(
                {
                    "_id": "test_ref",
                    "archived": archived,
                    "data_type": "genome",
                    "name": "Test Reference",
                },
            ),
            mongo.indexes.insert_one(
                {
                    "_id": "test_index",
                    "reference": {"id": "test_ref"},
                    "ready": True,
                    "version": 1,
                },
            ),
            fake.subtractions.create(user=user, upload=upload),
        )

        return subtraction.id

    async def test_ok(self, data_layer: DataLayer, fake: DataFaker, mongo: Mongo):
        subtraction_id = await self._seed(fake, mongo)

        assert (
            await data_layer.samples.has_resources_for_analysis_job(
                "test_ref",
                [subtraction_id],
            )
            is None
        )

    async def test_missing_reference(self, data_layer: DataLayer, mongo: Mongo):
        with pytest.raises(ResourceConflictError, match=r"Reference does not exist"):
            await data_layer.samples.has_resources_for_analysis_job(
                "test_ref",
                ["subtraction_1"],
            )

    async def test_archived_reference(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
    ):
        subtraction_id = await self._seed(fake, mongo, archived=True)

        with pytest.raises(ResourceConflictError, match=r"Reference is archived"):
            await data_layer.samples.has_resources_for_analysis_job(
                "test_ref",
                [subtraction_id],
            )

    async def test_missing_subtraction(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
    ):
        subtraction_id = await self._seed(fake, mongo)

        with pytest.raises(
            ResourceConflictError,
            match=r"^Subtractions do not exist: missing$",
        ):
            await data_layer.samples.has_resources_for_analysis_job(
                "test_ref",
                [subtraction_id, "missing"],
            )


class TestDelete:
    """Deleting a sample cascades to its analyses in both Mongo and Postgres."""

    async def _setup(self, fake: DataFaker, mongo: Mongo) -> str:
        user = await fake.users.create()

        await asyncio.gather(
            mongo.samples.insert_one(
                {
                    "_id": "test_sample",
                    "all_read": True,
                    "all_write": True,
                    "created_at": virtool.utils.timestamp(),
                    "files": [],
                    "format": "fastq",
                    "group": "none",
                    "group_read": True,
                    "group_write": True,
                    "hold": False,
                    "host": "",
                    "is_legacy": False,
                    "isolate": "",
                    "job": None,
                    "labels": [],
                    "library_type": LibraryType.normal.value,
                    "locale": "",
                    "name": "Test Sample",
                    "notes": "",
                    "nuvs": False,
                    "pathoscope": True,
                    "ready": True,
                    "subtractions": [],
                    "user": {"id": user.id},
                    "workflows": {
                        "aodp": WorkflowState.INCOMPATIBLE.value,
                        "pathoscope": WorkflowState.COMPLETE.value,
                        "nuvs": WorkflowState.PENDING.value,
                    },
                },
            ),
            mongo.indexes.insert_one(
                {
                    "_id": "test_index",
                    "version": 11,
                    "ready": True,
                    "reference": {"id": "test_ref"},
                },
            ),
            mongo.references.insert_one(
                {
                    "_id": "test_ref",
                    "archived": False,
                    "data_type": "genome",
                    "name": "Test Reference",
                },
            ),
        )

        return user.id

    async def test_deletes_analysis_pg_rows(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        memory_storage: StorageBackend,
        mongo: Mongo,
        pg: AsyncEngine,
    ):
        """Deleting a sample removes its analyses' Postgres rows."""
        user_id = await self._setup(fake, mongo)

        analysis = await data_layer.analyses.create(
            CreateAnalysisRequest(
                ml=None,
                ref_id="test_ref",
                subtractions=[],
                workflow=AnalysisWorkflow.nuvs,
            ),
            "test_sample",
            user_id,
            0,
        )

        await data_layer.analyses.finalize(analysis.id, {"hits": []})

        assert await get_row(pg, SQLAnalysis, ("id", analysis.id)) is not None

        await data_layer.samples.delete("test_sample")

        assert await get_row(pg, SQLAnalysis, ("id", analysis.id)) is None
