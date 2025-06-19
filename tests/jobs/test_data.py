import asyncio
from unittest.mock import call

import arrow
import pytest
from pytest_mock import MockerFixture
from sqlalchemy.ext.asyncio import AsyncEngine
from syrupy import SnapshotAssertion

from tests.fixtures.core import StaticTime
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.jobs.client import JobsClient
from virtool.jobs.data import JobsData
from virtool.jobs.models import JobState, QueuedJobID
from virtool.mongo.core import Mongo
from virtool.users.models import User


@pytest.fixture()
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


class TestRetry:
    """Test the retry method of the JobsData class."""

    user: User

    @pytest.fixture(autouse=True)
    async def _setup(self, fake: DataFaker):
        """Set up a user for all tests."""
        self.user = await fake.users.create()

    async def test_ok(self, data_layer: DataLayer, fake: DataFaker):
        """Test a job can be retried if it is in a retryable state."""
        job = await fake.jobs.create(
            self.user,
            pinged_at=arrow.utcnow().shift(minutes=-6).datetime,
            state=JobState.RUNNING,
        )

        job = await data_layer.jobs.retry(job.id)

        assert job.acquired is False
        assert job.ping is None
        assert len(job.status) == 1
        assert job.status[0].state == JobState.WAITING == job.state
        assert await data_layer.jobs.list_queued_ids() == [
            QueuedJobID(job.id, f"jobs_{job.workflow}")
        ]

    async def test_pinged_too_recently(self, data_layer: DataLayer, fake: DataFaker):
        """Test a job cannot be retried if it was pinged too recently."""
        job = await fake.jobs.create(self.user, state=JobState.RUNNING)

        await data_layer.jobs.ping(job.id)

        job = await data_layer.jobs.get(job.id)

        await asyncio.sleep(1)

        with pytest.raises(
            ResourceConflictError, match="Job has been pinged within the last 5 minutes"
        ):
            await data_layer.jobs.retry(job.id)

    @pytest.mark.parametrize(
        "state",
        [JobState.COMPLETE, JobState.ERROR, JobState.TERMINATED, JobState.TIMEOUT],
    )
    async def test_state_not_retryable(
        self, data_layer: DataLayer, fake: DataFaker, state: JobState
    ):
        """Test a job cannot be retried if it is not in a retryable state."""
        job = await fake.jobs.create(self.user, state=state)

        with pytest.raises(
            ResourceConflictError, match="Job is not in a retryable state"
        ):
            await data_layer.jobs.retry(job.id)

    async def test_retry_waiting_job(self, data_layer: DataLayer, fake: DataFaker):
        """Test that WAITING jobs can be retried by simple re-enqueue when not already queued."""
        job = await fake.jobs.create(self.user, state=JobState.WAITING)

        # Remove the job from the queue to simulate a job that's not queued
        await data_layer.jobs._client.remove(job.id)

        retried_job = await data_layer.jobs.retry(job.id)

        assert retried_job.retries == 1
        assert retried_job.state == JobState.WAITING
        assert retried_job.ping is None
        queued_jobs = await data_layer.jobs.list_queued_ids()
        assert queued_jobs == [QueuedJobID(job.id, f"jobs_{job.workflow}")]

    async def test_retry_waiting_job_already_queued(
        self, data_layer: DataLayer, fake: DataFaker
    ):
        """Test that WAITING jobs cannot be retried if already queued."""
        job = await fake.jobs.create(self.user, state=JobState.WAITING)

        # WAITING jobs created by fake are already in the queue, so retry should fail
        with pytest.raises(ResourceConflictError, match="Job is already queued"):
            await data_layer.jobs.retry(job.id)

    async def test_retry_preparing_job(self, data_layer: DataLayer, fake: DataFaker):
        """Test that PREPARING jobs can be retried when stalled."""
        job = await fake.jobs.create(
            self.user,
            state=JobState.PREPARING,
            pinged_at=arrow.utcnow().shift(minutes=-6).datetime,
        )

        retried_job = await data_layer.jobs.retry(job.id)

        assert retried_job.retries == 1
        assert retried_job.state == JobState.WAITING
        assert retried_job.ping is None
        assert retried_job.acquired is False
        assert len(retried_job.status) == 1
        assert retried_job.status[0].state == JobState.WAITING
        queued_jobs = await data_layer.jobs.list_queued_ids()
        assert queued_jobs == [QueuedJobID(job.id, f"jobs_{job.workflow}")]

    async def test_retry_preparing_job_with_no_ping_stalled(
        self, data_layer: DataLayer, fake: DataFaker, mongo: Mongo
    ):
        """Test that PREPARING jobs with no ping field can be retried when stalled (> 3 minutes)."""
        # Create a job and manually put it in PREPARING state with no ping and old timestamp
        job = await fake.jobs.create(self.user, state=JobState.WAITING)

        # Remove from queue and acquire it (puts it in PREPARING state)
        await data_layer.jobs._client.remove(job.id)
        job = await data_layer.jobs.acquire(job.id)

        # Set the PREPARING status timestamp to > 3 minutes ago and remove ping
        old_timestamp = arrow.utcnow().shift(minutes=-4).datetime
        await mongo.jobs.update_one(
            {"_id": job.id},
            {
                "$set": {
                    "ping": None,
                    "status.1.timestamp": old_timestamp,  # status[1] should be the PREPARING record
                }
            },
        )

        retried_job = await data_layer.jobs.retry(job.id)

        assert retried_job.retries == 1
        assert retried_job.state == JobState.WAITING
        assert retried_job.ping is None
        assert retried_job.acquired is False
        queued_jobs = await data_layer.jobs.list_queued_ids()
        assert queued_jobs == [QueuedJobID(job.id, f"jobs_{job.workflow}")]

    async def test_retry_preparing_job_with_no_ping_not_stalled(
        self, data_layer: DataLayer, fake: DataFaker, mongo: Mongo
    ):
        """Test that PREPARING jobs with no ping field cannot be retried when not stalled (< 3 minutes)."""
        # Create a job and manually put it in PREPARING state with no ping and recent timestamp
        job = await fake.jobs.create(self.user, state=JobState.WAITING)

        # Remove from queue and acquire it (puts it in PREPARING state)
        await data_layer.jobs._client.remove(job.id)
        job = await data_layer.jobs.acquire(job.id)

        # Set the PREPARING status timestamp to < 3 minutes ago and remove ping
        recent_timestamp = arrow.utcnow().shift(minutes=-2).datetime
        await mongo.jobs.update_one(
            {"_id": job.id},
            {
                "$set": {
                    "ping": None,
                    "status.1.timestamp": recent_timestamp,  # status[1] should be the PREPARING record
                }
            },
        )

        with pytest.raises(
            ResourceConflictError,
            match="Job has been PREPARING for less than 3 minutes",
        ):
            await data_layer.jobs.retry(job.id)

    async def test_retry_limit_exceeded(
        self, data_layer: DataLayer, fake: DataFaker, mongo: Mongo
    ):
        """Test that jobs with 3+ retries cannot be retried."""
        job = await fake.jobs.create(
            self.user,
            state=JobState.RUNNING,
            pinged_at=arrow.utcnow().shift(minutes=-6).datetime,
        )

        await mongo.jobs.update_one({"_id": job.id}, {"$set": {"retries": 3}})

        with pytest.raises(
            ResourceConflictError, match="Job has already been retried 3 times"
        ):
            await data_layer.jobs.retry(job.id)

    async def test_job_already_queued(
        self, data_layer: DataLayer, fake: DataFaker, mocker: MockerFixture
    ):
        """Test that already queued jobs cannot be retried."""
        job = await fake.jobs.create(
            self.user,
            state=JobState.RUNNING,
            pinged_at=arrow.utcnow().shift(minutes=-6).datetime,
        )

        # Mock list_queued_ids to return the job ID as QueuedJobID
        mocker.patch.object(
            data_layer.jobs,
            "list_queued_ids",
            return_value=[QueuedJobID(job.id, f"jobs_{job.workflow}")],
        )

        with pytest.raises(ResourceConflictError, match="Job is already queued"):
            await data_layer.jobs.retry(job.id)

    async def test_retry_sets_status(self, data_layer: DataLayer, fake: DataFaker):
        """Test that retry properly resets status to single WAITING entry."""
        job = await fake.jobs.create(
            self.user,
            state=JobState.RUNNING,
            pinged_at=arrow.utcnow().shift(minutes=-6).datetime,
        )

        # Add additional status entries
        await data_layer.jobs.push_status(
            job.id, JobState.RUNNING, "processing", progress=50
        )
        await data_layer.jobs.push_status(
            job.id, JobState.RUNNING, "analyzing", progress=75
        )

        # Verify job has multiple status entries before retry
        job_before = await data_layer.jobs.get(job.id)
        assert len(job_before.status) > 1

        retried_job = await data_layer.jobs.retry(job.id)

        # After retry, should have only one WAITING status entry
        assert len(retried_job.status) == 1
        assert retried_job.status[0].state == JobState.WAITING
        assert retried_job.status[0].stage is None
        assert retried_job.status[0].progress == 0

    async def test_retry_resets_acquired_field(
        self, data_layer: DataLayer, fake: DataFaker, mongo: Mongo
    ):
        """Test that retry resets acquired field to False."""
        job = await fake.jobs.create(
            self.user,
            state=JobState.RUNNING,
            pinged_at=arrow.utcnow().shift(minutes=-6).datetime,
        )

        await mongo.jobs.update_one({"_id": job.id}, {"$set": {"acquired": True}})

        job_before = await data_layer.jobs.get(job.id)
        assert job_before.acquired is True

        retried_job = await data_layer.jobs.retry(job.id)
        assert retried_job.acquired is False

    async def test_retry_exactly_five_minutes(
        self, data_layer: DataLayer, fake: DataFaker
    ):
        """Test retry behavior at exactly 5-minute ping boundary."""
        job = await fake.jobs.create(
            self.user,
            state=JobState.RUNNING,
            pinged_at=arrow.utcnow().shift(minutes=-5).datetime,
        )

        # Job pinged exactly 5 minutes ago should be retryable
        retried_job = await data_layer.jobs.retry(job.id)
        assert retried_job.retries == 1
        assert retried_job.state == JobState.WAITING

    async def test_waiting_job_with_ping_field(
        self, data_layer: DataLayer, fake: DataFaker, mongo: Mongo
    ):
        """Test that WAITING jobs with ping field cannot be retried."""
        job = await fake.jobs.create(self.user, state=JobState.WAITING)

        # Drain the job ID from the queue to simulate a job that is not queued.
        await data_layer.jobs._client.remove(job.id)

        # Manually add ping field (this should be invalid state).
        await mongo.jobs.update_one(
            {"_id": job.id},
            {
                "$set": {
                    "ping": {"pinged_at": arrow.utcnow().shift(minutes=-1).datetime}
                }
            },
        )

        with pytest.raises(
            ResourceConflictError, match="WAITING job should not have ping field set"
        ):
            await data_layer.jobs.retry(job.id)


class TestTimeout:
    """Test the timeout method of the JobsData class."""

    user: User

    @pytest.fixture(autouse=True)
    async def _setup(self, fake: DataFaker):
        """Set up a user for all tests."""
        self.user = await fake.users.create()

    async def test_ok(self, data_layer: DataLayer, fake: DataFaker):
        """Test a job can be timed out if it is in a timeoutable state."""
        job = await fake.jobs.create(
            self.user,
            state=JobState.RUNNING,
            pinged_at=arrow.utcnow().shift(minutes=-6).datetime,
        )

        original_status_count = len(job.status)
        timed_out_job = await data_layer.jobs.timeout(job.id)

        assert timed_out_job.state == JobState.TIMEOUT
        assert timed_out_job.status[-1].state == JobState.TIMEOUT
        assert len(timed_out_job.status) == original_status_count + 1

    async def test_job_not_found(self, data_layer: DataLayer):
        """Test timeout fails when job doesn't exist."""
        with pytest.raises(ResourceNotFoundError):
            await data_layer.jobs.timeout("nonexistent")

    async def test_invalid_ping_field(
        self, data_layer: DataLayer, fake: DataFaker, mongo: Mongo
    ):
        """Test timeout fails when ping field is None."""
        job = await fake.jobs.create(self.user, state=JobState.RUNNING)

        # Remove ping field to simulate invalid state
        await mongo.jobs.update_one({"_id": job.id}, {"$unset": {"ping": 1}})

        with pytest.raises(ResourceConflictError, match="Job has invalid ping field"):
            await data_layer.jobs.timeout(job.id)

    async def test_pinged_recently(self, data_layer: DataLayer, fake: DataFaker):
        """Test timeout fails when job was pinged within 5 minutes."""
        job = await fake.jobs.create(
            self.user,
            state=JobState.RUNNING,
            pinged_at=arrow.utcnow().shift(minutes=-2).datetime,
        )

        with pytest.raises(
            ResourceConflictError,
            match="Job has been pinged within the last 5 minutes and cannot be timed out",
        ):
            await data_layer.jobs.timeout(job.id)

    @pytest.mark.parametrize(
        "state",
        [JobState.COMPLETE, JobState.ERROR, JobState.CANCELLED, JobState.TERMINATED],
    )
    async def test_invalid_state(
        self, data_layer: DataLayer, fake: DataFaker, state: JobState
    ):
        """Test timeout fails for non-timeoutable job states."""
        job = await fake.jobs.create(
            self.user,
            state=state,
            pinged_at=arrow.utcnow().shift(minutes=-6).datetime,
        )

        with pytest.raises(
            ResourceConflictError,
            match=f"Job is not in a state that can be timed out: {state}",
        ):
            await data_layer.jobs.timeout(job.id)

    async def test_preserves_latest_status_fields(
        self, data_layer: DataLayer, fake: DataFaker
    ):
        """Test timeout preserves stage, step info, and progress from latest status."""
        job = await fake.jobs.create(
            self.user,
            state=JobState.RUNNING,
            pinged_at=arrow.utcnow().shift(minutes=-6).datetime,
        )

        # Add a status with specific stage, step, and progress info
        await data_layer.jobs.push_status(
            job.id,
            JobState.RUNNING,
            "processing_data",
            step_name="Data Processing",
            step_description="Processing uploaded files",
            progress=75,
        )

        timed_out_job = await data_layer.jobs.timeout(job.id)

        # Verify the TIMEOUT status preserves the latest status fields
        timeout_status = timed_out_job.status[-1]
        assert timeout_status.state == JobState.TIMEOUT
        assert timeout_status.stage == "processing_data"
        assert timeout_status.step_name == "Data Processing"
        assert timeout_status.step_description == "Processing uploaded files"
        assert timeout_status.progress == 75
