import asyncio
from pathlib import Path

import pytest
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

from tests.fixtures.client import ClientSpawner
from tests.fixtures.samples import create_rights_sample
from virtool.analyses.sql import SQLAnalysis
from virtool.api.client import JobClient, UserClient
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.data.transforms import apply_transforms
from virtool.fake.next import DataFaker, fake_file_chunker
from virtool.models.enums import AnalysisWorkflow, Permission
from virtool.models.roles import AdministratorRole
from virtool.mongo.core import Mongo
from virtool.pg.utils import get_row, get_row_by_id
from virtool.samples.data import SamplesData
from virtool.samples.db import AttachUploadsTransform
from virtool.samples.models import Sample
from virtool.samples.oas import (
    CreateAnalysisRequest,
    CreateSampleRequest,
    UpdateSampleRequest,
)
from virtool.samples.sql import (
    SQLLegacySample,
    SQLLegacySampleLabel,
    SQLLegacySampleSubtraction,
    SQLSampleUpload,
)
from virtool.samples.utils import SampleRight, sample_file_key, sample_prefix
from virtool.settings.oas import UpdateSettingsRequest
from virtool.storage.errors import StorageKeyNotFoundError
from virtool.storage.protocol import StorageBackend
from virtool.uploads.sql import SQLUpload, UploadType
from virtool.uploads.utils import upload_file_key
from virtool.users.oas import UpdateUserRequest

QUALITY = {
    "bases": [[1543]],
    "composition": [[6372]],
    "count": 7069,
    "encoding": "OuBQPPuwYimrxkNpPWUx",
    "gc": 34222440,
    "length": [3237],
    "sequences": [7091],
}


async def _count_legacy_samples(pg: AsyncEngine) -> int:
    async with AsyncSession(pg) as session:
        return len((await session.execute(select(SQLLegacySample.id))).scalars().all())


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

        sample = await data_layer.samples.create(
            CreateSampleRequest(**data),
            client.user.id,
        )

        assert sample == snapshot_recent(name="sample")
        assert (await get_row_by_id(pg, SQLUpload, 1)).reserved is True

        async with AsyncSession(pg) as session:
            legacy = (
                await session.execute(
                    select(SQLLegacySample).where(
                        SQLLegacySample.id == sample.id,
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

            sample_uploads = (
                (
                    await session.execute(
                        select(SQLSampleUpload)
                        .where(SQLSampleUpload.sample_id == legacy.id)
                        .order_by(SQLSampleUpload.index),
                    )
                )
                .scalars()
                .all()
            )

        assert [(row.sample, row.upload_id, row.index) for row in sample_uploads] == [
            (str(legacy.id), upload.id, 0),
        ]

        # Samples created natively in Postgres have no Mongo id to carry.
        assert legacy.legacy_id is None

        assert legacy.name == "Foobar"
        assert legacy.library_type == sample.library_type
        assert legacy.user_id == client.user.id
        assert legacy.job_id == sample.job.id
        assert legacy.ready is False
        assert legacy.hold is True
        assert legacy.all_read is True
        assert legacy.all_write is True
        assert legacy.group_read is True
        assert legacy.group_write is True
        assert legacy.group_id == (None if group_setting == "none" else group.id)
        assert set(label_ids) == {label.id}
        assert set(subtraction_ids) == {apple.id}

    async def test_already_reserved(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
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
            )

        assert await _count_legacy_samples(pg) == 0

    async def test_reservation_rolled_back_on_failure(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mocker,
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
            SamplesData,
            "_add_legacy_sample_join_rows",
            side_effect=RuntimeError("boom"),
        )

        with pytest.raises(RuntimeError, match=r"boom"):
            await data_layer.samples.create(
                CreateSampleRequest(files=[upload.id], name="Foobar"),
                client.user.id,
            )

        row = await get_row_by_id(pg, SQLUpload, upload.id)
        assert row.reserved is False
        assert await _count_legacy_samples(pg) == 0


class TestAttachUploadsTransform:
    """The uploads array is sourced from ``sample_uploads``, ordered by ``index``."""

    async def test_orders_one_by_index(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """A sample's uploads come back in the order they were supplied at creation."""
        user = await fake.users.create()
        first = await fake.uploads.create(user=user, name="first.fq.gz")
        second = await fake.uploads.create(user=user, name="second.fq.gz")

        sample = await fake.samples.create(user, uploads=[second, first])

        document = await apply_transforms(
            {"id": sample.id},
            [AttachUploadsTransform(pg)],
            pg,
        )

        assert [upload["id"] for upload in document["uploads"]] == [
            second.id,
            first.id,
        ]

    async def test_orders_many_by_index(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """The batched path groups uploads by sample and preserves index order."""
        user = await fake.users.create()
        first = await fake.uploads.create(user=user, name="first.fq.gz")
        second = await fake.uploads.create(user=user, name="second.fq.gz")
        third = await fake.uploads.create(user=user, name="third.fq.gz")

        paired = await fake.samples.create(user, uploads=[second, first])
        single = await fake.samples.create(user, uploads=[third])

        documents = await apply_transforms(
            [{"id": paired.id}, {"id": single.id}],
            [AttachUploadsTransform(pg)],
            pg,
        )

        assert [
            [upload["id"] for upload in document["uploads"]] for document in documents
        ] == [[second.id, first.id], [third.id]]

    async def test_no_uploads_is_none(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """A sample with no ``sample_uploads`` rows gets ``None``, not an empty list.

        Samples imported from Mongo without an ``uploads`` array are left without
        membership rows by the backfill, so this state outlives the migration.
        """
        user = await fake.users.create()
        sample = await fake.samples.create(user)

        async with AsyncSession(pg) as session:
            await session.execute(
                delete(SQLSampleUpload).where(SQLSampleUpload.sample_id == sample.id),
            )
            await session.commit()

        document = await apply_transforms(
            {"id": sample.id},
            [AttachUploadsTransform(pg)],
            pg,
        )

        assert document["uploads"] is None


class TestFinalize:
    async def test_ok(
        self,
        data_layer: DataLayer,
        example_path: Path,
        fake: DataFaker,
        memory_storage: StorageBackend,
        pg: AsyncEngine,
        snapshot_recent: SnapshotAssertion,
    ):
        """Finalizing a sample whose reads have been uploaded marks it ready, leaves the
        reads downloadable, and deletes the input uploads from storage.

        The upload cleanup keys off the sample's ``uploads`` array rather than its
        ``SQLSampleReads`` rows, so it does not depend on the workflow having linked the
        reads it wrote back to an upload.
        """
        user = await fake.users.create()
        sample = await fake.samples.create(user, paired=True)

        upload_keys = []

        for upload in sample.uploads:
            row = await get_row_by_id(pg, SQLUpload, upload.id)
            key = upload_file_key(row.name_on_disk)

            assert await memory_storage.size(key) > 0

            upload_keys.append(key)

        filenames = ["reads_1.fq.gz", "reads_2.fq.gz"]

        for filename in filenames:
            await data_layer.samples.upload_reads(
                sample.id,
                filename,
                fake_file_chunker(example_path / "sample" / filename),
            )

        finalized = await data_layer.samples.finalize(sample.id, QUALITY)

        assert finalized.ready is True
        assert finalized.quality == QUALITY
        assert finalized.dict() == snapshot_recent()

        for filename in filenames:
            stream, _, _ = await data_layer.samples.get_reads_file(sample.id, filename)

            assert (
                b"".join([chunk async for chunk in stream])
                == (example_path / "sample" / filename).read_bytes()
            )

        for key in upload_keys:
            with pytest.raises(StorageKeyNotFoundError):
                await memory_storage.size(key)

        for upload in sample.uploads:
            assert (await get_row_by_id(pg, SQLUpload, upload.id)).removed is True

    async def test_already_finalized(self, data_layer: DataLayer, fake: DataFaker):
        """A sample that is already ready cannot be finalized again."""
        user = await fake.users.create()
        sample = await fake.samples.create(user, ready=True)

        with pytest.raises(ResourceConflictError, match=r"Sample already finalized"):
            await data_layer.samples.finalize(sample.id, QUALITY)

    async def test_sample_disappeared(self, data_layer: DataLayer, mocker):
        """Finalizing raises ``ResourceNotFoundError`` when the sample row is gone after
        the existence check, rather than surfacing a ``NoResultFound`` 500.
        """
        mocker.patch.object(
            data_layer.samples,
            "_resolve_ids",
            return_value=(999999, "gone"),
        )

        with pytest.raises(ResourceNotFoundError):
            await data_layer.samples.finalize(999999, {})


class TestHasRight:
    async def test_ok(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
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

        sample = await create_rights_sample(
            data_layer,
            fake,
            sample_owner,
            group=group.id,
            group_read=True,
            group_write=True,
        )

        assert await data_layer.samples.has_right(sample.id, client, SampleRight.write)

    async def test_read_permission(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
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

        sample = await create_rights_sample(
            data_layer,
            fake,
            sample_owner,
            group=group.id,
            group_read=True,
        )

        assert await data_layer.samples.has_right(sample.id, client, SampleRight.read)

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

        sample = await create_rights_sample(data_layer, fake, sample_owner)

        assert await data_layer.samples.has_right(sample.id, client, SampleRight.write)

    async def test_owner_full_access(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
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

        sample = await create_rights_sample(data_layer, fake, user)

        assert await data_layer.samples.has_right(sample.id, client, SampleRight.write)

    async def test_job_client_full_access(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        """A job-authenticated client holds every right regardless of ownership or
        sharing, since a job's identity is neither a user nor an administrator.
        """
        sample_owner = await fake.users.create()

        sample = await create_rights_sample(
            data_layer,
            fake,
            sample_owner,
            all_read=False,
            all_write=False,
        )

        client = JobClient(job_id=1)

        assert await data_layer.samples.has_right(
            sample.id,
            client,
            SampleRight.read,
        )
        assert await data_layer.samples.has_right(
            sample.id,
            client,
            SampleRight.write,
        )

    async def test_non_group_member_denied(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
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

        sample = await create_rights_sample(
            data_layer,
            fake,
            sample_owner,
            group=group.id,
            group_write=True,
        )

        assert not await data_layer.samples.has_right(
            sample.id,
            client,
            SampleRight.write,
        )


class TestFindRights:
    """``find`` scopes the sample list to those the requesting client can read."""

    @staticmethod
    def _build_client(user) -> UserClient:
        return UserClient(
            administrator_role=user.administrator_role,
            authenticated=True,
            force_reset=False,
            groups=[group.id for group in user.groups],
            permissions=user.permissions.dict(),
            user_id=user.id,
        )

    async def test_full_administrator_sees_private_sample(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        """A full administrator lists a sample they neither own nor share."""
        administrator = await fake.users.create(
            administrator_role=AdministratorRole.FULL,
        )
        sample_owner = await fake.users.create()

        sample = await create_rights_sample(
            data_layer,
            fake,
            sample_owner,
            all_read=False,
        )

        result = await data_layer.samples.find(
            labels=[],
            page=1,
            per_page=25,
            term="",
            users=[],
            workflows=[],
            client=self._build_client(administrator),
        )

        assert result.found_count == 1
        assert [document.id for document in result.documents] == [sample.id]

    async def test_non_owner_cannot_see_private_sample(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        """A non-administrator without rights does not list another user's sample."""
        user = await fake.users.create()
        sample_owner = await fake.users.create()

        await create_rights_sample(
            data_layer,
            fake,
            sample_owner,
            all_read=False,
        )

        result = await data_layer.samples.find(
            labels=[],
            page=1,
            per_page=25,
            term="",
            users=[],
            workflows=[],
            client=self._build_client(user),
        )

        assert result.found_count == 0
        assert result.documents == []


class TestHasResourcesForAnalysisJob:
    @staticmethod
    async def _seed(
        data_layer: DataLayer,
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

        reference = await fake.references.create(user=user, id_="test_ref")

        if archived:
            await data_layer.references.archive(reference.id)

        _, subtraction = await asyncio.gather(
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
        subtraction_id = await self._seed(data_layer, fake, mongo)

        assert (
            await data_layer.samples.has_resources_for_analysis_job(
                "test_ref",
                [subtraction_id],
            )
            is None
        )

    async def test_ok_migrated_reference(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
    ):
        """A ready index embedding the integer reference id is still matched."""
        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )

        reference = await fake.references.create(user=user, id_="test_ref")

        _, subtraction = await asyncio.gather(
            mongo.indexes.insert_one(
                {
                    "_id": "test_index",
                    "reference": {"id": reference.id},
                    "ready": True,
                    "version": 1,
                },
            ),
            fake.subtractions.create(user=user, upload=upload),
        )

        assert (
            await data_layer.samples.has_resources_for_analysis_job(
                reference.id,
                [subtraction.id],
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
        subtraction_id = await self._seed(data_layer, fake, mongo, archived=True)

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
        subtraction_id = await self._seed(data_layer, fake, mongo)

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
        )

    @staticmethod
    async def _get_label_ids(pg: AsyncEngine, sample_id: int) -> set[int]:
        async with AsyncSession(pg) as session:
            legacy = (
                await session.execute(
                    select(SQLLegacySample).where(
                        SQLLegacySample.id == sample_id,
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
    async def _get_subtraction_ids(pg: AsyncEngine, sample_id: int) -> set[int]:
        async with AsyncSession(pg) as session:
            legacy = (
                await session.execute(
                    select(SQLLegacySample).where(
                        SQLLegacySample.id == sample_id,
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
        pg: AsyncEngine,
        spawn_client: ClientSpawner,
    ):
        """Scalar fields are written to the ``legacy_samples`` row."""
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_sample],
        )

        sample = await self._create_sample(data_layer, fake, client.user.id)

        await data_layer.samples.update(
            sample.id,
            UpdateSampleRequest(name="Renamed", notes="Updated notes"),
        )

        async with AsyncSession(pg) as session:
            legacy = (
                await session.execute(
                    select(SQLLegacySample).where(
                        SQLLegacySample.id == sample.id,
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
        )

        assert await data_layer.samples.get_owner_id(sample.id) == client.user.id

    async def test_missing(self, data_layer: DataLayer):
        """``None`` is returned when the sample does not exist."""
        assert await data_layer.samples.get_owner_id("nonexistent") is None


class TestUpdateRights:
    async def test_ok(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
        spawn_client: ClientSpawner,
    ):
        """Rights updates are written to the ``legacy_samples`` row."""
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_sample],
        )

        group = await fake.groups.create()

        upload = await fake.uploads.create(user=await fake.users.create())
        sample = await data_layer.samples.create(
            CreateSampleRequest(files=[upload.id], name="Rights"),
            client.user.id,
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

        async with AsyncSession(pg) as session:
            legacy = (
                await session.execute(
                    select(SQLLegacySample).where(
                        SQLLegacySample.id == sample.id,
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
        pg: AsyncEngine,
        spawn_client: ClientSpawner,
    ):
        """A legacy string group is resolved to its integer id when stored."""
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_sample],
        )

        group = await fake.groups.create(legacy_id="legacy_owner")

        upload = await fake.uploads.create(user=await fake.users.create())
        sample = await data_layer.samples.create(
            CreateSampleRequest(files=[upload.id], name="Rights"),
            client.user.id,
        )

        await data_layer.samples.update_rights(sample.id, {"group": "legacy_owner"})

        async with AsyncSession(pg) as session:
            legacy = (
                await session.execute(
                    select(SQLLegacySample).where(
                        SQLLegacySample.id == sample.id,
                    ),
                )
            ).scalar_one()

        assert legacy.group_id == group.id

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

    async def _setup(
        self,
        fake: DataFaker,
        mongo: Mongo,
    ) -> tuple[Sample, int, str]:
        """Create a finalized sample and a reference with a ready index to analyse it
        against.
        """
        user = await fake.users.create()
        reference = await fake.references.create(user=user, name="Test Reference")
        sample = await fake.samples.create(user, ready=True)

        await mongo.indexes.insert_one(
            {
                "_id": "test_index",
                "version": 11,
                "ready": True,
                "reference": {"id": reference.id},
            },
        )

        return sample, user.id, reference.id

    async def test_deletes_analysis_pg_rows(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        memory_storage: StorageBackend,
        mongo: Mongo,
        pg: AsyncEngine,
    ):
        """Deleting a sample removes its analyses' Postgres rows."""
        sample, user_id, ref_id = await self._setup(fake, mongo)

        analysis = await data_layer.analyses.create(
            CreateAnalysisRequest(
                ref_id=ref_id,
                subtractions=[],
                workflow=AnalysisWorkflow.nuvs,
            ),
            sample.id,
            user_id,
        )

        await data_layer.analyses.finalize(analysis.id, {"hits": []})

        assert await get_row(pg, SQLAnalysis, ("id", analysis.id)) is not None

        await data_layer.samples.delete(sample.id)

        assert await get_row(pg, SQLAnalysis, ("id", analysis.id)) is None

    async def test_releases_reserved_uploads(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """Deleting a sample releases the uploads reserved during its creation.

        The reservation is keyed on the sample's own ``uploads`` array, so the uploads
        are released even when no ``SQLSampleReads`` rows have been written yet.
        """
        user = await fake.users.create()
        sample = await fake.samples.create(user, paired=True)

        for upload in sample.uploads:
            assert (await get_row_by_id(pg, SQLUpload, upload.id)).reserved is True

        await data_layer.samples.delete(sample.id)

        for upload in sample.uploads:
            assert (await get_row_by_id(pg, SQLUpload, upload.id)).reserved is False

    async def test_removes_legacy_sample_and_join_rows(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
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
        )

        async with AsyncSession(pg) as session:
            legacy = (
                await session.execute(
                    select(SQLLegacySample).where(
                        SQLLegacySample.id == sample.id,
                    ),
                )
            ).scalar_one()

            assert (
                await session.execute(
                    select(SQLSampleUpload).where(
                        SQLSampleUpload.sample_id == legacy.id,
                    ),
                )
            ).scalars().all() != []

        await data_layer.samples.delete(sample.id)

        async with AsyncSession(pg) as session:
            assert (
                await session.execute(
                    select(SQLLegacySample).where(
                        SQLLegacySample.id == sample.id,
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

            assert (
                await session.execute(
                    select(SQLSampleUpload).where(
                        SQLSampleUpload.sample_id == legacy.id,
                    ),
                )
            ).scalars().all() == []

    async def test_postgres_native_sample_cleans_storage(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        memory_storage: StorageBackend,
        pg: AsyncEngine,
    ):
        """Deleting a Postgres-native sample (no ``legacy_id``) removes its Postgres row
        and cleans up its storage prefix instead of raising ``ResourceNotFoundError``.

        The sample has no Mongo document, so the delete's success signal comes from the
        ``legacy_samples`` rowcount, not ``delete_one``'s ``deleted_count``.
        """
        user = await fake.users.create()
        sample = await fake.samples.create(user, paired=True, ready=True)

        assert (await get_row_by_id(pg, SQLLegacySample, sample.id)).legacy_id is None

        prefix = sample_prefix(str(sample.id))

        assert [obj.key async for obj in memory_storage.list(prefix)] == [
            sample_file_key(str(sample.id), "reads_1.fq.gz"),
            sample_file_key(str(sample.id), "reads_2.fq.gz"),
        ]

        await data_layer.samples.delete(sample.id)

        assert await get_row_by_id(pg, SQLLegacySample, sample.id) is None
        assert [obj.key async for obj in memory_storage.list(prefix)] == []
