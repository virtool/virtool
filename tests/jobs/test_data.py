from unittest.mock import call

import arrow
import pytest
from pytest_mock import MockerFixture
from sqlalchemy.ext.asyncio import AsyncEngine
from syrupy import SnapshotAssertion

from virtool.workflow.pytest_plugin.utils import StaticTime
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.jobs.client import JobsClient
from virtool.jobs.data import JobsData
from virtool.jobs.models import JobState, QueuedJobID
from virtool.mongo.core import Mongo
from virtool.users.models import User


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


class TestRetry:
    """Test the retry method of the JobsData class."""

    user: User

    @pytest.fixture(autouse=True)
    async def _setup(self, fake: DataFaker):
        """Set up a user for all workflow."""
        self.user = await fake.users.create()

    async def test_waiting(self, data_layer: DataLayer, mongo: Mongo, fake: DataFaker):
        """Test a job can be retried if it is WAITING but not in the queue."""
        job = await fake.jobs.create(
            self.user,
            state=JobState.WAITING,
        )

        assert await mongo.jobs.find_one({"_id": job.id})
        assert await mongo.jobs.find_one({"_id": job.id, "status.0.state": "waiting"})

        # Remove the job from the queue to simulate a job that's not queued.
        await data_layer.jobs._client.remove(job.id)

        await data_layer.jobs.retry(job.id)

        job = await data_layer.jobs.get(job.id)

        assert job.acquired is False
        assert job.state == JobState.WAITING
        assert job.retries == 1
        assert await data_layer.jobs.list_queued_ids() == [
            QueuedJobID(job.id, f"jobs_{job.workflow}")
        ]

    @pytest.mark.parametrize("state", [JobState.PREPARING, JobState.RUNNING])
    async def test_preparing_or_running(
        self, state: JobState, data_layer: DataLayer, fake: DataFaker, mongo: Mongo
    ):
        """Test a job can be retried if it is PREPARING or RUNNING."""
        job = await fake.jobs.create(
            self.user,
            pinged_at=arrow.utcnow().shift(minutes=-6).naive,
            state=state,
        )

        await data_layer.jobs.retry(job.id)

        job = await data_layer.jobs.get(job.id)

        assert job.acquired is False
        assert job.ping is None
        assert job.retries == 1
        assert job.state == JobState.WAITING
        assert len(job.status) == 1
        assert job.status[0].state == JobState.WAITING

        assert await data_layer.jobs.list_queued_ids() == [
            QueuedJobID(job.id, f"jobs_{job.workflow}")
        ]

    @pytest.mark.parametrize("state", [JobState.PREPARING, JobState.RUNNING])
    async def test_pinged_too_recently(
        self, data_layer: DataLayer, fake: DataFaker, state: JobState
    ):
        """Test a job cannot be retried if it was pinged too recently."""
        job = await fake.jobs.create(
            self.user, pinged_at=arrow.utcnow().shift(seconds=-30).naive, state=state
        )

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
            ResourceConflictError, match="Job is not in a state that can be retried"
        ):
            await data_layer.jobs.retry(job.id)

    async def test_already_queued(self, data_layer: DataLayer, fake: DataFaker):
        """Test that WAITING jobs cannot be retried if already queued."""
        job = await fake.jobs.create(self.user, state=JobState.WAITING)

        # WAITING jobs created by fake are already in the queue, so retry should fail
        with pytest.raises(ResourceConflictError, match="Job is already queued"):
            await data_layer.jobs.retry(job.id)

    async def test_retry_limit_exceeded(
        self, data_layer: DataLayer, fake: DataFaker, mongo: Mongo
    ):
        """Test that jobs with 5+ retries cannot be retried."""
        job = await fake.jobs.create(
            self.user,
            state=JobState.RUNNING,
            pinged_at=arrow.utcnow().shift(minutes=-6).naive,
            retries=5,
        )

        with pytest.raises(
            ResourceConflictError, match="Job has already been retried 5 times"
        ):
            await data_layer.jobs.retry(job.id)

    async def test_retry_exactly_five_minutes(
        self, data_layer: DataLayer, fake: DataFaker
    ):
        """Test retry behavior at exactly 5-minute ping boundary."""
        job = await fake.jobs.create(
            self.user,
            state=JobState.RUNNING,
            pinged_at=arrow.utcnow().shift(minutes=-5).naive,
        )

        # Job pinged exactly 5 minutes ago should be retryable
        retried_job = await data_layer.jobs.retry(job.id)
        assert retried_job.retries == 1
        assert retried_job.state == JobState.WAITING


class TestTimeout:
    """Test the timeout method of the JobsData class."""

    user: User

    @pytest.fixture(autouse=True)
    async def _setup(self, fake: DataFaker):
        """Set up a user for all workflow."""
        self.user = await fake.users.create()

    async def test_waiting(self, data_layer: DataLayer, fake: DataFaker, mongo: Mongo):
        """Test a job can be timed out if it is WAITING, not in the queue, and has
        no retries remaining.
        """
        job = await fake.jobs.create(
            self.user,
            state=JobState.WAITING,
            retries=5,
        )

        # Remove the job from the queue to simulate a job that's not queued.
        await data_layer.jobs._client.remove(job.id)

        timed_out_job = await data_layer.jobs.timeout(job.id)

        assert timed_out_job.state == JobState.TIMEOUT
        assert timed_out_job.ping is None
        assert timed_out_job.retries == 5
        assert len(timed_out_job.status) == 2
        assert timed_out_job.status[0].state == JobState.WAITING
        assert timed_out_job.status[-1].state == JobState.TIMEOUT

    @pytest.mark.parametrize("state", [JobState.PREPARING, JobState.RUNNING])
    async def test_preparing_or_running(
        self, state: JobState, data_layer: DataLayer, fake: DataFaker, mongo: Mongo
    ):
        """Test a job can be timed out if it has exceeded max retries."""
        job = await fake.jobs.create(
            self.user,
            pinged_at=arrow.utcnow().shift(minutes=-6).naive,
            state=state,
            retries=5,
        )

        timed_out_job = await data_layer.jobs.timeout(job.id)

        assert timed_out_job.state == JobState.TIMEOUT
        assert timed_out_job.status[-1].state == JobState.TIMEOUT

    async def test_job_not_found(self, data_layer: DataLayer):
        """Test timeout fails when job doesn't exist."""
        with pytest.raises(ResourceNotFoundError):
            await data_layer.jobs.timeout("nonexistent")

    async def test_pinged_recently(
        self, data_layer: DataLayer, fake: DataFaker, mongo: Mongo
    ):
        """Test timeout fails when job was pinged within 5 minutes."""
        job = await fake.jobs.create(
            self.user,
            state=JobState.RUNNING,
            pinged_at=arrow.utcnow().shift(minutes=-2).naive,
            retries=5,
        )

        # Set retries to 5 so timeout is attempted but should fail due to recent ping

        with pytest.raises(
            ResourceConflictError,
            match="Job has been pinged within the last 5 minutes",
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
            pinged_at=arrow.utcnow().shift(minutes=-6).naive,
            state=state,
        )

        with pytest.raises(
            ResourceConflictError,
            match=f"Job is not in a state that can be timed out: {state}",
        ):
            await data_layer.jobs.timeout(job.id)

    async def test_preserves_latest_status_fields(
        self, data_layer: DataLayer, fake: DataFaker, mongo: Mongo
    ):
        """Test timeout preserves stage, step info, and progress from latest status."""
        job = await fake.jobs.create(
            self.user,
            pinged_at=arrow.utcnow().shift(minutes=-6).naive,
            state=JobState.RUNNING,
            retries=5,
        )

        # Set retries to 5 to trigger timeout

        timed_out_job = await data_layer.jobs.timeout(job.id)

        # Verify the TIMEOUT status preserves the latest status fields
        timeout_status = timed_out_job.status[-1]

        initial_status = job.status[-1]

        assert timeout_status.state == JobState.TIMEOUT
        assert timeout_status.stage == initial_status.stage
        assert timeout_status.step_name == initial_status.step_name
        assert timeout_status.step_description == initial_status.step_description
        assert timeout_status.progress == initial_status.progress


class TestClean:
    """Test the clean method of the JobsData class."""

    user: User

    @pytest.fixture(autouse=True)
    async def _setup(self, fake: DataFaker, mocker):
        """Set up a user for all workflow."""
        self.user = await fake.users.create()

        # Patch out the delays in clean and retry methods to speed up workflow.
        mocker.patch("asyncio.sleep")

    async def test_ok(self, data_layer: DataLayer, fake: DataFaker, mongo: Mongo):
        """Test clean method retries stalled jobs and times out exceeded retry jobs."""
        # Create a job that should be timed out (5 retries, stalled)
        timeout_job = await fake.jobs.create(
            self.user,
            state=JobState.RUNNING,
            pinged_at=arrow.utcnow().shift(minutes=-6).naive,
            retries=5,
        )

        # Create a job that should be retried (< 5 retries, stalled)
        retry_job = await fake.jobs.create(
            self.user,
            state=JobState.RUNNING,
            pinged_at=arrow.utcnow().shift(minutes=-6).naive,
            retries=2,
        )

        # Create a WAITING job not in queue that should be retried
        waiting_job = await fake.jobs.create(
            self.user, state=JobState.WAITING, retries=1
        )
        await data_layer.jobs._client.remove(waiting_job.id)

        await data_layer.jobs.clean()

        # Check that timeout job was timed out
        timeout_result = await data_layer.jobs.get(timeout_job.id)
        assert timeout_result.state == JobState.TIMEOUT

        # Check that retry job was retried (reset to WAITING, incremented retries)
        retry_result = await data_layer.jobs.get(retry_job.id)
        assert retry_result.state == JobState.WAITING
        assert retry_result.retries == 3

        # Check that waiting job was retried
        waiting_result = await data_layer.jobs.get(waiting_job.id)
        assert waiting_result.retries == 2
