"""Contract tests for ``DataFaker.indexes``.

The field-by-field shape the domain emits is pinned by the ``test_upload`` snapshot in
``tests/indexes/test_api.py``. These cover the invariants and defaults that no call site
exercises on its own.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.fake.next import DataFaker
from virtool.indexes.sql import SQLIndex
from virtool.mongo.core import Mongo


class TestPostgresRow:
    """The faker dual-writes each index to Postgres as production does."""

    async def test_job_backed(self, fake: DataFaker, pg: AsyncEngine):
        """A job-backed index row carries the job id and leaves ``task_id`` null."""
        user = await fake.users.create()
        reference = await fake.references.create(user=user)
        job = await fake.jobs.create(user=user)

        index = await fake.indexes.create(reference, user, job=job, version=0)

        async with AsyncSession(pg) as session:
            row = await session.scalar(
                select(SQLIndex).where(SQLIndex.legacy_id == index.id),
            )

        assert row.legacy_id == index.id
        assert row.storage_key == index.id
        assert row.version == 0
        assert row.ready is False
        assert row.reference_id == reference.id
        assert row.user_id == user.id
        assert row.job_id == job.id
        assert row.task_id is None

    async def test_task_backed(self, fake: DataFaker, pg: AsyncEngine):
        """A task-backed index row carries the task id and leaves ``job_id`` null."""
        user = await fake.users.create()
        reference = await fake.references.create(user=user)

        index = await fake.indexes.create(reference, user, version=0, ready=True)

        async with AsyncSession(pg) as session:
            row = await session.scalar(
                select(SQLIndex).where(SQLIndex.legacy_id == index.id),
            )

        assert row.ready is True
        assert row.job_id is None
        assert row.task_id is not None


class TestBuildBacking:
    """An index is backed by exactly one build, as ``_get_index_build_type`` requires."""

    async def test_job_backed_has_no_task(self, fake: DataFaker, mongo: Mongo):
        """Passing a job seeds the legacy shape, leaving ``task`` null."""
        user = await fake.users.create()
        reference = await fake.references.create(user=user)
        job = await fake.jobs.create(user=user)

        index = await fake.indexes.create(reference, user, job=job)
        document = await mongo.indexes.find_one(index.id)

        assert document["job"] == {"id": job.id}
        assert document["task"] is None

    async def test_task_backed_has_no_job(self, fake: DataFaker, mongo: Mongo):
        """Omitting a job backs the index with a task, leaving ``job`` null."""
        user = await fake.users.create()
        reference = await fake.references.create(user=user)

        index = await fake.indexes.create(reference, user)
        document = await mongo.indexes.find_one(index.id)

        assert document["job"] is None
        assert document["task"]["id"] is not None


async def test_version_autoincrement_is_per_reference(fake: DataFaker):
    """Versions increment independently for each reference, built or not."""
    user = await fake.users.create()
    ref_a = await fake.references.create(user=user)
    ref_b = await fake.references.create(user=user)

    a = [await fake.indexes.create(ref_a, user) for _ in range(3)]
    b = [await fake.indexes.create(ref_b, user, ready=True) for _ in range(2)]

    assert [i.version for i in a] == [0, 1, 2]
    assert [i.version for i in b] == [0, 1]
    assert len({i.id for i in a + b}) == 5


async def test_manifest_defaults_to_reference_otus(fake: DataFaker):
    """An omitted manifest captures the reference's OTUs at their current versions."""
    user = await fake.users.create()
    reference = await fake.references.create(user=user)
    otu = await fake.otus.create(reference.id, user)

    index = await fake.indexes.create(reference, user)

    assert index.manifest == {otu.id: otu.version}
