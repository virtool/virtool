"""
Easily create fake data.

"""
import asyncio
import gzip
from pathlib import Path
from typing import Dict, Type, AsyncGenerator
from typing import List

import aiofiles
from faker import Faker
from faker.providers import BaseProvider, python, color, lorem, file
from virtool_core.models.group import Group
from virtool_core.models.hmm import HMM
from virtool_core.models.job import Job, JobState
from virtool_core.models.label import Label
from virtool_core.models.roles import AdministratorRole
from virtool_core.models.task import Task
from virtool_core.models.upload import Upload
from virtool_core.models.user import User

from virtool.data.layer import DataLayer
from virtool.example import example_path
from virtool.groups.oas import UpdateGroupRequest, UpdatePermissionsRequest
from virtool.indexes.tasks import EnsureIndexFilesTask
from virtool.jobs.utils import WORKFLOW_NAMES
from virtool.ml.models import MLModel
from virtool.references.tasks import CleanReferencesTask, CloneReferenceTask
from virtool.releases import ReleaseManifestItem
from virtool.subtractions.tasks import AddSubtractionFilesTask
from virtool.tasks.task import BaseTask
from virtool.uploads.models import UploadType
from virtool.uploads.utils import CHUNK_SIZE
from virtool.users.oas import UpdateUserRequest


async def fake_file_chunker(path: Path) -> AsyncGenerator[bytearray, None]:
    """
    Read a chunk of size `CHUNK_SIZE` from a file.

    This is used to hijack the upload process and create fake uploads.

    :param path: the path to the file
    :return: an async generator that yields chunks of the file
    """
    async with aiofiles.open(path, "rb") as f:
        yield await f.read(CHUNK_SIZE)


async def gzip_file_chunker(path: Path) -> AsyncGenerator[bytearray, None]:
    """
    Decompress and Read a chunk of size `CHUNK_SIZE` from a file.

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
            [name.replace("job_", "") for name in WORKFLOW_NAMES], 1
        )[0]


class DataFaker:
    def __init__(self, layer: DataLayer, mongo):
        self.layer = layer

        self.faker = Faker()
        self.faker.seed_instance(0)
        self.faker.add_provider(VirtoolProvider)
        self.faker.add_provider(color)
        self.faker.add_provider(lorem)
        self.faker.add_provider(python)
        self.faker.add_provider(file)

        self.groups = GroupsFakerPiece(self)
        self.hmm = HMMFakerPiece(self)
        self.jobs = JobsFakerPiece(self)
        self.labels = LabelsFakerPiece(self)
        self.ml = MLFakerPiece(self)
        self.tasks = TasksFakerPiece(self)
        self.users = UsersFakerPiece(self)
        self.uploads = UploadsFakerPiece(self)

        self.mongo = mongo


class DataFakerPiece:
    def __init__(self, data_faker: DataFaker):
        self.layer: DataLayer = data_faker.layer
        self.faker = data_faker.faker
        self.history = []


class JobsFakerPiece(DataFakerPiece):
    model = Job

    async def create(
        self,
        user: User,
        archived: bool = False,
        state: JobState | None = None,
        workflow: str | None = None,
    ) -> Job:
        """
        Create a fake job.

        A completely valid job will be created which follows the rules:

        * The job will be in an archive-able state if ``archived`` is ``True``.
        * The job status updates will be in a valid order.

        :param user: the user that created the job
        :param archived: whether the job should be archived
        :param state: the state the most recent status update should have
        :param workflow: the workflow the job is running
        :return:
        """
        if archived and state in [
            JobState.WAITING,
            JobState.PREPARING,
            JobState.RUNNING,
        ]:
            raise ValueError(
                "Cannot create an archived job in the waiting, preparing, or running states"
            )

        job = await self.layer.jobs.create(
            workflow or self.faker.workflow(),
            self.faker.pydict(nb_elements=6, value_types=[str, int, float]),
            user.id,
            0,
        )

        if state:
            target_state = state
        elif archived:
            target_state = self.faker.random_element(
                [
                    JobState.CANCELLED,
                    JobState.COMPLETE,
                    JobState.ERROR,
                    JobState.TERMINATED,
                    JobState.TIMEOUT,
                ]
            )
        else:
            target_state = self.faker.random_element(
                [
                    JobState.CANCELLED,
                    JobState.COMPLETE,
                    JobState.ERROR,
                    JobState.PREPARING,
                    JobState.RUNNING,
                    JobState.TERMINATED,
                    JobState.TIMEOUT,
                    JobState.WAITING,
                ]
            )

        previous_status = job.status[0]
        progress = 0

        while progress <= 50:
            if previous_status.state == target_state:
                break

            if progress == 50:
                next_state = target_state
            elif previous_status.state == JobState.WAITING:
                next_state = JobState.PREPARING
            elif previous_status.state == JobState.PREPARING:
                next_state = JobState.RUNNING
            else:
                next_state = self.faker.random_element([JobState.RUNNING, target_state])

            progress += 10
            step_name = self.faker.pystr()

            previous_status = await self.layer.jobs.push_status(
                job.id,
                state=next_state,
                stage=step_name,
                step_name=step_name,
                step_description=self.faker.pystr(),
                error=None,
                progress=100 if next_state == JobState.COMPLETE else progress,
            )

        if archived:
            return await self.layer.jobs.archive(job.id)

        return await self.layer.jobs.get(job.id)


class GroupsFakerPiece(DataFakerPiece):
    model = Group

    async def create(self, permissions: UpdatePermissionsRequest | None = None):
        name = "contains spaces"

        while " " in name:
            name = self.faker.profile()["job"].lower() + "s"

        group = await self.layer.groups.create(name)

        if permissions:
            group = await self.layer.groups.update(
                group.id, UpdateGroupRequest(permissions=permissions)
            )

        return group


class HMMFakerPiece(DataFakerPiece):
    model = HMM

    async def create(self, mongo):
        hmm_id = "".join(self.faker.mongo_id())
        faker = self.faker

        document = await mongo.hmm.insert_one(
            {
                "entries": [
                    {
                        "accession": faker.pystr(),
                        "gi": faker.pystr(),
                        "name": faker.pystr(),
                        "organism": faker.pystr(),
                    }
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
            }
        )

        return HMM(**document)


class LabelsFakerPiece(DataFakerPiece):
    model = Label

    async def create(self):
        return await self.layer.labels.create(
            self.faker.word().capitalize(),
            self.faker.hex_color(),
            self.faker.sentence(),
        )


class MLFakerPiece(DataFakerPiece):
    model = MLModel

    async def populate(self):
        """Populate the ML model collection with fake data."""
        return await self.layer.ml.load(
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
        """
        Create a fake release manifest item like you would receive from the
        www.virtool.ca releases endpoints

        """
        return ReleaseManifestItem(
            id=self.faker.pyint(),
            body=self.faker.paragraph(),
            content_type=self.faker.pystr(),
            download_url=self.faker.url(),
            filename=self.faker.pystr(),
            html_url=self.faker.url(),
            name=self.faker.pystr(),
            prerelease=self.faker.pybool(),
            published_at=self.faker.date_time(),
            size=self.faker.pyint(),
        )


class TasksFakerPiece(DataFakerPiece):
    model = Task

    async def create(self):
        return await self.layer.tasks.create(
            self.faker.random_element(
                [
                    EnsureIndexFilesTask,
                    AddSubtractionFilesTask,
                    CloneReferenceTask,
                    CleanReferencesTask,
                ]
            ),
            {},
        )

    async def create_with_class(self, cls: Type[BaseTask], context: Dict):
        return await self.layer.tasks.create(cls, context)


class UploadsFakerPiece(DataFakerPiece):
    model = Upload

    async def create(
        self,
        user: User,
        upload_type: UploadType = UploadType.reads,
        name: str = "test.fq.gz",
        reserved: bool = False,
    ) -> Upload:
        if upload_type not in UploadType.to_list():
            upload_type = "reads"

        fake_file_path = example_path / "reads/single.fq.gz"

        upload = await self.layer.uploads.create(
            fake_file_chunker(fake_file_path), name, upload_type, user.id
        )

        if reserved:
            await self.layer.uploads.reserve(upload.id)

        return await self.layer.uploads.get(upload.id)


class UsersFakerPiece(DataFakerPiece):
    model = User

    async def create(
        self,
        handle: str | None = None,
        groups: List[Group] | None = None,
        password: str | None = None,
        primary_group: Group | None = None,
        administrator_role: AdministratorRole | None = None,
    ):
        user = await self.layer.users.create(
            handle or self.faker.profile()["username"],
            password or self.faker.password(),
        )

        if administrator_role:
            user = await self.layer.users.set_administrator_role(
                user.id, administrator_role
            )

        if groups and primary_group:
            return await self.layer.users.update(
                user.id,
                UpdateUserRequest(
                    groups=list({group.id for group in groups} | {primary_group.id})
                ),
            )

        elif groups:
            return await self.layer.users.update(
                user.id,
                UpdateUserRequest(groups=[group.id for group in groups]),
            )

        elif primary_group:
            await self.layer.users.update(
                user.id,
                UpdateUserRequest(
                    groups=[primary_group.id], primary_group=primary_group.id
                ),
            )

        return user
