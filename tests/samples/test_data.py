import asyncio
from collections.abc import AsyncIterator
from datetime import timedelta

import pytest
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

import virtool.utils
from tests.fixtures.client import ClientSpawner
from virtool.analyses.sql import SQLAnalysis
from virtool.api.client import UserClient
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.models.enums import AnalysisWorkflow, LibraryType, Permission
from virtool.models.roles import AdministratorRole
from virtool.mongo.core import Mongo
from virtool.pg.utils import get_row, get_row_by_id
from virtool.samples.models import WorkflowState
from virtool.samples.oas import (
    CreateAnalysisRequest,
    CreateSampleRequest,
    UpdateSampleRequest,
)
from virtool.samples.sql import (
    SQLLegacySample,
    SQLLegacySampleLabel,
    SQLLegacySampleSubtraction,
    SQLSampleReads,
)
from virtool.samples.utils import SampleRight
from virtool.settings.oas import UpdateSettingsRequest
from virtool.storage.errors import StorageKeyNotFoundError
from virtool.storage.protocol import StorageBackend
from virtool.uploads.sql import SQLUpload, UploadType
from virtool.uploads.utils import upload_file_key
from virtool.users.oas import UpdateUserRequest


@pytest.fixture
async def get_sample_ready_false(
    fake: DataFaker,
    mongo: Mongo,
    pg: AsyncEngine,
    static_time,
):
    label = await fake.labels.create()
    user = await fake.users.create()
    job = await fake.jobs.create(user, workflow="create_sample")

    upload = await fake.uploads.create(user=user)
    apple = await fake.subtractions.create(
        user=user, upload=upload, name="Apple", upload_files=False, finalized=False
    )
    pear = await fake.subtractions.create(
        user=user, upload=upload, name="Pear", upload_files=False, finalized=False
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
            "subtractions": [apple.id, pear.id],
            "user": {"id": user.id},
            "workflows": {
                "aodp": WorkflowState.INCOMPATIBLE.value,
                "pathoscope": WorkflowState.COMPLETE.value,
                "nuvs": WorkflowState.PENDING.value,
            },
        },
    )

    async with AsyncSession(pg) as session:
        legacy = SQLLegacySample(
            legacy_id="test",
            name="Test",
            library_type=LibraryType.normal.value,
            format="fastq",
            quality=None,
            created_at=static_time.datetime,
            ready=False,
            hold=False,
            is_legacy=False,
            all_read=True,
            all_write=True,
            group_read=True,
            group_write=True,
            user_id=user.id,
            job_id=job.id,
        )
        session.add(legacy)
        await session.flush()

        session.add(SQLLegacySampleLabel(sample_id=legacy.id, label_id=label.id))
        session.add(
            SQLLegacySampleSubtraction(sample_id=legacy.id, subtraction_id=apple.id),
        )
        session.add(
            SQLLegacySampleSubtraction(sample_id=legacy.id, subtraction_id=pear.id),
        )

        await session.commit()


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
        user = await fake.users.create()
        upload = await fake.uploads.create(user=user)

        apple = await fake.subtractions.create(
            user=user, upload=upload, name="Apple", upload_files=False, finalized=False
        )

        data = {
            "files": [upload.id],
            "labels": [label.id],
            "name": "Foobar",
            "subtractions": [apple.id],
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

        async with AsyncSession(pg) as session:
            legacy = (
                await session.execute(
                    select(SQLLegacySample).where(
                        SQLLegacySample.legacy_id == sample["_id"],
                    ),
                )
            ).scalar_one()

            label_ids = (
                (
                    await session.execute(
                        select(SQLLegacySampleLabel.label_id).where(
                            SQLLegacySampleLabel.sample_id == legacy.id,
                        ),
                    )
                )
                .scalars()
                .all()
            )

            subtraction_ids = (
                (
                    await session.execute(
                        select(SQLLegacySampleSubtraction.subtraction_id).where(
                            SQLLegacySampleSubtraction.sample_id == legacy.id,
                        ),
                    )
                )
                .scalars()
                .all()
            )

        assert legacy.name == sample["name"]
        assert legacy.library_type == sample["library_type"]
        # Mongo truncates datetimes to millisecond precision while Postgres keeps
        # microseconds, so the same source timestamp differs sub-millisecond.
        assert abs(legacy.created_at - sample["created_at"]) < timedelta(
            milliseconds=1,
        )
        assert legacy.user_id == sample["user"]["id"]
        assert legacy.job_id == sample["job"]["id"]
        assert legacy.ready is sample["ready"]
        assert legacy.hold is sample["hold"]
        assert legacy.all_read is sample["all_read"]
        assert legacy.all_write is sample["all_write"]
        assert legacy.group_read is sample["group_read"]
        assert legacy.group_write is sample["group_write"]
        assert legacy.group_id == (
            sample["group"] if isinstance(sample["group"], int) else None
        )
        assert set(label_ids) == set(sample["labels"])
        assert set(subtraction_ids) == set(sample["subtractions"])

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

    await mongo.samples.update_one(
        {"_id": "test"},
        {"$set": {"uploads": [{"id": upload.id}]}},
    )

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

    async with AsyncSession(pg) as session:
        legacy = (
            await session.execute(
                select(SQLLegacySample).where(SQLLegacySample.legacy_id == "test"),
            )
        ).scalar_one()

    assert legacy.ready is True
    assert legacy.quality == quality

    with pytest.raises(StorageKeyNotFoundError):
        await memory_storage.size(upload_key)


async def test_finalize_cleans_up_uploads_without_reads_link(
    data_layer: DataLayer,
    fake: DataFaker,
    get_sample_ready_false,
    memory_storage: StorageBackend,
    mongo: Mongo,
    pg: AsyncEngine,
):
    """Finalizing deletes the sample's uploads from storage using its ``uploads`` array.

    The cleanup keys off the sample's ``uploads`` array rather than ``SQLSampleReads``,
    so the upload file is removed even when the workflow wrote its reads row without an
    ``upload_id``.
    """
    upload = await fake.uploads.create(user=await fake.users.create())

    upload_row = await get_row_by_id(pg, SQLUpload, upload.id)
    upload_key = upload_file_key(upload_row.name_on_disk)

    await mongo.samples.update_one(
        {"_id": "test"},
        {"$set": {"uploads": [{"id": upload.id}]}},
    )

    async with AsyncSession(pg) as session:
        session.add(
            SQLSampleReads(
                name="reads.fq.gz",
                name_on_disk="reads_1.fq.gz",
                sample="test",
                size=len(b"upload contents"),
                upload=None,
                uploaded_at=virtool.utils.timestamp(),
            ),
        )

        await session.commit()

    async def _chunks() -> AsyncIterator[bytes]:
        yield b"upload contents"

    await memory_storage.write(upload_key, _chunks())

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

    with pytest.raises(StorageKeyNotFoundError):
        await memory_storage.size(upload_key)

    refreshed = await get_row_by_id(pg, SQLUpload, upload.id)
    assert refreshed.removed is True


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
                [1],
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
            match=r"^Subtractions do not exist: 999$",
        ):
            await data_layer.samples.has_resources_for_analysis_job(
                "test_ref",
                [subtraction_id, 999],
            )


class TestUpdate:
    """Updating a sample reconciles its ``legacy_samples`` row and join rows."""

    @staticmethod
    async def _create_sample(
        data_layer: DataLayer,
        fake: DataFaker,
        user_id: int,
        *,
        labels: list[int] | None = None,
        subtractions: list[int] | None = None,
    ):
        upload = await fake.uploads.create(user=await fake.users.create())

        return await data_layer.samples.create(
            CreateSampleRequest(
                files=[upload.id],
                labels=labels or [],
                name="Original",
                subtractions=subtractions or [],
            ),
            user_id,
            0,
        )

    @staticmethod
    async def _get_label_ids(pg: AsyncEngine, sample_id: str) -> set[int]:
        async with AsyncSession(pg) as session:
            legacy = (
                await session.execute(
                    select(SQLLegacySample).where(
                        SQLLegacySample.legacy_id == sample_id,
                    ),
                )
            ).scalar_one()

            return set(
                (
                    await session.execute(
                        select(SQLLegacySampleLabel.label_id).where(
                            SQLLegacySampleLabel.sample_id == legacy.id,
                        ),
                    )
                )
                .scalars()
                .all(),
            )

    @staticmethod
    async def _get_subtraction_ids(pg: AsyncEngine, sample_id: str) -> set[int]:
        async with AsyncSession(pg) as session:
            legacy = (
                await session.execute(
                    select(SQLLegacySample).where(
                        SQLLegacySample.legacy_id == sample_id,
                    ),
                )
            ).scalar_one()

            return set(
                (
                    await session.execute(
                        select(SQLLegacySampleSubtraction.subtraction_id).where(
                            SQLLegacySampleSubtraction.sample_id == legacy.id,
                        ),
                    )
                )
                .scalars()
                .all(),
            )

    async def test_scalars(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        spawn_client: ClientSpawner,
    ):
        """Scalar fields update both the Mongo doc and the ``legacy_samples`` row."""
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_sample],
        )

        sample = await self._create_sample(data_layer, fake, client.user.id)

        await data_layer.samples.update(
            sample.id,
            UpdateSampleRequest(name="Renamed", notes="Updated notes"),
        )

        document = await mongo.samples.find_one({"_id": sample.id})
        assert document["name"] == "Renamed"
        assert document["notes"] == "Updated notes"

        async with AsyncSession(pg) as session:
            legacy = (
                await session.execute(
                    select(SQLLegacySample).where(
                        SQLLegacySample.legacy_id == sample.id,
                    ),
                )
            ).scalar_one()

        assert legacy.name == "Renamed"
        assert legacy.notes == "Updated notes"

    async def test_labels_reconciled(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
        spawn_client: ClientSpawner,
    ):
        """Replacing labels leaves exactly the new set of ``legacy_sample_labels``."""
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_sample],
        )

        keep = await fake.labels.create()
        drop = await fake.labels.create()
        add = await fake.labels.create()

        sample = await self._create_sample(
            data_layer,
            fake,
            client.user.id,
            labels=[keep.id, drop.id],
        )

        assert await self._get_label_ids(pg, sample.id) == {keep.id, drop.id}

        await data_layer.samples.update(
            sample.id,
            UpdateSampleRequest(labels=[keep.id, add.id]),
        )

        assert await self._get_label_ids(pg, sample.id) == {keep.id, add.id}

    async def test_subtractions_reconciled(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
        spawn_client: ClientSpawner,
    ):
        """Replacing subtractions leaves exactly the new set of join rows."""
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_sample],
        )

        user = await fake.users.create()
        upload = await fake.uploads.create(user=user)

        keep = await fake.subtractions.create(
            user=user,
            upload=upload,
            name="Keep",
            upload_files=False,
            finalized=False,
        )
        drop = await fake.subtractions.create(
            user=user,
            upload=upload,
            name="Drop",
            upload_files=False,
            finalized=False,
        )
        add = await fake.subtractions.create(
            user=user,
            upload=upload,
            name="Add",
            upload_files=False,
            finalized=False,
        )

        sample = await self._create_sample(
            data_layer,
            fake,
            client.user.id,
            subtractions=[keep.id, drop.id],
        )

        assert await self._get_subtraction_ids(pg, sample.id) == {keep.id, drop.id}

        await data_layer.samples.update(
            sample.id,
            UpdateSampleRequest(subtractions=[keep.id, add.id]),
        )

        assert await self._get_subtraction_ids(pg, sample.id) == {keep.id, add.id}

    async def test_labels_without_legacy_row(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        spawn_client: ClientSpawner,
    ):
        """A label update on a sample lacking a ``legacy_samples`` row still succeeds.

        Samples created before the dual-write rollout have no ``legacy_samples`` row
        until the backfill runs, so join reconciliation must tolerate its absence and
        still apply the Mongo write.
        """
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_sample],
        )

        label = await fake.labels.create()
        sample = await self._create_sample(data_layer, fake, client.user.id)

        async with AsyncSession(pg) as session:
            legacy = (
                await session.execute(
                    select(SQLLegacySample).where(
                        SQLLegacySample.legacy_id == sample.id,
                    ),
                )
            ).scalar_one()

            await session.execute(
                delete(SQLLegacySampleLabel).where(
                    SQLLegacySampleLabel.sample_id == legacy.id,
                ),
            )
            await session.execute(
                delete(SQLLegacySampleSubtraction).where(
                    SQLLegacySampleSubtraction.sample_id == legacy.id,
                ),
            )
            await session.delete(legacy)
            await session.commit()

        await data_layer.samples.update(
            sample.id,
            UpdateSampleRequest(labels=[label.id]),
        )

        document = await mongo.samples.find_one({"_id": sample.id})
        assert document["labels"] == [label.id]

        async with AsyncSession(pg) as session:
            assert (
                await session.execute(
                    select(SQLLegacySample).where(
                        SQLLegacySample.legacy_id == sample.id,
                    ),
                )
            ).scalar_one_or_none() is None


class TestGetOwnerId:
    async def test_ok(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        spawn_client: ClientSpawner,
    ):
        """The owner user id is returned for an existing sample."""
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_sample],
        )

        upload = await fake.uploads.create(user=await fake.users.create())
        sample = await data_layer.samples.create(
            CreateSampleRequest(files=[upload.id], name="Owned"),
            client.user.id,
            0,
        )

        assert await data_layer.samples.get_owner_id(sample.id) == client.user.id

    async def test_missing(self, data_layer: DataLayer):
        """``None`` is returned when the sample does not exist."""
        assert await data_layer.samples.get_owner_id("nonexistent") is None


class TestUpdateRights:
    async def test_dual_writes_legacy_sample(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        spawn_client: ClientSpawner,
    ):
        """Rights updates hit both the Mongo doc and the ``legacy_samples`` row."""
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_sample],
        )

        group = await fake.groups.create()

        upload = await fake.uploads.create(user=await fake.users.create())
        sample = await data_layer.samples.create(
            CreateSampleRequest(files=[upload.id], name="Rights"),
            client.user.id,
            0,
        )

        await data_layer.samples.update_rights(
            sample.id,
            {
                "group": group.id,
                "group_read": False,
                "group_write": False,
                "all_read": False,
                "all_write": False,
            },
        )

        document = await mongo.samples.find_one({"_id": sample.id})
        assert document["group"] == group.id
        assert document["all_read"] is False
        assert document["group_read"] is False

        async with AsyncSession(pg) as session:
            legacy = (
                await session.execute(
                    select(SQLLegacySample).where(
                        SQLLegacySample.legacy_id == sample.id,
                    ),
                )
            ).scalar_one()

        assert legacy.group_id == group.id
        assert legacy.all_read is False
        assert legacy.all_write is False
        assert legacy.group_read is False
        assert legacy.group_write is False

    async def test_legacy_group_persists_as_integer(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        spawn_client: ClientSpawner,
    ):
        """A legacy string group is resolved to an integer id in the Mongo doc."""
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_sample],
        )

        group = await fake.groups.create(legacy_id="legacy_owner")

        upload = await fake.uploads.create(user=await fake.users.create())
        sample = await data_layer.samples.create(
            CreateSampleRequest(files=[upload.id], name="Rights"),
            client.user.id,
            0,
        )

        await data_layer.samples.update_rights(sample.id, {"group": "legacy_owner"})

        document = await mongo.samples.find_one({"_id": sample.id})
        assert document["group"] == group.id
        assert isinstance(document["group"], int)

    async def test_missing_group(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        spawn_client: ClientSpawner,
    ):
        """Assigning a nonexistent group raises ``ResourceConflictError``."""
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_sample],
        )

        upload = await fake.uploads.create(user=await fake.users.create())
        sample = await data_layer.samples.create(
            CreateSampleRequest(files=[upload.id], name="Rights"),
            client.user.id,
            0,
        )

        with pytest.raises(ResourceConflictError, match=r"Group does not exist"):
            await data_layer.samples.update_rights(sample.id, {"group": 999999})

    async def test_missing_sample(self, data_layer: DataLayer):
        """Updating rights on a missing sample raises ``ResourceNotFoundError``."""
        with pytest.raises(ResourceNotFoundError):
            await data_layer.samples.update_rights(
                "nonexistent",
                {"all_read": False},
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

    async def test_releases_reserved_uploads(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
    ):
        """Deleting a sample releases the uploads reserved during its creation.

        The reservation is keyed on the sample's own ``uploads`` array, so the upload
        is released even when no ``SQLSampleReads`` rows have been written yet.
        """
        await self._setup(fake, mongo)

        upload = await fake.uploads.create(
            user=await fake.users.create(),
            reserved=True,
        )

        await mongo.samples.update_one(
            {"_id": "test_sample"},
            {"$set": {"uploads": [{"id": upload.id}]}},
        )

        await data_layer.samples.delete("test_sample")

        row = await get_row_by_id(pg, SQLUpload, upload.id)
        assert row.reserved is False

    async def test_removes_legacy_sample_and_join_rows(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        spawn_client: ClientSpawner,
    ):
        """Deleting a sample removes its ``legacy_samples`` row and join rows."""
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_sample],
        )

        label = await fake.labels.create()
        user = await fake.users.create()
        upload = await fake.uploads.create(user=user)
        apple = await fake.subtractions.create(
            user=user,
            upload=upload,
            name="Apple",
            upload_files=False,
            finalized=False,
        )

        sample = await data_layer.samples.create(
            CreateSampleRequest(
                files=[upload.id],
                labels=[label.id],
                name="Foobar",
                subtractions=[apple.id],
            ),
            client.user.id,
            0,
        )

        async with AsyncSession(pg) as session:
            legacy = (
                await session.execute(
                    select(SQLLegacySample).where(
                        SQLLegacySample.legacy_id == sample.id,
                    ),
                )
            ).scalar_one()

        await data_layer.samples.delete(sample.id)

        async with AsyncSession(pg) as session:
            assert (
                await session.execute(
                    select(SQLLegacySample).where(
                        SQLLegacySample.legacy_id == sample.id,
                    ),
                )
            ).scalar_one_or_none() is None

            assert (
                await session.execute(
                    select(SQLLegacySampleLabel).where(
                        SQLLegacySampleLabel.sample_id == legacy.id,
                    ),
                )
            ).scalars().all() == []

            assert (
                await session.execute(
                    select(SQLLegacySampleSubtraction).where(
                        SQLLegacySampleSubtraction.sample_id == legacy.id,
                    ),
                )
            ).scalars().all() == []

        assert await mongo.samples.find_one() is None
