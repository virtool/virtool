"""Easily create fake data."""

import asyncio
import datetime
import gzip
from collections.abc import AsyncGenerator, Generator
from pathlib import Path

import arrow
from faker import Faker
from faker.providers import (
    BaseProvider,
    color,
    file,
    lorem,
    python,
)
from faker.providers import (
    job as job_provider,
)
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.utils
from virtool.data.layer import DataLayer
from virtool.example import example_path
from virtool.fake.providers import OrganismProvider, SegmentProvider, SequenceProvider
from virtool.groups.models import Group
from virtool.groups.oas import PermissionsUpdate, UpdateGroupRequest
from virtool.groups.pg import SQLGroup
from virtool.hmm.models import HMM
from virtool.hmm.sql import SQLHMM
from virtool.identifier import AbstractIdProvider
from virtool.indexes.models import Index
from virtool.indexes.sql import SQLIndex
from virtool.indexes.tasks import CreateIndexTask
from virtool.jobs.models import TERMINAL_JOB_STATES, Job, JobState
from virtool.jobs.pg import SQLJob
from virtool.jobs.utils import WORKFLOW_NAMES
from virtool.labels.models import Label
from virtool.models.enums import LibraryType, Molecule
from virtool.models.roles import AdministratorRole
from virtool.otus.models import OTU, OTUSegment
from virtool.otus.oas import CreateOTURequest
from virtool.references.db import create_document, get_manifest, write_legacy_reference
from virtool.references.models import Reference, ReferenceDataType
from virtool.references.tasks import CloneReferenceTask
from virtool.samples.files import create_reads_file
from virtool.samples.models import Sample
from virtool.samples.oas import CreateSampleRequest
from virtool.samples.utils import sample_file_key, sample_storage_id
from virtool.storage.protocol import STORAGE_CHUNK_SIZE, StorageBackend
from virtool.subtractions.models import Subtraction
from virtool.subtractions.oas import (
    CreateSubtractionRequest,
    FinalizeSubtractionRequest,
    NucleotideComposition,
)
from virtool.tasks.models import Task
from virtool.tasks.task import BaseTask
from virtool.uploads.models import Upload, UploadMinimal
from virtool.uploads.sql import UploadType
from virtool.uploads.utils import CHUNK_SIZE
from virtool.users.models import User
from virtool.users.oas import UpdateUserRequest


async def fake_file_chunker(path: Path) -> AsyncGenerator[bytearray]:
    """Read a chunk of size `CHUNK_SIZE` from a file.

    This is used to hijack the upload process and create fake uploads.

    :param path: the path to the file
    :return: an async generator that yields chunks of the file
    """
    with open(path, "rb") as f:
        yield f.read(CHUNK_SIZE)


async def gzip_file_chunker(path: Path) -> AsyncGenerator[bytearray]:
    """Decompress and Read a chunk of size `CHUNK_SIZE` from a file.

    This is used to hijack the upload process and create fake uploads. It will
    decompress the file at ``path`` before reading it.

    :param path: the path to the gzip file
    :return: an async generator that yields chunks of the file

    """
    _q = asyncio.Queue()

    def reader(gzip_path: Path, q: asyncio.Queue):
        with gzip.open(gzip_path, "rb") as f:
            q.put_nowait(f.read(CHUNK_SIZE))

    task = asyncio.Task(asyncio.to_thread(reader, path, _q))

    while not _q.empty():
        yield await _q.get()

    await task


async def _stream_reads_file(path: Path) -> AsyncGenerator[bytes]:
    with path.open("rb") as f:
        while chunk := f.read(STORAGE_CHUNK_SIZE):
            yield chunk


async def copy_reads_file(
    storage: StorageBackend,
    file_path: Path,
    filename: str,
    storage_id: str,
) -> None:
    """Copy a reads file into a sample's storage prefix."""
    await storage.write(
        sample_file_key(storage_id, filename), _stream_reads_file(file_path)
    )


def _fake_composition(faker: Faker) -> Generator[int]:
    left = 100
    sent = 0

    while left > 0 and sent < 4:
        i = faker.pyint(1, 97)
        yield i
        sent += 1
        left -= i

    while sent < 4:
        yield 1
        sent += 1


def create_fake_quality(faker: Faker) -> dict:
    """Generate a fake sample quality payload for finalization."""
    return {
        "count": faker.pyint(min_value=10000, max_value=10000000000),
        "encoding": "Sanger / Illumina 1.9\n",
        "length": [faker.pyint(10, 100), faker.pyint(10, 100)],
        "gc": faker.pyint(0, 100),
        "bases": [[faker.pyint(31, 32) for _ in range(5)] for _ in range(5)],
        "sequences": faker.pylist(25, value_types=[int]),
        "composition": [
            list(_fake_composition(faker)) for _ in range(faker.pyint(4, 8))
        ],
        "hold": faker.pybool(),
        "group_read": faker.pybool(),
        "group_write": faker.pybool(),
        "all_read": faker.pybool(),
        "all_write": faker.pybool(),
        "paired": faker.pybool(),
    }


class VirtoolProvider(BaseProvider):
    def mongo_id(self):
        return self.random_letters(8)

    def pg_id(self) -> int:
        return self.random_int()

    def workflow(self) -> str:
        return self.random_choices(
            [name.replace("job_", "") for name in WORKFLOW_NAMES],
            1,
        )[0]


class DataFaker:
    def __init__(
        self,
        layer: DataLayer,
        pg: AsyncEngine,
        storage: StorageBackend,
        id_provider: AbstractIdProvider,
    ):
        self.layer = layer
        self.pg = pg
        self.storage = storage
        self.id_provider = id_provider

        self.faker = Faker()
        self.faker.seed_instance(0)
        self.faker.add_provider(VirtoolProvider)
        self.faker.add_provider(color)
        self.faker.add_provider(lorem)
        self.faker.add_provider(python)
        self.faker.add_provider(file)
        self.faker.add_provider(job_provider)
        self.faker.add_provider(OrganismProvider)
        self.faker.add_provider(SegmentProvider)
        self.faker.add_provider(SequenceProvider)

        self.groups = GroupsFakerDomain(self)
        self.hmm = HMMFakerDomain(self)
        self.indexes = IndexesFakerDomain(self)
        self.jobs = JobsFakerDomain(self)
        self.labels = LabelsFakerDomain(self)
        self.otus = OTUsFakerDomain(self)
        self.references = ReferencesFakerDomain(self)
        self.samples = SamplesFakerDomain(self)
        self.subtractions = SubtractionFakerDomain(self)
        self.tasks = TasksFakerDomain(self)
        self.users = UsersFakerDomain(self)
        self.uploads = UploadsFakerDomain(self)


class DataFakerDomain:
    def __init__(self, data_faker: DataFaker):
        self._data_faker = data_faker
        self._faker = data_faker.faker
        self._layer: DataLayer = data_faker.layer
        self._id_provider = data_faker.id_provider
        self._pg = data_faker.pg
        self._storage = data_faker.storage

        self.history = []


class JobsFakerDomain(DataFakerDomain):
    model = Job

    async def create(
        self,
        user: User,
        pinged_at: datetime.datetime | None = None,
        state: JobState | None = None,
        workflow: str | None = None,
    ) -> Job:
        job = await self._layer.jobs.create(
            (workflow or self._faker.workflow()).replace("jobs_", ""),
            self._faker.pydict(nb_elements=6, value_types=[str, int, float]),
            user.id,
            0,
        )

        target_state = state or self._faker.random_element(
            [
                JobState.CANCELLED,
                JobState.FAILED,
                JobState.PENDING,
                JobState.RUNNING,
                JobState.SUCCEEDED,
            ],
        )

        if target_state == JobState.PENDING:
            return job

        if pinged_at is None:
            pinged_at = arrow.utcnow().shift(minutes=-1).naive

        async with AsyncSession(self._pg) as session:
            values = {
                "acquired": True,
                "claim": {
                    "runner_id": "fake-runner",
                    "mem": 1.0,
                    "cpu": 1.0,
                    "image": "virtool/fake:latest",
                    "runtime_version": "0.0.0",
                    "workflow_version": "0.0.0",
                },
                "claimed_at": virtool.utils.timestamp(),
                "key": virtool.utils.hash_key("fake-job-key"),
                "pinged_at": pinged_at,
                "state": JobState.RUNNING.value,
                "steps": [],
            }

            if target_state != JobState.RUNNING:
                values["state"] = target_state.value

                if target_state in TERMINAL_JOB_STATES:
                    values["finished_at"] = virtool.utils.timestamp()

            await session.execute(
                update(SQLJob).where(SQLJob.id == job.id).values(**values),
            )
            await session.commit()

        return await self._layer.jobs.get(job.id)


class GroupsFakerDomain(DataFakerDomain):
    model = Group

    async def create(
        self,
        permissions: PermissionsUpdate | None = None,
        legacy_id: str | None = None,
        name: str | None = None,
    ) -> Group:
        """:param permissions: Permissions for the group. If not provided, the group will
            have no permissions.
        :param legacy_id: An optional legacy ID for the group.
        :param name: The name of the group. If not provided, a unique name will be
            generated.
        :return: a group
        """
        if name is None:
            name = "contains spaces"

            while " " in name:
                name = self._faker.unique.job().lower() + "s"

        group = await self._layer.groups.create(name)

        if legacy_id:
            async with AsyncSession(self._pg) as session:
                await session.execute(
                    update(SQLGroup)
                    .where(SQLGroup.id == group.id)
                    .values(legacy_id=legacy_id),
                )
                await session.commit()

            group = await self._layer.groups.get(group.id)

        if permissions:
            group = await self._layer.groups.update(
                group.id,
                UpdateGroupRequest(permissions=permissions),
            )

        return group


class HMMFakerDomain(DataFakerDomain):
    model = HMM

    async def create(self) -> HMM:
        """Create a new Postgres-native fake hmm.

        :return: a new fake hmm
        """
        faker = self._faker

        document = {
            "entries": [
                {
                    "accession": faker.pystr(),
                    "gi": faker.pystr(),
                    "name": faker.pystr(),
                    "organism": faker.pystr(),
                },
            ],
            "genera": {faker.pystr(): faker.pyint()},
            "length": faker.pyint(),
            "mean_entropy": faker.pyfloat(),
            "total_entropy": faker.pyfloat(),
            "cluster": faker.pyint(),
            "count": faker.pyint(),
            "families": {faker.pystr(): faker.pyint()},
            "names": [faker.pystr()],
        }

        async with AsyncSession(self._pg) as session:
            hmm = SQLHMM(
                cluster=document["cluster"],
                count=document["count"],
                length=document["length"],
                mean_entropy=document["mean_entropy"],
                total_entropy=document["total_entropy"],
                hidden=False,
                names=document["names"],
                families=document["families"],
                genera=document["genera"],
                entries=document["entries"],
            )
            session.add(hmm)
            await session.flush()
            document["id"] = hmm.id
            await session.commit()

        return HMM(**document)


class LabelsFakerDomain(DataFakerDomain):
    model = Label

    async def create(self) -> Label:
        """Create a new fake label.

        :return: a new fake label
        """
        return await self._layer.labels.create(
            self._faker.word().capitalize(),
            self._faker.hex_color(),
            self._faker.sentence(),
        )


class ReferencesFakerDomain(DataFakerDomain):
    model = Reference

    async def create(
        self,
        user: User,
        id_: str | None = None,
        name: str = "Reference",
        data_type: ReferenceDataType = ReferenceDataType.genome,
        organism: str = "",
        description: str = "",
        *,
        archived: bool = False,
        use_legacy_id: bool = False,
    ) -> Reference:
        """Create a fake reference in Postgres.

        By default the reference is Postgres-native: its ``legacy_id`` is ``NULL`` and
        the integer primary key is what holders (analyses, history) resolve against.

        Pass ``id_`` to force a specific ``legacy_id``, or ``use_legacy_id=True`` to
        seed a generated one, when exercising the legacy-reference bridge.
        """
        settings = await self._layer.settings.get_all()

        ref_id = id_

        if ref_id is None and use_legacy_id:
            ref_id = self._id_provider.get()

        document = await create_document(
            settings,
            name,
            organism,
            description,
            data_type.value,
            created_at=virtool.utils.timestamp(),
            ref_id=ref_id,
            user_id=user.id,
        )

        async with AsyncSession(self._pg) as session:
            reference_pk = await write_legacy_reference(session, document)
            await session.commit()

        if archived:
            return await self._layer.references.archive(reference_pk)

        return await self._layer.references.get(reference_pk)


class IndexesFakerDomain(DataFakerDomain):
    model = Index

    async def create(
        self,
        reference: Reference,
        user: User,
        job: Job | None = None,
        manifest: dict[str, int] | None = None,
        version: int | None = None,
        *,
        created_at: datetime.datetime | None = None,
        ready: bool = False,
    ) -> Index:
        """Create a fake index for ``reference``.

        An index is backed by exactly one build: a job or a task. Passing ``job`` seeds
        the legacy job-backed shape, leaving ``task`` null. Omitting it seeds the shape
        ``ReferencesData.create_index`` writes, backing the index with a
        ``CreateIndexTask`` and leaving ``job`` null. Embedding both is the corrupt shape
        ``_get_index_build_type`` rejects.

        The row is seeded in the backfilled shape: a legacy Mongo-style ``_id`` that
        also serves as the ``storage_key`` and a backing task named after it.
        Postgres-native indexes (no ``legacy_id``, a UUID ``storage_key``) come from
        ``ReferencesData.create_index`` instead.

        :param reference: the reference to build the index for
        :param user: the user the build is attributed to
        :param job: the job backing the build; when omitted a task backs it instead
        :param manifest: the OTU manifest to capture; defaults to the reference's
        :param version: the index version; defaults to one past the reference's existing
            indexes. Production counts only built indexes, which is the same number
            while a reference has at most one unbuilt index, but counting all of them
            keeps successive fake indexes on distinct versions.
        :param created_at: when the index was created; defaults to now. Pass it to order
            indexes independently of the order they are created in.
        :param ready: whether the index is finished building
        :return: a new fake index
        """
        index_id = self._id_provider.get()

        if manifest is None:
            manifest = await get_manifest(self._pg, reference.id)

        if version is None:
            async with AsyncSession(self._pg) as session:
                version = await session.scalar(
                    select(func.count())
                    .select_from(SQLIndex)
                    .where(SQLIndex.reference_id == reference.id),
                )

        task = None

        if job is None:
            task = await self._data_faker.tasks.create_with_class(
                CreateIndexTask,
                {"index_id": index_id},
            )

        created_at = created_at or virtool.utils.timestamp()

        async with AsyncSession(self._pg) as session:
            session.add(
                SQLIndex(
                    legacy_id=index_id,
                    version=version,
                    created_at=created_at,
                    manifest=manifest,
                    ready=ready,
                    storage_key=index_id,
                    reference_id=reference.id,
                    user_id=user.id,
                    job_id=job.id if job else None,
                    task_id=task.id if task else None,
                ),
            )
            await session.commit()

        return await self._layer.index.get(index_id)


class OTUsFakerDomain(DataFakerDomain):
    model = OTU

    async def create(self, ref_id: str, user: User, name: str = "") -> OTU:
        """Create a new fake OTU."""
        otu = await self.create_empty(ref_id, user, name)

        isolate = await self._layer.otus.add_isolate(
            otu.id,
            "isolate",
            self._faker.word().capitalize(),
            user.id,
        )

        for segment in otu.otu_schema:
            await self._layer.otus.create_sequence(
                otu.id,
                isolate.id,
                self._faker.accession(),
                self._faker.sentence(),
                self._faker.sequence(),
                user.id,
                self._faker.host(),
                segment.name,
            )

        return await self._layer.otus.get(otu.id)

    async def create_empty(self, ref_id: str, user: User, name: str = "") -> OTU:
        """Create a fake OTU with no isolates."""
        if not name:
            name = self._faker.organism()

        abbreviation = "".join([part[0].upper() for part in name.split(" ")])

        segments = [
            OTUSegment(
                name=self._faker.segment(prefix="RNA"),
                required=True,
                molecule=Molecule.ss_rna,
            )
            for _ in range(self._faker.pyint(1, 3))
        ]

        return await self._layer.otus.create(
            ref_id,
            CreateOTURequest(
                name=name,
                abbreviation=abbreviation,
                schema=segments,
            ),
            user.id,
        )


class TasksFakerDomain(DataFakerDomain):
    model = Task

    async def create(self) -> Task:
        """Create a new fake random task.

        :return: a new fake task
        """
        return await self._layer.tasks.create(
            CloneReferenceTask,
            {},
        )

    async def create_with_class(self, cls: type[BaseTask], context: dict) -> Task:
        """Create a fake task.

        :param cls: the type of task
        :param context: the context required for the task

        :return: a new fake task
        """
        return await self._layer.tasks.create(cls, context)


class UploadsFakerDomain(DataFakerDomain):
    model = Upload

    async def create(
        self,
        user: User,
        upload_type: UploadType = UploadType.reads,
        name: str = "test.fq.gz",
        reserved: bool = False,
    ) -> UploadMinimal:
        """Create a fake upload.

        A completely valid user will be created.

        :param user: the user creating the upload
        :param upload_type: the type of upload
        :param name: the name of the upload
        :param reserved: the reservation status of the upload

        :return: a new fake upload
        """
        if upload_type not in UploadType.to_list():
            upload_type = "reads"

        fake_file_path = example_path / "sample/reads_1.fq.gz"

        upload = await self._layer.uploads.create(
            fake_file_chunker(fake_file_path),
            name,
            upload_type,
            user.id,
        )

        if reserved:
            async with AsyncSession(self._pg) as session:
                await self._layer.uploads.reserve(upload.id, session)
                await session.commit()

        return await self._layer.uploads.get(upload.id)


class UsersFakerDomain(DataFakerDomain):
    model = User

    async def create(
        self,
        handle: str | None = None,
        groups: list[Group] | None = None,
        password: str | None = None,
        primary_group: Group | None = None,
        administrator_role: AdministratorRole | None = None,
    ) -> User:
        """Create a fake user.

        A completely valid user will be created.

        :param handle: the users handle
        :param groups: the groups the user belongs to
        :param password: the users password
        :param primary_group: the users primary group
        :param administrator_role: the users administrator role

        :return: a new fake user
        """
        user = await self._layer.users.create(
            handle or self._faker.profile()["username"],
            password or self._faker.password(),
        )

        if administrator_role:
            user = await self._layer.users.set_administrator_role(
                user.id,
                administrator_role,
            )

        if groups and primary_group:
            return await self._layer.users.update(
                user.id,
                UpdateUserRequest(
                    groups=list({group.id for group in groups} | {primary_group.id}),
                    primary_group=primary_group.id,
                ),
            )

        if groups:
            return await self._layer.users.update(
                user.id,
                UpdateUserRequest(groups=[group.id for group in groups]),
            )

        if primary_group:
            return await self._layer.users.update(
                user.id,
                UpdateUserRequest(
                    groups=[primary_group.id],
                    primary_group=primary_group.id,
                ),
            )

        return user


class SamplesFakerDomain(DataFakerDomain):
    model = Sample

    async def create(
        self,
        user: User,
        uploads: list[Upload] | None = None,
        paired: bool = False,
        ready: bool = False,
        library_type: LibraryType = LibraryType.normal,
    ) -> Sample:
        """Create a fake sample through the samples data layer.

        When ``uploads`` is omitted, one or two read uploads are generated
        automatically and ``paired`` selects between single- and paired-end. When
        ``uploads`` is passed, ``paired`` is ignored and derived from its length.

        When ``ready`` is ``True``, the read files are copied into storage and the
        sample is finalized so it is returned in a completed state.

        :param user: the user creating the sample
        :param uploads: the read uploads to attach; auto-generated when omitted
        :param paired: whether to auto-generate two uploads instead of one
        :param ready: whether to finalize the sample
        :param library_type: the sample's library type
        :return: the created sample
        """
        if uploads is None:
            uploads = [
                await self._data_faker.uploads.create(user)
                for _ in range(2 if paired else 1)
            ]

        paired = len(uploads) == 2

        sample = await self._layer.samples.create(
            CreateSampleRequest(
                name=self._faker.unique.word().capitalize(),
                files=[upload.id for upload in uploads],
                library_type=library_type,
            ),
            user.id,
        )

        if not ready:
            return sample

        storage_id = sample_storage_id(sample.id, None)

        filenames = ["reads_1.fq.gz", "reads_2.fq.gz"] if paired else ["reads_1.fq.gz"]

        for filename in filenames:
            file_path = example_path / "sample" / filename

            await copy_reads_file(self._storage, file_path, filename, storage_id)

            await create_reads_file(
                self._pg,
                file_path.stat().st_size,
                filename,
                filename,
                sample.id,
                storage_id,
            )

        # A real finalized sample has a completed creation job. Mark this
        # sample's job succeeded so a ready sample never leaves a claimable
        # pending job behind.
        async with AsyncSession(self._pg) as session:
            await session.execute(
                update(SQLJob)
                .where(SQLJob.id == sample.job.id)
                .values(
                    state=JobState.SUCCEEDED.value,
                    finished_at=virtool.utils.timestamp(),
                ),
            )
            await session.commit()

        return await self._layer.samples.finalize(
            sample.id,
            create_fake_quality(self._faker),
        )


class SubtractionFakerDomain(DataFakerDomain):
    model = Subtraction

    async def create(
        self,
        user: User,
        upload: Upload,
        name: str = "foo",
        finalized: bool = True,
        upload_files: bool = True,
    ) -> Subtraction:
        """Create a fake subtraction.

        This method will:
        - Create a new subtraction using data_layer.subtractions.create().
        - Upload files using data_layer.subtractions.upload_file().
        - Finalize the subtraction using data_layer.subtractions.finalize().

        :param user the user
        :param upload the fake upload
        :param name the subtraction name
        :param finalized whether the subtraction should be finalized
        :return: the created subtraction
        """
        subtraction = await self._layer.subtractions.create(
            CreateSubtractionRequest(
                name=name,
                nickname="bar",
                upload_id=upload.id,
            ),
            user.id,
        )

        if upload_files:
            for path in sorted(
                (example_path / "subtractions" / "arabidopsis_thaliana").iterdir(),
            ):
                await self._layer.subtractions.upload_file(
                    subtraction.id,
                    path.name,
                    fake_file_chunker(path),
                )

        if not finalized:
            return await self._layer.subtractions.get(subtraction.id)

        return await self._layer.subtractions.finalize(
            subtraction.id,
            FinalizeSubtractionRequest(
                count=1,
                gc=NucleotideComposition(**dict.fromkeys("actgn", 0.2)),
            ),
        )
