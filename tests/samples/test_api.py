import asyncio
import gzip
import io
from datetime import datetime
from http import HTTPStatus
from pathlib import Path
from typing import NamedTuple

import arrow
import pytest
from aiohttp.test_utils import make_mocked_coro
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

import virtool.utils
from tests.fixtures.client import ClientSpawner, JobClientSpawner, VirtoolTestClient
from virtool.analyses.sql import SQLAnalysis, SQLAnalysisSubtraction
from virtool.data.layer import DataLayer
from virtool.data.utils import get_data_from_app
from virtool.fake.next import DataFaker
from virtool.jobs.models import CreateJobClaimRequest, JobState, Workflow
from virtool.jobs.pg import SQLJob
from virtool.models.enums import LibraryType, Permission
from virtool.mongo.core import Mongo
from virtool.pg.utils import get_row_by_id
from virtool.references.models import Reference
from virtool.references.sql import SQLReference
from virtool.samples.models import Sample, WorkflowState
from virtool.samples.sql import (
    SQLLegacySample,
    SQLLegacySampleLabel,
    SQLLegacySampleSubtraction,
    SQLSampleArtifact,
    SQLSampleReads,
)
from virtool.samples.utils import sample_file_key, sample_storage_id
from virtool.settings.oas import UpdateSettingsRequest
from virtool.subtractions.pg import SQLSubtraction
from virtool.uploads.sql import SQLUpload
from virtool.users.models import User
from virtool.users.oas import UpdateUserRequest


async def insert_pg_sample(
    session: AsyncSession,
    document: dict,
    group_id: int | None = None,
) -> SQLLegacySample:
    """Insert the ``legacy_samples`` row and label join rows mirroring a Mongo sample.

    Sample reads are served from Postgres, so tests that seed Mongo directly must seed
    the matching Postgres rows too.
    """
    created_at = document["created_at"]

    if created_at.tzinfo is not None:
        created_at = created_at.replace(tzinfo=None)

    sample = SQLLegacySample(
        legacy_id=document["_id"],
        name=document["name"],
        host=document.get("host", ""),
        isolate=document.get("isolate", ""),
        locale=document.get("locale", ""),
        notes=document.get("notes", ""),
        library_type=document["library_type"],
        format=document.get("format", "fastq"),
        group_id=group_id,
        quality=document.get("quality"),
        created_at=created_at,
        paired=document.get("paired", False),
        ready=document.get("ready", False),
        hold=document.get("hold", True),
        is_legacy=document.get("is_legacy", False),
        all_read=document.get("all_read", False),
        all_write=document.get("all_write", False),
        group_read=document.get("group_read", False),
        group_write=document.get("group_write", False),
        user_id=document["user"]["id"],
        job_id=document["job"]["id"] if document.get("job") else None,
    )

    session.add(sample)
    await session.flush()

    for label_id in document.get("labels", []):
        session.add(SQLLegacySampleLabel(sample_id=sample.id, label_id=label_id))

    for subtraction_id in document.get("subtractions", []):
        session.add(
            SQLLegacySampleSubtraction(
                sample_id=sample.id,
                subtraction_id=subtraction_id,
            ),
        )

    return sample


async def update_pg_sample_rights(
    pg: AsyncEngine,
    legacy_id: str,
    **values,
) -> None:
    """Apply a rights change to the Postgres ``legacy_samples`` row for a test.

    Read paths resolve rights from Postgres, so tests that mutate rights in Mongo must
    mirror the change here.
    """
    async with AsyncSession(pg) as session:
        await session.execute(
            update(SQLLegacySample)
            .where(SQLLegacySample.legacy_id == legacy_id)
            .values(**values),
        )
        await session.commit()


async def _ensure_legacy_sample_id(session: AsyncSession, legacy_id: str) -> int:
    """Insert a ``legacy_samples`` row for ``legacy_id`` if absent and return its id.

    Sample file rows are keyed by an integer FK to ``legacy_samples``, so tests that
    insert artifact/reads rows directly need a parent legacy sample to point at.
    """
    sample_id = (
        await session.execute(
            select(SQLLegacySample.id).where(SQLLegacySample.legacy_id == legacy_id),
        )
    ).scalar()

    if sample_id is None:
        sample = SQLLegacySample(
            legacy_id=legacy_id,
            name=legacy_id,
            library_type=LibraryType.normal.value,
            created_at=datetime(2015, 10, 6, 20, 0),
        )
        session.add(sample)
        await session.flush()
        sample_id = sample.id

    return sample_id


class MockJobInterface:
    def __init__(self):
        self.enqueue = make_mocked_coro()


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

    document = {
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
    }

    await mongo.samples.insert_one(document)

    async with AsyncSession(pg) as session:
        await insert_pg_sample(session, document)
        await session.commit()


class SampleData(NamedTuple):
    """Identifiers for the sample seeded by :func:`get_sample_data`."""

    id: int
    unattached_subtraction_id: int


@pytest.fixture
async def get_sample_data(
    mongo: "Mongo",
    fake: DataFaker,
    pg: AsyncEngine,
    static_time,
) -> SampleData:
    """Set up the ``test`` sample and return its integer id and an unattached subtraction.

    The sample is attached to ``apple`` and ``pear``; ``peach`` exists but is not
    attached, so edit tests can switch the sample's subtractions to it.
    """
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
    peach = await fake.subtractions.create(
        user=user, upload=upload, name="Peach", upload_files=False, finalized=False
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
            "ready": True,
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
            host="",
            isolate="",
            locale="",
            notes="",
            library_type=LibraryType.normal.value,
            format="fastq",
            quality=None,
            created_at=static_time.datetime,
            ready=True,
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

        sample_id = legacy.id

        session.add_all(
            [
                SQLLegacySampleLabel(sample_id=legacy.id, label_id=label.id),
                SQLLegacySampleSubtraction(
                    sample_id=legacy.id,
                    subtraction_id=apple.id,
                ),
                SQLLegacySampleSubtraction(
                    sample_id=legacy.id,
                    subtraction_id=pear.id,
                ),
                SQLSampleArtifact(
                    name="reference.fa.gz",
                    sample="test",
                    sample_id=legacy.id,
                    type="fasta",
                    name_on_disk="reference.fa.gz",
                    size=34879234,
                ),
                SQLSampleReads(
                    name="reads_1.fq.gz",
                    name_on_disk="reads_1.fq.gz",
                    sample="test",
                    sample_id=legacy.id,
                    size=2903109210,
                    uploaded_at=static_time.datetime,
                    upload=None,
                ),
            ],
        )
        await session.commit()

    return SampleData(id=sample_id, unattached_subtraction_id=peach.id)


class TestFind:
    client: VirtoolTestClient
    single_sample_owner: User
    two_sample_owner: User

    @pytest.fixture(autouse=True)
    async def _setup(
        self,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        spawn_client: ClientSpawner,
        static_time,
    ):
        """Seed three readable samples: one owned by ``user_1`` and two by ``user_2``."""
        user_1 = await fake.users.create()
        user_2 = await fake.users.create()

        label_1 = await fake.labels.create()
        label_2 = await fake.labels.create()
        label_3 = await fake.labels.create()

        job = await fake.jobs.create(user_1, workflow="create_sample")

        client = await spawn_client(authenticated=True)

        documents = [
            {
                "_id": "beb1eb10",
                "all_read": True,
                "created_at": arrow.get(static_time.datetime).shift(hours=1).datetime,
                "foobar": True,
                "host": "",
                "isolate": "Thing",
                "job": {"id": job.id},
                "labels": [label_1.id, label_2.id],
                "library_type": "normal",
                "name": "16GVP042",
                "notes": "",
                "ready": True,
                "user": {"id": user_1.id},
            },
            {
                "user": {"id": user_2.id},
                "host": "",
                "foobar": True,
                "isolate": "Test",
                "library_type": "srna",
                "created_at": arrow.get(static_time.datetime).datetime,
                "_id": "72bb8b31",
                "job": None,
                "name": "16GVP043",
                "all_read": True,
                "ready": True,
                "labels": [label_1.id],
                "notes": "This is a good sample.",
            },
            {
                "user": {"id": user_2.id},
                "host": "",
                "library_type": "amplicon",
                "notes": "",
                "foobar": True,
                "ready": True,
                "isolate": "",
                "created_at": arrow.get(static_time.datetime).shift(hours=2).datetime,
                "_id": "cb400e6d",
                "job": None,
                "name": "16SPP044",
                "all_read": True,
                "labels": [label_3.id],
            },
        ]

        await mongo.samples.insert_many(documents, session=None)

        async with AsyncSession(pg) as session:
            samples = {
                document["_id"]: await insert_pg_sample(session, document)
                for document in documents
            }

            # ``beb1eb10`` has completed nuvs and pathoscope analyses so its workflow
            # tags derive to ready; the other samples have no analyses.
            for workflow in ("nuvs", "pathoscope"):
                session.add(
                    SQLAnalysis(
                        legacy_id=f"beb1eb10_{workflow}",
                        created_at=static_time.datetime,
                        updated_at=static_time.datetime,
                        workflow=workflow,
                        ready=True,
                        sample="beb1eb10",
                        sample_id=samples["beb1eb10"].id,
                        reference="ref",
                        index="index",
                        user_id=user_1.id,
                    ),
                )

            await session.commit()

        self.client = client
        self.single_sample_owner = user_1
        self.two_sample_owner = user_2

    @pytest.mark.parametrize("find", [None, "gv", "sp"])
    async def test_term(
        self,
        find: str | None,
        snapshot: SnapshotAssertion,
    ):
        path = "/samples"

        if find is not None:
            path += f"?find={find}"

        resp = await self.client.get(path)
        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot

    @pytest.mark.parametrize(("per_page", "page"), [(None, None), (2, 1), (2, 2)])
    async def test_page_per_page(
        self,
        page: int | None,
        per_page: int | None,
        snapshot: SnapshotAssertion,
    ):
        query = []

        if per_page is not None:
            query.append(f"per_page={per_page}")

        path = "/samples"

        if page is not None:
            query.append(f"page={page}")
            path += f"?{'&'.join(query)}"

        resp = await self.client.get(path)
        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot

    @pytest.mark.parametrize("labels", [None, [3], [2, 3], [0]])
    async def test_labels(
        self,
        labels: list[int] | None,
        snapshot: SnapshotAssertion,
    ):
        path = "/samples"

        if labels is not None:
            query = "&label=".join(str(label) for label in labels)
            path += f"?label={query}"

        resp = await self.client.get(path)
        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot

    @pytest.mark.parametrize(
        "workflows",
        [
            None,
            ["nuvs:ready", "pathoscope:ready"],
            ["pathoscope:ready", "pathoscope:none"],
            ["nuvs:none", "pathoscope:none", "pathoscope:ready"],
            # ``nuvs`` is incompatible with the amplicon sample, so ``nuvs:none``
            # matches only the srna sample, never the amplicon one.
            ["nuvs:none"],
            # ``aodp`` is only compatible with amplicon libraries, so ``aodp:none``
            # matches the amplicon sample alone rather than every sample lacking an
            # aodp analysis.
            ["aodp:none"],
        ],
    )
    async def test_workflows(
        self,
        workflows: list[str] | None,
        snapshot: SnapshotAssertion,
    ):
        path = "/samples"

        if workflows is not None:
            workflows_query = "&workflows=".join(workflow for workflow in workflows)
            path += f"?workflows={workflows_query}"

        resp = await self.client.get(path)
        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot

    async def test_user(self):
        """A single ``user`` matches only that user's samples."""
        resp = await self.client.get(f"/samples?user={self.single_sample_owner.id}")
        assert resp.status == HTTPStatus.OK

        body = await resp.json()

        assert body["found_count"] == 1
        assert body["total_count"] == 3
        assert [document["name"] for document in body["documents"]] == ["16GVP042"]

    async def test_user_multiple(self):
        """Repeating ``user`` matches samples owned by any of the given users."""
        resp = await self.client.get(
            f"/samples?user={self.single_sample_owner.id}"
            f"&user={self.two_sample_owner.id}",
        )
        assert resp.status == HTTPStatus.OK

        body = await resp.json()

        assert body["found_count"] == 3
        assert {document["name"] for document in body["documents"]} == {
            "16GVP042",
            "16GVP043",
            "16SPP044",
        }

    async def test_user_owns_no_samples(self, fake: DataFaker):
        """A user that owns no samples matches nothing rather than erroring."""
        stranger = await fake.users.create()

        resp = await self.client.get(f"/samples?user={stranger.id}")
        assert resp.status == HTTPStatus.OK

        body = await resp.json()

        assert body["documents"] == []
        assert body["found_count"] == 0
        assert body["total_count"] == 3

    async def test_user_cannot_reveal_unreadable_samples(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
        static_time,
    ):
        """Filtering by a user does not expose that user's unreadable samples."""
        private_owner = await fake.users.create()

        async with AsyncSession(pg) as session:
            session.add(
                SQLLegacySample(
                    legacy_id="other_private",
                    name="other_private",
                    library_type=LibraryType.normal.value,
                    created_at=static_time.datetime,
                    all_read=False,
                    all_write=False,
                    group_read=False,
                    group_write=False,
                    user_id=private_owner.id,
                ),
            )
            await session.commit()

        resp = await self.client.get(f"/samples?user={private_owner.id}")
        assert resp.status == HTTPStatus.OK
        assert (await resp.json())["documents"] == []


class TestGet:
    async def test_administrator(
        self,
        get_sample_data,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
    ):
        """Test that a sample can be retrieved by an administrator."""
        client = await spawn_client(administrator=True, authenticated=True)

        resp = await client.get(f"/samples/{get_sample_data.id}")

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot(name="resp")

    async def test_owner(
        self,
        get_sample_data,
        snapshot: SnapshotAssertion,
        mongo: Mongo,
        pg: AsyncEngine,
        spawn_client: ClientSpawner,
    ):
        """Test that a sample can be retrieved by its owner."""
        client = await spawn_client(authenticated=True)

        await mongo.samples.update_one(
            {"_id": "test"},
            {
                "$set": {
                    "all_read": False,
                    "group_read": False,
                    "group": "none",
                    "user": {"id": client.user.id},
                },
            },
        )
        await update_pg_sample_rights(
            pg,
            "test",
            all_read=False,
            group_read=False,
            group_id=None,
            user_id=client.user.id,
        )

        resp = await client.get(f"/samples/{get_sample_data.id}")

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot(name="resp")

    async def test_all_read(
        self,
        fake: DataFaker,
        get_sample_data,
        snapshot: SnapshotAssertion,
        mongo: Mongo,
        pg: AsyncEngine,
        spawn_client: ClientSpawner,
    ):
        """Test that a sample can be retrieved any user when ``all_read`` is ``True`` on
        the sample.
        """
        client = await spawn_client(authenticated=True)

        user = await fake.users.create()

        await mongo.samples.update_one(
            {"_id": "test"},
            {
                "$set": {
                    "all_read": True,
                    "group_read": False,
                    "group": "none",
                    "user": {"id": user.id},
                },
            },
        )
        await update_pg_sample_rights(
            pg,
            "test",
            all_read=True,
            group_read=False,
            group_id=None,
            user_id=user.id,
        )

        resp = await client.get(f"/samples/{get_sample_data.id}")

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot(name="resp")

    @pytest.mark.parametrize("is_member", [True, False])
    async def test_group_read(
        self,
        is_member: bool,
        fake: DataFaker,
        get_sample_data,
        mongo: Mongo,
        pg: AsyncEngine,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
    ):
        """Test that a sample can be retrieved by the client user when they are a member
        the sample's ``group`` and ``group_read`` is ``True``.
        """
        client = await spawn_client(authenticated=True)

        group = await fake.groups.create()
        user = await fake.users.create()

        if is_member:
            await get_data_from_app(client.app).users.update(
                client.user.id,
                UpdateUserRequest(groups=[group.id]),
            )

        await mongo.samples.update_one(
            {"_id": "test"},
            {
                "$set": {
                    "all_read": False,
                    "all_write": False,
                    "group_read": True,
                    "group": group.id,
                    "user": {"id": user.id},
                },
            },
        )
        await update_pg_sample_rights(
            pg,
            "test",
            all_read=False,
            all_write=False,
            group_read=True,
            group_id=group.id,
            user_id=user.id,
        )

        resp = await client.get(f"/samples/{get_sample_data.id}")

        assert resp.status == (200 if is_member else 403)
        assert await resp.json() == snapshot(name="resp")


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

        resp = await client.post("/samples", data)

        assert resp.status == 201
        assert await resp.json() == snapshot_recent(name="resp")

    async def test_name_exists(
        self,
        fake: DataFaker,
        snapshot,
        pg: AsyncEngine,
        spawn_client: ClientSpawner,
    ):
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_sample],
        )

        user = await fake.users.create()
        upload = await fake.uploads.create(user=user)

        apple = await fake.subtractions.create(
            user=user, upload=upload, name="Apple", upload_files=False, finalized=False
        )

        async with AsyncSession(pg) as session:
            session.add(
                SQLLegacySample(
                    name="Foobar",
                    library_type=LibraryType.normal.value,
                    created_at=datetime(2015, 10, 6, 20, 0),
                    ready=True,
                ),
            )

            await session.commit()

        resp = await client.post(
            "/samples",
            {
                "name": "Foobar",
                "files": [upload.id],
                "subtractions": [apple.id],
            },
        )

        assert resp.status == 400
        assert await resp.json() == snapshot(name="json")

    @pytest.mark.parametrize("error", [None, "400"])
    async def test_force_choice(
        self,
        error: str | None,
        fake: DataFaker,
        resp_is,
        spawn_client: ClientSpawner,
    ):
        """Test that when ``force_choice`` is enabled, a request with no group field passed
        results in an error response, that "" is accepted as a valid user group and
        that valid user groups are accepted as expected

        """
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_sample],
        )

        group = await fake.groups.create()

        user = await fake.users.create()
        upload = await fake.uploads.create(user=user)

        apple = await fake.subtractions.create(
            user=user, upload=upload, name="Apple", upload_files=False, finalized=False
        )

        await get_data_from_app(client.app).settings.update(
            UpdateSettingsRequest(sample_group="force_choice"),
        )

        data = {
            "name": "Foobar",
            "files": [upload.id],
            "subtractions": [apple.id],
        }

        if error is None:
            data["group"] = group.id
            resp = await client.post("/samples", data)
            assert resp.status == 201
        else:
            resp = await client.post("/samples", data)
            await resp_is.bad_request(resp, "Group value required for sample creation")

    async def test_group_dne(
        self,
        fake: DataFaker,
        resp_is,
        spawn_client: ClientSpawner,
    ):
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_sample],
        )

        await get_data_from_app(client.app).settings.update(
            UpdateSettingsRequest(sample_group="force_choice"),
        )

        user = await fake.users.create()
        upload = await fake.uploads.create(user=user)

        apple = await fake.subtractions.create(
            user=user, upload=upload, name="Apple", upload_files=False, finalized=False
        )

        resp = await client.post(
            "/samples",
            {
                "name": "Foobar",
                "files": [upload.id],
                "subtractions": [apple.id],
                "group": 5,
            },
        )

        await resp_is.bad_request(resp, "Group does not exist")

    async def test_subtraction_dne(
        self,
        fake: DataFaker,
        resp_is,
        spawn_client: ClientSpawner,
    ):
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_sample],
        )

        upload = await fake.uploads.create(user=await fake.users.create())

        resp = await client.post(
            "/samples",
            {"name": "Foobar", "files": [upload.id], "subtractions": [999]},
        )

        await resp_is.bad_request(resp, "Subtractions do not exist: 999")

    @pytest.mark.parametrize("one_exists", [True, False])
    async def test_file_dne(
        self,
        one_exists: bool,
        fake: DataFaker,
        spawn_client: ClientSpawner,
        resp_is,
    ):
        """Test that a ``404`` is returned if one or more of the file ids passed in
        ``files`` do not exist.

        """
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_sample],
        )

        user = await fake.users.create()
        upload = await fake.uploads.create(user=user)

        apple = await fake.subtractions.create(
            user=user, upload=upload, name="Apple", upload_files=False, finalized=False
        )

        if one_exists:
            files = [upload.id, 21]
        else:
            files = [20, 21]

        resp = await client.post(
            "/samples",
            {
                "name": "Foobar",
                "files": files,
                "subtractions": [apple.id],
            },
        )

        await resp_is.bad_request(resp, "File does not exist")

    async def test_duplicate_file(
        self,
        fake: DataFaker,
        spawn_client: ClientSpawner,
        resp_is,
    ):
        """Test that the same upload cannot be passed twice in ``files``."""
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_sample],
        )

        upload = await fake.uploads.create(user=await fake.users.create())

        resp = await client.post(
            "/samples",
            {"name": "Foobar", "files": [upload.id, upload.id]},
        )

        await resp_is.bad_request(resp, "File is duplicated")

    async def test_label_dne(
        self,
        fake: DataFaker,
        resp_is,
        spawn_client: ClientSpawner,
    ):
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_sample],
        )

        upload = await fake.uploads.create(user=await fake.users.create())

        resp = await client.post(
            "/samples",
            {"name": "Foobar", "files": [upload.id], "labels": [1]},
        )

        await resp_is.bad_request(resp, "Labels do not exist: [1]")


class TestEdit:
    async def test_ok(
        self,
        get_sample_data: SampleData,
        snapshot,
        spawn_client: ClientSpawner,
    ):
        """Test that an existing sample can be edited correctly."""
        client = await spawn_client(administrator=True, authenticated=True)

        resp = await client.patch(
            f"/samples/{get_sample_data.id}",
            {
                "name": "test_sample",
                "subtractions": [get_sample_data.unattached_subtraction_id],
                "labels": [1],
                "notes": "This is a test.",
            },
        )

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot

    async def test_name_exists(
        self,
        resp_is,
        pg: AsyncEngine,
        spawn_client: ClientSpawner,
    ):
        """Test that a ``bad_request`` is returned if the sample name passed in ``name``
        already exists.
        """
        client = await spawn_client(administrator=True, authenticated=True)

        async with AsyncSession(pg) as session:
            renamed = SQLLegacySample(
                name="Foo",
                library_type=LibraryType.normal.value,
                created_at=datetime(2015, 10, 6, 20, 0),
                all_read=True,
                all_write=True,
                ready=True,
            )

            session.add(renamed)
            session.add(
                SQLLegacySample(
                    name="Bar",
                    library_type=LibraryType.normal.value,
                    created_at=datetime(2015, 10, 6, 20, 0),
                    ready=True,
                ),
            )

            await session.flush()

            renamed_id = renamed.id

            await session.commit()

        resp = await client.patch(f"/samples/{renamed_id}", {"name": "Bar"})

        assert resp.status == 400
        await resp_is.bad_request(resp, "Sample name is already in use")

    async def test_label_exists(
        self,
        snapshot,
        mongo: Mongo,
        pg: AsyncEngine,
        spawn_client: ClientSpawner,
    ):
        """Test that a ``bad_request`` is returned if the label passed in ``labels`` does
        not exist.

        """
        client = await spawn_client(administrator=True, authenticated=True)

        await mongo.samples.insert_one(
            {
                "_id": "foo",
                "name": "Foo",
                "all_read": True,
                "all_write": True,
                "subtractions": [],
                "user": {"id": "test"},
                "labels": [2, 3],
                "ready": True,
            },
        )

        async with AsyncSession(pg) as session:
            foo_id = await _ensure_legacy_sample_id(session, "foo")
            await session.commit()

        resp = await client.patch(f"/samples/{foo_id}", {"labels": [1]})

        assert resp.status == 400
        assert await resp.json() == snapshot(name="json")

    async def test_subtraction_exists(
        self,
        fake: DataFaker,
        snapshot,
        mongo: Mongo,
        pg: AsyncEngine,
        spawn_client: ClientSpawner,
    ):
        """Test that a ``bad_request`` is returned if the subtraction passed in
        ``subtractions`` does not exist.

        """
        client = await spawn_client(administrator=True, authenticated=True)

        user = await fake.users.create()
        upload = await fake.uploads.create(user=user)

        foo = await fake.subtractions.create(
            user=user, upload=upload, name="Foo", upload_files=False, finalized=False
        )

        await mongo.samples.insert_one(
            {
                "_id": "test",
                "name": "Test",
                "all_read": True,
                "all_write": True,
                "ready": True,
                "subtractions": [],
                "user": {"id": user.id},
            },
        )

        async with AsyncSession(pg) as session:
            sample_id = await _ensure_legacy_sample_id(session, "test")
            await session.commit()

        resp = await client.patch(
            f"/samples/{sample_id}",
            {"subtractions": [foo.id, 999]},
        )

        assert resp.status == 400
        assert await resp.json() == snapshot(name="json")


class TestFinalize:
    """Test that sample can be finalized using the Jobs API."""

    async def test_quality(
        self,
        resp_is,
        snapshot,
        spawn_job_client,
        get_sample_ready_false,
    ):
        client = await spawn_job_client(authenticated=True)

        json = {
            "quality": {
                "bases": [[1543]],
                "composition": [[6372]],
                "count": 7069,
                "encoding": "OuBQPPuwYimrxkNpPWUx",
                "gc": 34222440,
                "length": [3237],
                "sequences": [7091],
            },
        }

        resp = await client.patch("/samples/test", json=json)

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot

        resp = await client.patch("/samples/test", json=json)
        await resp_is.conflict(resp, "Sample already finalized")

    async def test_not_quality(
        self,
        resp_is,
        spawn_job_client,
    ):
        client = await spawn_job_client(authenticated=True)

        resp = await client.patch("/samples/test", json={})

        assert resp.status == 422
        await resp_is.invalid_input(resp, {"quality": ["required field"]})


async def _drive_sample_job(app, sample: Sample, state: JobState) -> None:
    """Drive a sample's real creation job to ``state`` via the data layer.

    ``SamplesData.create()`` creates the ``create_sample`` job in ``pending`` state
    and wires it to the sample. This transitions that same job — no second job is
    created and no Mongo write is needed.
    """
    jobs = get_data_from_app(app).jobs
    job_id = sample.job.id

    if state is JobState.PENDING:
        return

    if state is JobState.CANCELLED:
        await jobs.cancel(job_id)
        return

    if state is JobState.FAILED:
        async with AsyncSession(app["pg"]) as session:
            await session.execute(
                update(SQLJob)
                .where(SQLJob.id == job_id)
                .values(
                    state=JobState.FAILED.value,
                    finished_at=virtool.utils.timestamp(),
                ),
            )
            await session.commit()
        return

    await jobs.claim(
        Workflow.CREATE_SAMPLE,
        CreateJobClaimRequest(
            runner_id="fake-runner",
            mem=1.0,
            cpu=1.0,
            image="virtool/fake:latest",
            runtime_version="0.0.0",
            workflow_version="0.0.0",
            steps=[],
        ),
    )

    if state is JobState.SUCCEEDED:
        await jobs.finish(job_id)


class TestDelete:
    async def setup_unfinalized_sample_with_job(
        self,
        job_state: JobState,
        fake: DataFaker,
        spawn_client: ClientSpawner,
    ) -> tuple[VirtoolTestClient, int]:
        """Create an unfinalized sample whose creation job is in ``job_state``."""
        client = await spawn_client(administrator=True, authenticated=True)

        user = await fake.users.create()

        sample = await fake.samples.create(user, ready=False)

        await _drive_sample_job(client.app, sample, job_state)

        return client, sample.id

    async def test_finalized(
        self,
        fake: DataFaker,
        spawn_client: ClientSpawner,
    ):
        """Test that finalized samples can be deleted."""
        client = await spawn_client(administrator=True, authenticated=True)

        user = await fake.users.create()

        sample = await fake.samples.create(user, ready=True)

        resp = await client.delete(f"/samples/{sample.id}")

        assert resp.status == 204

    async def test_unfinalized_with_failed_job(
        self,
        fake: DataFaker,
        spawn_client: ClientSpawner,
    ):
        """Test that unfinalized samples with failed jobs can be deleted."""
        client, sample_id = await self.setup_unfinalized_sample_with_job(
            JobState.FAILED,
            fake,
            spawn_client,
        )

        resp = await client.delete(f"/samples/{sample_id}")

        assert resp.status == 204

    async def test_unfinalized_with_cancelled_job(
        self,
        fake: DataFaker,
        spawn_client: ClientSpawner,
    ):
        """Test that unfinalized samples with cancelled jobs can be deleted."""
        client, sample_id = await self.setup_unfinalized_sample_with_job(
            JobState.CANCELLED,
            fake,
            spawn_client,
        )

        resp = await client.delete(f"/samples/{sample_id}")

        assert resp.status == 204

    async def test_unfinalized_with_succeeded_job(
        self,
        fake: DataFaker,
        spawn_client: ClientSpawner,
    ):
        """Test that unfinalized samples with succeeded jobs can be deleted."""
        client, sample_id = await self.setup_unfinalized_sample_with_job(
            JobState.SUCCEEDED,
            fake,
            spawn_client,
        )

        resp = await client.delete(f"/samples/{sample_id}")

        assert resp.status == 204

    async def test_releases_reserved_uploads(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
        spawn_client: ClientSpawner,
    ):
        """Deleting a sample through the web API releases its reserved uploads."""
        client = await spawn_client(administrator=True, authenticated=True)

        user = await fake.users.create()
        upload = await fake.uploads.create(user=user)

        sample = await fake.samples.create(user, uploads=[upload], ready=False)

        assert (await get_row_by_id(pg, SQLUpload, upload.id)).reserved is True

        await _drive_sample_job(client.app, sample, JobState.FAILED)

        resp = await client.delete(f"/samples/{sample.id}")

        assert resp.status == 204

        row = await get_row_by_id(pg, SQLUpload, upload.id)
        assert row.reserved is False

    async def test_unfinalized_with_running_job(
        self,
        fake: DataFaker,
        spawn_client: ClientSpawner,
    ):
        """Test that unfinalized samples with running jobs cannot be deleted."""
        client, sample_id = await self.setup_unfinalized_sample_with_job(
            JobState.RUNNING,
            fake,
            spawn_client,
        )

        resp = await client.delete(f"/samples/{sample_id}")

        assert resp.status == 400

    @pytest.mark.parametrize("finalized", [True, False])
    async def test_from_job(
        self,
        finalized: bool,
        fake: DataFaker,
        spawn_job_client,
    ):
        """Test that job client can delete a sample only when it is unfinalized."""
        client = await spawn_job_client(authenticated=True)

        user = await fake.users.create()

        sample = await fake.samples.create(user, ready=finalized)

        if not finalized:
            await _drive_sample_job(client.app, sample, JobState.CANCELLED)

        resp = await client.delete(f"/samples/{sample.id}")

        if finalized:
            assert resp.status == 400
        else:
            assert resp.status == 204

    async def test_not_found(self, spawn_client: ClientSpawner):
        client = await spawn_client(authenticated=True)
        resp = await client.delete("/samples/999999")
        assert resp.status == 404

    async def test_not_found_from_job(self, spawn_job_client):
        client = await spawn_job_client(authenticated=True)
        resp = await client.delete("/samples/test")
        assert resp.status == 404


async def test_find_analyses(
    fake: DataFaker,
    snapshot: SnapshotAssertion,
    mongo: Mongo,
    pg: AsyncEngine,
    spawn_client: ClientSpawner,
    static_time,
):
    client = await spawn_client(authenticated=True)

    user_1 = await fake.users.create()
    user_2 = await fake.users.create()

    job = await fake.jobs.create(user=user_1)

    upload = await fake.uploads.create(user=user_1)
    malus = await fake.subtractions.create(
        user=user_1,
        upload=upload,
        name="Malus domestica",
        upload_files=False,
        finalized=False,
    )

    await mongo.samples.insert_one(
        {
            "_id": "test",
            "created_at": static_time.datetime,
            "all_read": True,
            "all_write": True,
            "group": "none",
            "group_read": True,
            "group_write": True,
            "ready": True,
            "user": {"id": user_1.id},
        },
    )

    await asyncio.gather(
        mongo.references.insert_many(
            [
                {"_id": "foo", "archived": False, "data_type": "genome", "name": "Foo"},
                {"_id": "baz", "archived": False, "data_type": "genome", "name": "Baz"},
            ],
            session=None,
        ),
        mongo.indexes.insert_one({"_id": "foo", "version": 2}),
    )

    async with AsyncSession(pg) as session:
        session.add_all(
            SQLReference(
                legacy_id=legacy_id,
                name=name,
                description="",
                created_at=static_time.datetime,
                source_types=[],
                user_id=user_1.id,
            )
            for legacy_id, name in (("foo", "Foo"), ("baz", "Baz"))
        )

        legacy_sample = SQLLegacySample(
            legacy_id="test",
            name="Test Sample",
            library_type="normal",
            created_at=static_time.datetime,
            user_id=user_1.id,
            all_read=True,
            all_write=True,
        )
        session.add(legacy_sample)
        await session.flush()

        legacy_sample_id = legacy_sample.id

        analyses = [
            SQLAnalysis(
                legacy_id="test_1",
                created_at=static_time.datetime,
                updated_at=static_time.datetime,
                workflow="pathoscope",
                ready=True,
                sample="test",
                sample_id=legacy_sample.id,
                reference="baz",
                index="foo",
                user_id=user_1.id,
                job_id=job.id,
            ),
            SQLAnalysis(
                legacy_id="test_2",
                created_at=static_time.datetime,
                updated_at=static_time.datetime,
                workflow="pathoscope",
                ready=True,
                sample="test",
                sample_id=legacy_sample.id,
                reference="baz",
                index="foo",
                user_id=user_1.id,
            ),
            SQLAnalysis(
                legacy_id="test_3",
                created_at=static_time.datetime,
                updated_at=static_time.datetime,
                workflow="pathoscope",
                ready=True,
                sample="test",
                sample_id=legacy_sample.id,
                reference="foo",
                index="foo",
                user_id=user_2.id,
            ),
            SQLAnalysis(
                legacy_id="test_4",
                created_at=static_time.datetime,
                updated_at=static_time.datetime,
                workflow="pathoscope",
                ready=True,
                sample="test-not-found",
                reference="foo",
                index="foo",
                user_id=user_2.id,
            ),
        ]

        session.add_all(analyses)
        await session.flush()

        session.add_all(
            SQLAnalysisSubtraction(
                analysis_id=analysis.id,
                subtraction_id=malus.id,
            )
            for analysis in analyses
            if analysis.legacy_id in {"test_2", "test_3", "test_4"}
        )

        await session.commit()

    resp = await client.get(f"/samples/{legacy_sample_id}/analyses")

    assert resp.status == HTTPStatus.OK
    assert await resp.json() == snapshot


class TestAnalyze:
    @pytest.fixture
    async def analyze_client(
        self,
        spawn_client: ClientSpawner,
    ) -> VirtoolTestClient:
        client = await spawn_client(authenticated=True)
        client.app["jobs"] = MockJobInterface()

        return client

    @staticmethod
    async def _insert_reference(fake: DataFaker) -> Reference:
        user = await fake.users.create()
        return await fake.references.create(user=user, name="Test Reference")

    @staticmethod
    async def _insert_index(mongo: Mongo, ref_id: str, *, ready: bool = True) -> None:
        await mongo.indexes.insert_one(
            {
                "_id": "test",
                "reference": {"id": ref_id},
                "ready": ready,
                "version": 4,
            },
        )

    @staticmethod
    async def _insert_subtraction(pg: AsyncEngine) -> None:
        async with AsyncSession(pg) as session:
            session.add(
                SQLSubtraction(
                    legacy_id="subtraction_1",
                    name="Subtraction 1",
                    created_at=datetime(2015, 10, 6, 20, 0, 0),
                    ready=True,
                ),
            )

            await session.commit()

    @staticmethod
    async def _insert_sample(client: VirtoolTestClient, fake: DataFaker) -> int:
        owner = await get_data_from_app(client.app).users.get(client.user.id)
        return (await fake.samples.create(owner, ready=True)).id

    @staticmethod
    async def _post(client: VirtoolTestClient, ref_id: str, sample_id: int):
        return await client.post(
            f"/samples/{sample_id}/analyses",
            data={
                "workflow": "pathoscope",
                "ref_id": ref_id,
                "subtractions": [1],
            },
        )

    async def test_ok(
        self,
        analyze_client: VirtoolTestClient,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        snapshot: SnapshotAssertion,
        static_time,
    ):
        reference = await self._insert_reference(fake)
        await self._insert_index(mongo, reference.id)
        await self._insert_subtraction(pg)
        sample_id = await self._insert_sample(analyze_client, fake)

        resp = await self._post(analyze_client, reference.id, sample_id)

        assert resp.status == 201
        assert resp.headers["Location"] == "/analyses/1"
        assert await resp.json() == snapshot

    async def test_missing_reference(
        self,
        analyze_client: VirtoolTestClient,
        fake: DataFaker,
        pg: AsyncEngine,
        resp_is,
        static_time,
    ):
        await self._insert_subtraction(pg)
        sample_id = await self._insert_sample(analyze_client, fake)

        resp = await self._post(analyze_client, "does_not_exist", sample_id)

        await resp_is.conflict(resp, "Reference does not exist")

    async def test_archived_reference(
        self,
        analyze_client: VirtoolTestClient,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        resp_is,
        static_time,
    ):
        reference = await self._insert_reference(fake)
        await data_layer.references.archive(reference.id)
        await self._insert_index(mongo, reference.id)
        await self._insert_subtraction(pg)
        sample_id = await self._insert_sample(analyze_client, fake)

        resp = await self._post(analyze_client, reference.id, sample_id)

        await resp_is.conflict(resp, "Reference is archived")

    async def test_no_index(
        self,
        analyze_client: VirtoolTestClient,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        resp_is,
        static_time,
    ):
        reference = await self._insert_reference(fake)
        await self._insert_subtraction(pg)
        sample_id = await self._insert_sample(analyze_client, fake)

        resp = await self._post(analyze_client, reference.id, sample_id)

        await resp_is.conflict(resp, "No ready index")

    async def test_unbuilt_index(
        self,
        analyze_client: VirtoolTestClient,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        resp_is,
        static_time,
    ):
        reference = await self._insert_reference(fake)
        await self._insert_index(mongo, reference.id, ready=False)
        await self._insert_subtraction(pg)
        sample_id = await self._insert_sample(analyze_client, fake)

        resp = await self._post(analyze_client, reference.id, sample_id)

        await resp_is.conflict(resp, "No ready index")

    async def test_missing_subtraction(
        self,
        analyze_client: VirtoolTestClient,
        fake: DataFaker,
        mongo: Mongo,
        resp_is,
        static_time,
    ):
        reference = await self._insert_reference(fake)
        await self._insert_index(mongo, reference.id)
        sample_id = await self._insert_sample(analyze_client, fake)

        resp = await self._post(analyze_client, reference.id, sample_id)

        await resp_is.conflict(resp, "Subtractions do not exist: 1")

    async def test_missing_sample(
        self,
        analyze_client: VirtoolTestClient,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        resp_is,
        static_time,
    ):
        reference = await self._insert_reference(fake)
        await self._insert_index(mongo, reference.id)
        await self._insert_subtraction(pg)

        resp = await self._post(analyze_client, reference.id, 999999)

        await resp_is.not_found(resp)

    async def test_iimi_rejected(
        self,
        analyze_client: VirtoolTestClient,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        static_time,
    ):
        reference = await self._insert_reference(fake)
        await self._insert_index(mongo, reference.id)
        await self._insert_subtraction(pg)
        sample_id = await self._insert_sample(analyze_client, fake)

        resp = await analyze_client.post(
            f"/samples/{sample_id}/analyses",
            data={
                "workflow": "iimi",
                "ref_id": reference.id,
                "subtractions": ["subtraction_1"],
            },
        )

        assert resp.status == 400


class TestUploadArtifact:
    """Test that new artifacts can be uploaded after sample creation using the Jobs API."""

    @staticmethod
    async def _post(
        client: VirtoolTestClient,
        path: Path,
        artifact_type: str,
        sample_id: int,
    ):
        return await client.post(
            f"/samples/{sample_id}/artifacts?name=small.fq.gz&type={artifact_type}",
            data={"file": open(path, "rb")},
        )

    async def test_ok(
        self,
        example_path: Path,
        fake: DataFaker,
        snapshot: SnapshotAssertion,
        spawn_job_client: JobClientSpawner,
        static_time,
    ):
        """An uploaded artifact downloads with the bytes it was uploaded with."""
        user = await fake.users.create()
        sample = await fake.samples.create(user, ready=True)

        client = await spawn_job_client(authenticated=True)

        path = example_path / "sample" / "reads_1.fq.gz"
        resp = await self._post(client, path, "fastq", sample.id)

        assert resp.status == 201
        assert await resp.json() == snapshot

        download = await client.get(f"/samples/{sample.id}/artifacts/small.fq.gz")

        assert download.status == 200
        assert await download.content.read() == path.read_bytes()

    async def test_not_found(
        self,
        example_path: Path,
        resp_is,
        spawn_job_client: JobClientSpawner,
        static_time,
    ):
        client = await spawn_job_client(authenticated=True)

        resp = await self._post(
            client,
            example_path / "sample" / "reads_1.fq.gz",
            "fastq",
            sample_id=999999,
        )

        await resp_is.not_found(resp)

    async def test_unsupported_type(
        self,
        example_path: Path,
        fake: DataFaker,
        resp_is,
        spawn_job_client: JobClientSpawner,
        static_time,
    ):
        user = await fake.users.create()
        sample = await fake.samples.create(user, ready=True)

        client = await spawn_job_client(authenticated=True)

        resp = await self._post(
            client, example_path / "sample" / "reads_1.fq.gz", "foo", sample.id
        )

        await resp_is.bad_request(resp, "Unsupported sample artifact type")

    async def test_duplicate_upload(
        self,
        example_path: Path,
        fake: DataFaker,
        resp_is,
        spawn_job_client: JobClientSpawner,
        static_time,
    ):
        user = await fake.users.create()
        sample = await fake.samples.create(user, ready=True)

        client = await spawn_job_client(authenticated=True)

        path = example_path / "sample" / "reads_1.fq.gz"

        resp_1 = await self._post(client, path, "fastq", sample.id)
        assert resp_1.status == 201

        resp_2 = await self._post(client, path, "fastq", sample.id)

        await resp_is.conflict(
            resp_2,
            "Artifact file has already been uploaded for this sample",
        )


class TestUploadReads:
    async def test(
        self,
        example_path: Path,
        fake: DataFaker,
        snapshot: SnapshotAssertion,
        spawn_job_client: JobClientSpawner,
    ):
        """Paired reads uploaded to a sample download back byte-for-byte, and a
        repeat upload of the same file conflicts.
        """
        user = await fake.users.create()
        sample = await fake.samples.create(user, ready=False)

        client = await spawn_job_client(authenticated=True)

        path_1 = example_path / "sample" / "reads_1.fq.gz"
        path_2 = example_path / "sample" / "reads_2.fq.gz"

        resp_1 = await client.put(
            f"/samples/{sample.id}/reads/reads_1.fq.gz",
            data={"file": open(path_1, "rb")},
        )
        resp_2 = await client.put(
            f"/samples/{sample.id}/reads/reads_2.fq.gz",
            data={"file": open(path_2, "rb")},
        )

        assert resp_1.status == resp_2.status == 201

        download_1 = await client.get(f"/samples/{sample.id}/reads/reads_1.fq.gz")
        download_2 = await client.get(f"/samples/{sample.id}/reads/reads_2.fq.gz")

        assert download_1.status == download_2.status == 200
        assert await download_1.content.read() == path_1.read_bytes()
        assert await download_2.content.read() == path_2.read_bytes()

        resp_3 = await client.put(
            f"/samples/{sample.id}/reads/reads_2.fq.gz",
            data={"file": open(path_2, "rb")},
        )

        assert resp_3.status == 409
        assert await resp_3.json() == snapshot(name="409")

    async def test_not_found(
        self,
        example_path: Path,
        resp_is,
        spawn_job_client: JobClientSpawner,
    ):
        client = await spawn_job_client(authenticated=True)

        resp = await client.put(
            "/samples/999999/reads/reads_1.fq.gz",
            data={"file": open(example_path / "sample" / "reads_1.fq.gz", "rb")},
        )

        await resp_is.not_found(resp)

    async def test_uncompressed(
        self,
        example_path: Path,
        fake: DataFaker,
        snapshot: SnapshotAssertion,
        spawn_job_client: JobClientSpawner,
    ):
        """An uncompressed reads upload is rejected and leaves nothing to download."""
        user = await fake.users.create()
        sample = await fake.samples.create(user, ready=False)
        upload = await fake.uploads.create(user=user)

        client = await spawn_job_client(authenticated=True)

        resp = await client.put(
            f"/samples/{sample.id}/reads/reads_1.fq.gz?upload={upload.id}",
            data={
                "file": gzip.open(example_path / "sample" / "reads_1.fq.gz", "rb"),
            },
        )

        assert resp.status == 400
        assert await resp.json() == snapshot

        download = await client.get(f"/samples/{sample.id}/reads/reads_1.fq.gz")
        assert download.status == 404

    async def test_empty(
        self,
        fake: DataFaker,
        snapshot: SnapshotAssertion,
        spawn_job_client: JobClientSpawner,
    ):
        """An empty reads upload is rejected and leaves nothing to download."""
        user = await fake.users.create()
        sample = await fake.samples.create(user, ready=False)

        client = await spawn_job_client(authenticated=True)

        resp = await client.put(
            f"/samples/{sample.id}/reads/reads_1.fq.gz",
            data={"file": io.BytesIO(b"")},
        )

        assert resp.status == 400
        assert await resp.json() == snapshot

        download = await client.get(f"/samples/{sample.id}/reads/reads_1.fq.gz")
        assert download.status == 404


class TestJobRemove:
    """Test removal of unfinalized samples over the Jobs API."""

    async def setup_sample(
        self,
        fake: DataFaker,
        spawn_job_client: JobClientSpawner,
        finalized: bool,
        job_state: JobState,
    ) -> tuple[VirtoolTestClient, int]:
        """Create a sample with a creation job in ``job_state`` and return its id.

        When ``finalized`` is ``True`` the sample is ready and deletion is blocked by
        the ready check before job state matters, so the job is left untouched.
        """
        client = await spawn_job_client(authenticated=True)

        user = await fake.users.create()

        sample = await fake.samples.create(user, ready=finalized)

        if not finalized:
            await _drive_sample_job(client.app, sample, job_state)

        return client, sample.id

    async def test_ok(
        self,
        fake: DataFaker,
        spawn_job_client: JobClientSpawner,
    ):
        """An unfinalized sample addressed by integer id can be removed."""
        client, sample_id = await self.setup_sample(
            fake,
            spawn_job_client,
            finalized=False,
            job_state=JobState.FAILED,
        )

        resp = await client.delete(f"/samples/{sample_id}")

        assert resp.status == 204

    async def test_finalized(
        self,
        fake: DataFaker,
        resp_is,
        spawn_job_client: JobClientSpawner,
    ):
        client, sample_id = await self.setup_sample(
            fake,
            spawn_job_client,
            finalized=True,
            job_state=JobState.SUCCEEDED,
        )

        resp = await client.delete(f"/samples/{sample_id}")

        await resp_is.bad_request(resp, "Only unfinalized samples can be deleted")

    async def test_active_job(
        self,
        fake: DataFaker,
        resp_is,
        spawn_job_client: JobClientSpawner,
    ):
        client, sample_id = await self.setup_sample(
            fake,
            spawn_job_client,
            finalized=False,
            job_state=JobState.RUNNING,
        )

        resp = await client.delete(f"/samples/{sample_id}")

        await resp_is.bad_request(
            resp,
            "Cannot delete sample with active job (current state: running)",
        )

    async def test_not_found(
        self,
        resp_is,
        spawn_job_client: JobClientSpawner,
    ):
        client = await spawn_job_client(authenticated=True)

        resp = await client.delete("/samples/999999")

        await resp_is.not_found(resp)


class TestDownloadReads:
    @pytest.mark.parametrize("suffix", ["1", "2"])
    async def test_ok(
        self,
        suffix: str,
        fake: DataFaker,
        spawn_client: ClientSpawner,
        spawn_job_client: JobClientSpawner,
    ):
        """Reads on a ready sample download over both the public and jobs APIs."""
        user = await fake.users.create()
        sample = await fake.samples.create(user, paired=True, ready=True)

        client = await spawn_client(authenticated=True)
        job_client = await spawn_job_client(authenticated=True)

        file_name = f"reads_{suffix}.fq.gz"

        resp = await client.get(f"/samples/{sample.id}/reads/{file_name}")
        job_resp = await job_client.get(f"/samples/{sample.id}/reads/{file_name}")

        assert resp.status == job_resp.status == HTTPStatus.OK
        assert await resp.content.read()
        assert await job_resp.content.read()

    async def test_404_sample(
        self,
        spawn_client: ClientSpawner,
        spawn_job_client: JobClientSpawner,
    ):
        client = await spawn_client(authenticated=True)
        job_client = await spawn_job_client(authenticated=True)

        resp = await client.get("/samples/999999/reads/reads_1.fq.gz")
        job_resp = await job_client.get("/samples/999999/reads/reads_1.fq.gz")

        assert resp.status == job_resp.status == 404

    async def test_404_reads(
        self,
        fake: DataFaker,
        spawn_client: ClientSpawner,
        spawn_job_client: JobClientSpawner,
    ):
        """Downloading a reads file that was never uploaded returns 404."""
        user = await fake.users.create()
        sample = await fake.samples.create(user, ready=False)

        client = await spawn_client(authenticated=True)
        job_client = await spawn_job_client(authenticated=True)

        resp = await client.get(f"/samples/{sample.id}/reads/reads_1.fq.gz")
        job_resp = await job_client.get(f"/samples/{sample.id}/reads/reads_1.fq.gz")

        assert resp.status == job_resp.status == 404

    async def test_missing_blob_is_server_error(
        self,
        fake: DataFaker,
        memory_storage,
        spawn_client: ClientSpawner,
        spawn_job_client: JobClientSpawner,
    ):
        """A reads row that resolves but whose blob is missing is a server-side
        data-integrity bug, returning 500 rather than a client-facing 404.

        This state is unreachable through the API, so it is injected by deleting a
        ready sample's blob out from under its resolvable row.
        """
        user = await fake.users.create()
        sample = await fake.samples.create(user, ready=True)

        file_name = "reads_1.fq.gz"
        await memory_storage.delete(
            sample_file_key(sample_storage_id(sample.id, None), file_name),
        )

        client = await spawn_client(authenticated=True)
        job_client = await spawn_job_client(authenticated=True)

        resp = await client.get(f"/samples/{sample.id}/reads/{file_name}")
        job_resp = await job_client.get(f"/samples/{sample.id}/reads/{file_name}")

        assert resp.status == job_resp.status == 500


class TestDownloadArtifact:
    @staticmethod
    async def _upload_artifact(
        client: VirtoolTestClient,
        example_path: Path,
        sample_id: int,
    ) -> bytes:
        """Upload an artifact to a sample over the jobs API and return its bytes."""
        payload = (example_path / "sample" / "reads_1.fq.gz").read_bytes()

        resp = await client.post(
            f"/samples/{sample_id}/artifacts?name=fastqc.txt&type=fastq",
            data={"file": io.BytesIO(payload)},
        )

        assert resp.status == 201

        return payload

    async def test_ok(
        self,
        example_path: Path,
        fake: DataFaker,
        spawn_job_client: JobClientSpawner,
    ):
        """An uploaded artifact downloads with the bytes it was uploaded with."""
        user = await fake.users.create()
        sample = await fake.samples.create(user, ready=True)

        client = await spawn_job_client(authenticated=True)
        payload = await self._upload_artifact(client, example_path, sample.id)

        resp = await client.get(f"/samples/{sample.id}/artifacts/fastqc.txt")

        assert resp.status == HTTPStatus.OK
        assert await resp.content.read() == payload

    async def test_404_sample(
        self,
        spawn_job_client: JobClientSpawner,
    ):
        client = await spawn_job_client(authenticated=True)

        resp = await client.get("/samples/999999/artifacts/fastqc.txt")

        assert resp.status == 404

    async def test_404_artifact(
        self,
        fake: DataFaker,
        spawn_job_client: JobClientSpawner,
    ):
        """Downloading an artifact that was never uploaded returns 404."""
        user = await fake.users.create()
        sample = await fake.samples.create(user, ready=True)

        client = await spawn_job_client(authenticated=True)

        resp = await client.get(f"/samples/{sample.id}/artifacts/fastqc.txt")

        assert resp.status == 404

    async def test_missing_blob_is_server_error(
        self,
        example_path: Path,
        fake: DataFaker,
        memory_storage,
        spawn_job_client: JobClientSpawner,
    ):
        """An artifact row that resolves but whose blob is missing is a server-side
        data-integrity bug, returning 500 rather than a client-facing 404.

        This state is unreachable through the API, so it is injected by deleting an
        uploaded artifact's blob out from under its resolvable row.
        """
        user = await fake.users.create()
        sample = await fake.samples.create(user, ready=True)

        client = await spawn_job_client(authenticated=True)
        await self._upload_artifact(client, example_path, sample.id)

        await memory_storage.delete(
            sample_file_key(sample_storage_id(sample.id, None), "fastqc.txt"),
        )

        resp = await client.get(f"/samples/{sample.id}/artifacts/fastqc.txt")

        assert resp.status == 500


class TestChangeSampleRights:
    async def test_update_group_id(
        self,
        fake: DataFaker,
        get_sample_data,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
    ):
        group = await fake.groups.create()

        client = await spawn_client(administrator=True, authenticated=True)
        resp = await client.patch(
            f"/samples/{get_sample_data.id}/rights",
            data={"group": group.id},
        )

        assert await resp.json() == snapshot(name="resp")

    async def test_set_none_group_id(
        self,
        get_sample_data,
        fake: DataFaker,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
    ):
        client = await spawn_client(administrator=True, authenticated=True)

        resp = await client.patch(
            f"/samples/{get_sample_data.id}/rights",
            data={
                "group": "none",
            },
        )

        assert await resp.json() == snapshot(name="resp")

    async def test_update_group_rights(
        self,
        get_sample_data,
        snapshot,
        spawn_client,
    ):
        client = await spawn_client(administrator=True, authenticated=True)
        resp = await client.patch(
            f"/samples/{get_sample_data.id}/rights",
            data={"group_read": False, "group_write": False},
        )

        assert await resp.json() == snapshot(name="resp")

    async def test_update_all_user_rights(
        self,
        get_sample_data,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
    ):
        client = await spawn_client(administrator=True, authenticated=True)
        resp = await client.patch(
            f"/samples/{get_sample_data.id}/rights",
            data={"all_read": False, "all_write": False},
        )

        assert await resp.json() == snapshot(name="resp")

    async def test_update_all_rights(
        self,
        get_sample_data,
        fake: DataFaker,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
    ):
        group = await fake.groups.create()

        client = await spawn_client(administrator=True, authenticated=True)
        resp = await client.patch(
            f"/samples/{get_sample_data.id}/rights",
            data={
                "group": group.id,
                "group_read": False,
                "group_write": False,
                "all_read": False,
                "all_write": False,
            },
        )

        assert await resp.json() == snapshot(name="resp")
