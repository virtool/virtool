"""Easily create fake data."""

import asyncio
import datetime
import gzip
from collections.abc import AsyncGenerator
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
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.layer import DataLayer
from virtool.example import example_path
from virtool.fake.providers import OrganismProvider, SegmentProvider, SequenceProvider
from virtool.groups.models import Group
from virtool.groups.oas import PermissionsUpdate, UpdateGroupRequest
from virtool.groups.pg import SQLGroup
from virtool.hmm.models import HMM
from virtool.jobs.models import Job, JobState
from virtool.jobs.utils import WORKFLOW_NAMES
from virtool.labels.models import Label
from virtool.ml.models import MLModel
from virtool.ml.tasks import MLModelsSyncTask
from virtool.models.enums import Molecule
from virtool.models.roles import AdministratorRole
from virtool.mongo.core import Mongo
from virtool.otus.models import OTU, OTUSegment
from virtool.otus.oas import CreateOTURequest
from virtool.redis import Redis
from virtool.references.tasks import (
    CloneReferenceTask,
    ReferenceReleasesRefreshTask,
    ReferencesCleanTask,
)
from virtool.releases import ReleaseManifestItem
from virtool.subtractions.models import Subtraction
from virtool.subtractions.oas import (
    CreateSubtractionRequest,
    FinalizeSubtractionRequest,
    NucleotideComposition,
)
from virtool.tasks.models import Task
from virtool.tasks.task import BaseTask
from virtool.uploads.models import Upload
from virtool.uploads.sql import UploadType
from virtool.uploads.utils import CHUNK_SIZE
from virtool.users.models import User
from virtool.users.oas import UpdateUserRequest


async def fake_file_chunker(path: Path) -> AsyncGenerator[bytearray, None]:
    """Read a chunk of size `CHUNK_SIZE` from a file.

    This is used to hijack the upload process and create fake uploads.

    :param path: the path to the file
    :return: an async generator that yields chunks of the file
    """
    with open(path, "rb") as f:
        yield f.read(CHUNK_SIZE)


async def gzip_file_chunker(path: Path) -> AsyncGenerator[bytearray, None]:
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
    def __init__(self, layer: DataLayer, mongo: Mongo, pg: AsyncEngine, redis: Redis):
        self.layer = layer
        self.mongo = mongo
        self.pg = pg
        self.redis = redis

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
        self.jobs = JobsFakerDomain(self)
        self.labels = LabelsFakerDomain(self)
        self.ml = MLFakerDomain(self)
        self.otus = OTUsFakerDomain(self)
        self.subtractions = SubtractionFakerDomain(self)
        self.tasks = TasksFakerDomain(self)
        self.users = UsersFakerDomain(self)
        self.uploads = UploadsFakerDomain(self)

        self.mongo = mongo


class DataFakerDomain:
    def __init__(self, data_faker: DataFaker):
        self._faker = data_faker.faker
        self._layer: DataLayer = data_faker.layer
        self._mongo = data_faker.mongo
        self._pg = data_faker.pg
        self._redis = data_faker.redis

        self.history = []


class JobsFakerDomain(DataFakerDomain):
    model = Job

    async def create(
        self,
        user: User,
        pinged_at: datetime.datetime | None = None,
        retries: int = 0,
        state: JobState | None = None,
        workflow: str | None = None,
    ) -> Job:
        """Create a fake job.

        A job will be created with status updates in a valid order.

        :param user: the user that created the job
        :param pinged_at: the time the job was last pinged.
        :param retries: the number of retries the job has undergone
        :param state: the state the most recent status update should have
        :param workflow: the workflow the job is running
        :return:
        """
        job = await self._layer.jobs.create(
            (workflow or self._faker.workflow()).replace("jobs_", ""),
            self._faker.pydict(nb_elements=6, value_types=[str, int, float]),
            user.id,
            0,
        )

        if state:
            target_state = state
        else:
            target_state = self._faker.random_element(
                [
                    JobState.CANCELLED,
                    JobState.COMPLETE,
                    JobState.ERROR,
                    JobState.PREPARING,
                    JobState.RUNNING,
                    JobState.TERMINATED,
                    JobState.TIMEOUT,
                    JobState.WAITING,
                ],
            )

        if target_state != JobState.WAITING:
            removed_count = await self._redis.lrem(f"jobs_{job.workflow}", 1, job.id)

            if removed_count == 0:
                raise ValueError(
                    f"Job ID {job.id} not found in Redis list for workflow {job.workflow}.",
                )

            job = await self._layer.jobs.acquire(job.id)

        previous_status = job.status[-1]
        progress = 0

        while progress <= 50:
            if previous_status.state is target_state:
                break

            if progress == 50:
                next_state = target_state
            elif previous_status.state == JobState.WAITING:
                next_state = JobState.PREPARING
            elif previous_status.state == JobState.PREPARING:
                next_state = JobState.RUNNING
            else:
                next_state = self._faker.random_element(
                    [JobState.RUNNING, target_state],
                )

            progress += 10
            step_name = self._faker.pystr()

            previous_status = await self._layer.jobs.push_status(
                job.id,
                state=next_state,
                stage=step_name,
                step_name=step_name,
                step_description=self._faker.pystr(),
                error=None,
                progress=100 if next_state == JobState.COMPLETE else progress,
            )

        if target_state != JobState.WAITING and pinged_at is None:
            pinged_at = arrow.utcnow().shift(minutes=-1).naive

        if pinged_at:
            await self._mongo.jobs.update_one(
                {"_id": job.id},
                {
                    "$set": {"ping": {"pinged_at": pinged_at}},
                },
            )

        if retries > 0:
            await self._mongo.jobs.update_one(
                {"_id": job.id},
                {
                    "$set": {"retries": retries},
                },
            )

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

    async def create(self, mongo: Mongo) -> HMM:
        """Create a new fake hmm.

        :param mongo: the mongo DB connection

        :return: a new fake hmm
        """
        hmm_id = "".join(self._faker.mongo_id())
        faker = self._faker

        document = await mongo.hmm.insert_one(
            {
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
                "_id": hmm_id,
                "cluster": faker.pyint(),
                "count": faker.pyint(),
                "families": {faker.pystr(): faker.pyint()},
                "names": [faker.pystr()],
            },
        )

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


class MLFakerDomain(DataFakerDomain):
    model = MLModel

    async def populate(self):
        """Populate the ML model collection with fake data."""
        return await self._layer.ml.load(
            {
                "ml-plant-viruses": [
                    self.create_release_manifest_item() for _ in range(3)
                ],
                "ml-insect-viruses": [
                    self.create_release_manifest_item() for _ in range(3)
                ],
            },
        )

    def create_release_manifest_item(self) -> ReleaseManifestItem:
        """Create a fake release manifest item like you would receive from the
        www.virtool.ca releases endpoints

        """
        return ReleaseManifestItem(
            id=self._faker.pyint(),
            body=self._faker.paragraph(),
            content_type=self._faker.pystr(),
            download_url=self._faker.url(),
            filename=self._faker.pystr(),
            html_url=self._faker.url(),
            name=self._faker.pystr(),
            prerelease=self._faker.pybool(),
            published_at=self._faker.date_time(),
            size=self._faker.pyint(),
        )


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
            self._faker.random_element(
                [
                    ReferenceReleasesRefreshTask,
                    MLModelsSyncTask,
                    CloneReferenceTask,
                    ReferencesCleanTask,
                ],
            ),
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
    ) -> UploadType:
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

        fake_file_path = example_path / "reads/single.fq.gz"

        upload = await self._layer.uploads.create(
            fake_file_chunker(fake_file_path),
            name,
            upload_type,
            user.id,
        )

        if reserved:
            await self._layer.uploads.reserve(upload.id)

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


class SubtractionFakerDomain(DataFakerDomain):
    model = Subtraction

    async def create(
        self,
        user: User,
        upload: Upload,
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
        :param finalized whether the subtraction should be finalized
        :return: the created subtraction
        """
        subtraction = await self._layer.subtractions.create(
            CreateSubtractionRequest(
                name="foo",
                nickname="bar",
                upload_id=upload.id,
            ),
            user.id,
            0,
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
                gc=NucleotideComposition(**{k: 0.2 for k in "actgn"}),
            ),
        )
