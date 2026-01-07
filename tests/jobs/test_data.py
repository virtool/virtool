from unittest.mock import call

import arrow
import pytest
from pytest_mock import MockerFixture
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.jobs.client import JobCancellationResult, JobsClient
from virtool.jobs.data import JobsData
from virtool.jobs.models import JobState
from virtool.jobs.pg import (
    SQLJob,
    SQLJobAnalysis,
    SQLJobIndex,
    SQLJobSample,
    SQLJobSubtraction,
)
from virtool.mongo.core import Mongo
from virtool.users.models import User
from virtool.workflow.pytest_plugin.utils import StaticTime


@pytest.fixture
async def jobs_data(mongo, mocker, pg: AsyncEngine) -> JobsData:
    return JobsData(mocker.Mock(spec=JobsClient), mongo, pg)


async def test_cancel(
    mongo, fake: DataFaker, jobs_data: JobsData, snapshot, static_time
):
    user = await fake.users.create()

    await mongo.jobs.insert_one(
        {
            "_id": "foo",
            "created_at": static_time.datetime,
            "state": "waiting",
            "status": [
                {
                    "state": "running",
                    "stage": "foo",
                    "error": None,
                    "progress": 0.33,
                    "timestamp": static_time.datetime,
                },
            ],
            "rights": {},
            "archived": False,
            "workflow": "build_index",
            "args": {},
            "user": {"id": user.id},
        },
    )

    assert await jobs_data.cancel("foo") == snapshot
    assert await mongo.jobs.find_one() == snapshot


@pytest.mark.parametrize("job_id", ["bar", None])
async def test_create(
    job_id,
    jobs_data: JobsData,
    mocker,
    snapshot,
    mongo,
    static_time,
    fake: DataFaker,
):
    mocker.patch("virtool.utils.generate_key", return_value=("key", "hashed"))

    user = await fake.users.create()

    job = await jobs_data.create(
        "create_sample", {"sample_id": "foo"}, user.id, 0, job_id=job_id
    )

    assert job == snapshot

    assert await mongo.jobs.find_one() == snapshot


async def test_acquire(
    mongo: Mongo,
    fake: DataFaker,
    jobs_data: JobsData,
    mocker: MockerFixture,
    snapshot: SnapshotAssertion,
    static_time: StaticTime,
):
    user = await fake.users.create()

    mocker.patch("virtool.utils.generate_key", return_value=("key", "hashed"))

    await mongo.jobs.insert_one(
        {
            "_id": "foo",
            "acquired": False,
            "created_at": static_time.datetime,
            "key": None,
            "rights": {},
            "archived": False,
            "workflow": "build_index",
            "args": {},
            "user": {"id": user.id},
        },
    )

    assert await jobs_data.acquire("foo") == snapshot
    assert await mongo.jobs.find_one() == snapshot


async def test_force_delete_jobs(fake: DataFaker, jobs_data: JobsData):
    """Test that jobs can be force deleted and that the client is cancelled."""
    user = await fake.users.create()

    job_1 = await fake.jobs.create(user, state=JobState.RUNNING)
    job_2 = await fake.jobs.create(user, state=JobState.PREPARING)

    await jobs_data.force_delete()

    jobs_data._client.cancel.assert_has_calls(
        [call(job_1.id), call(job_2.id)], any_order=True
    )


class TestTimeoutStalledJobs:
    """Test the timeout_stalled_jobs method of the JobsData class."""

    user: User

    @pytest.fixture(autouse=True)
    async def _setup(self, fake: DataFaker):
        """Set up a user for all workflow."""
        self.user = await fake.users.create()

    async def test_ok(self, data_layer: DataLayer, fake: DataFaker):
        """Test timeout_stalled_jobs method times out stalled jobs."""
        # Create a job that should be timed out (stalled RUNNING job)
        timeout_job = await fake.jobs.create(
            self.user,
            state=JobState.RUNNING,
            pinged_at=arrow.utcnow().shift(minutes=-6).naive,
        )

        # Create another job that should be timed out (stalled PREPARING job)
        timeout_job_2 = await fake.jobs.create(
            self.user,
            state=JobState.PREPARING,
            pinged_at=arrow.utcnow().shift(minutes=-6).naive,
        )

        await data_layer.jobs.timeout_stalled_jobs()

        # Check that stalled jobs were timed out
        timeout_result = await data_layer.jobs.get(timeout_job.id)
        assert timeout_result.state == JobState.TIMEOUT

        timeout_result_2 = await data_layer.jobs.get(timeout_job_2.id)
        assert timeout_result_2.state == JobState.TIMEOUT


class TestCreatePostgres:
    """Test that create() writes to Postgres."""

    async def test_ok(
        self,
        jobs_data: JobsData,
        fake: DataFaker,
        pg: AsyncEngine,
        static_time: StaticTime,
    ):
        user = await fake.users.create()

        job = await jobs_data.create(
            "create_sample",
            {"sample_id": "foo"},
            user.id,
            0,
        )

        async with AsyncSession(pg) as session:
            result = await session.execute(
                select(SQLJob).where(SQLJob.legacy_id == job.id),
            )
            sql_job = result.scalar()

        assert sql_job is not None
        assert sql_job.state == "pending"
        assert sql_job.user_id == user.id
        assert sql_job.workflow == "create_sample"
        assert sql_job.acquired is False
        assert sql_job.created_at == static_time.datetime

    async def test_sample_join_table(
        self,
        jobs_data: JobsData,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """Test that create_sample jobs write to job_samples join table."""
        user = await fake.users.create()

        job = await jobs_data.create(
            "create_sample",
            {"sample_id": "sample_123"},
            user.id,
            0,
        )

        async with AsyncSession(pg) as session:
            sql_job = (
                await session.execute(
                    select(SQLJob).where(SQLJob.legacy_id == job.id),
                )
            ).scalar()

            job_sample = (
                await session.execute(
                    select(SQLJobSample).where(SQLJobSample.job_id == sql_job.id),
                )
            ).scalar()

        assert job_sample is not None
        assert job_sample.sample_id == "sample_123"

    async def test_index_join_table(
        self,
        jobs_data: JobsData,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """Test that build_index jobs write to job_indexes join table."""
        user = await fake.users.create()

        job = await jobs_data.create(
            "build_index",
            {"index_id": "index_456"},
            user.id,
            0,
        )

        async with AsyncSession(pg) as session:
            sql_job = (
                await session.execute(
                    select(SQLJob).where(SQLJob.legacy_id == job.id),
                )
            ).scalar()

            job_index = (
                await session.execute(
                    select(SQLJobIndex).where(SQLJobIndex.job_id == sql_job.id),
                )
            ).scalar()

        assert job_index is not None
        assert job_index.index_id == "index_456"

    async def test_subtraction_join_table(
        self,
        jobs_data: JobsData,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """Test that create_subtraction jobs write to job_subtractions join table."""
        user = await fake.users.create()

        job = await jobs_data.create(
            "create_subtraction",
            {"subtraction_id": "sub_789"},
            user.id,
            0,
        )

        async with AsyncSession(pg) as session:
            sql_job = (
                await session.execute(
                    select(SQLJob).where(SQLJob.legacy_id == job.id),
                )
            ).scalar()

            job_subtraction = (
                await session.execute(
                    select(SQLJobSubtraction).where(
                        SQLJobSubtraction.job_id == sql_job.id,
                    ),
                )
            ).scalar()

        assert job_subtraction is not None
        assert job_subtraction.subtraction_id == "sub_789"

    async def test_analysis_join_table(
        self,
        jobs_data: JobsData,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """Test that analysis jobs write to job_analyses join table."""
        user = await fake.users.create()

        job = await jobs_data.create(
            "nuvs",
            {"analysis_id": "analysis_abc"},
            user.id,
            0,
        )

        async with AsyncSession(pg) as session:
            sql_job = (
                await session.execute(
                    select(SQLJob).where(SQLJob.legacy_id == job.id),
                )
            ).scalar()

            job_analysis = (
                await session.execute(
                    select(SQLJobAnalysis).where(SQLJobAnalysis.job_id == sql_job.id),
                )
            ).scalar()

        assert job_analysis is not None
        assert job_analysis.analysis_id == "analysis_abc"


class TestPushStatusPostgres:
    """Test that push_status() writes to Postgres."""

    async def test_ok(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
        static_time: StaticTime,
    ):
        user = await fake.users.create()
        job = await fake.jobs.create(user)

        await data_layer.jobs.push_status(
            job.id,
            JobState.COMPLETE,
            "finished",
            progress=100,
        )

        async with AsyncSession(pg) as session:
            result = await session.execute(
                select(SQLJob).where(SQLJob.legacy_id == job.id),
            )
            sql_job = result.scalar()

        assert sql_job.state == "succeeded"
        assert sql_job.finished_at == static_time.datetime


class TestCancelPostgres:
    """Test that cancel() writes to Postgres."""

    async def test_ok(
        self,
        fake: DataFaker,
        jobs_data: JobsData,
        pg: AsyncEngine,
        static_time: StaticTime,
    ):
        user = await fake.users.create()

        job = await jobs_data.create(
            "build_index",
            {},
            user.id,
            0,
            job_id="foo",
        )

        jobs_data._client.cancel.return_value = JobCancellationResult.REMOVED_FROM_QUEUE

        await jobs_data.cancel(job.id)

        async with AsyncSession(pg) as session:
            result = await session.execute(
                select(SQLJob).where(SQLJob.legacy_id == job.id),
            )
            sql_job = result.scalar()

        assert sql_job.state == "cancelled"
        assert sql_job.finished_at == static_time.datetime


class TestPingPostgres:
    """Test that ping() writes to Postgres."""

    async def test_ok(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
        static_time: StaticTime,
    ):
        user = await fake.users.create()
        job = await fake.jobs.create(user, state=JobState.RUNNING)

        await data_layer.jobs.ping(job.id)

        async with AsyncSession(pg) as session:
            result = await session.execute(
                select(SQLJob).where(SQLJob.legacy_id == job.id),
            )
            sql_job = result.scalar()

        assert sql_job.pinged_at == static_time.datetime


class TestTimeoutStalledJobsPostgres:
    """Test that timeout_stalled_jobs() writes to Postgres."""

    async def test_ok(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
        static_time: StaticTime,
    ):
        user = await fake.users.create()

        job = await fake.jobs.create(
            user,
            state=JobState.RUNNING,
            pinged_at=arrow.utcnow().shift(minutes=-6).naive,
        )

        await data_layer.jobs.timeout_stalled_jobs()

        async with AsyncSession(pg) as session:
            result = await session.execute(
                select(SQLJob).where(SQLJob.legacy_id == job.id),
            )
            sql_job = result.scalar()

        assert sql_job.state == "failed"
        assert sql_job.finished_at is not None
