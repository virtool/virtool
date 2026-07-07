import arrow
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.analyses.sql import SQLAnalysis
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.events import (
    Operation,
    dangerously_clear_events,
    dangerously_get_event,
)
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.jobs.data import JobsData
from virtool.jobs.models import (
    CreateJobClaimRequest,
    Job,
    JobClaimed,
    JobState,
    JobStepDefinition,
    Workflow,
)
from virtool.jobs.pg import (
    SQLJob,
    SQLJobIndex,
    SQLJobSample,
)
from virtool.samples.sql import SQLLegacySample
from virtool.subtractions.pg import SQLSubtraction
from virtool.users.models import User
from virtool.workflow.pytest_plugin.utils import StaticTime


@pytest.fixture
async def jobs_data(pg: AsyncEngine) -> JobsData:
    return JobsData(pg)


async def test_cancel(fake: DataFaker, jobs_data: JobsData, snapshot, static_time):
    user = await fake.users.create()

    job = await jobs_data.create("build_index", {}, user.id, 0)

    assert await jobs_data.cancel(job.id) == snapshot


async def test_create(
    jobs_data: JobsData,
    mocker,
    snapshot,
    static_time,
    fake: DataFaker,
):
    mocker.patch("virtool.utils.generate_key", return_value=("key", "hashed"))

    user = await fake.users.create()

    job = await jobs_data.create("create_sample", {"sample_id": "foo"}, user.id, 0)

    assert job == snapshot


async def test_force_delete_jobs(fake: DataFaker, jobs_data: JobsData, pg: AsyncEngine):
    """Test that jobs can be force deleted."""
    user = await fake.users.create()

    await fake.jobs.create(user, state=JobState.RUNNING)
    await fake.jobs.create(user, state=JobState.PENDING)

    await jobs_data.force_delete()

    async with AsyncSession(pg) as session:
        assert (await session.execute(select(SQLJob))).scalar() is None


class TestTimeoutStalledJobs:
    """Test the timeout_stalled_jobs method of the JobsData class."""

    user: User

    @pytest.fixture(autouse=True)
    async def _setup(self, fake: DataFaker):
        """Set up a user for all workflow."""
        self.user = await fake.users.create()

    async def test_ok(self, data_layer: DataLayer, fake: DataFaker):
        """Test timeout_stalled_jobs method times out stalled jobs."""
        timeout_job = await fake.jobs.create(
            self.user,
            state=JobState.RUNNING,
            pinged_at=arrow.utcnow().shift(minutes=-6).naive,
        )

        timeout_job_2 = await fake.jobs.create(
            self.user,
            state=JobState.RUNNING,
            pinged_at=arrow.utcnow().shift(minutes=-6).naive,
        )

        await data_layer.jobs.timeout_stalled_jobs()

        timeout_result = await data_layer.jobs.get(timeout_job.id)
        assert timeout_result.state == JobState.FAILED

        timeout_result_2 = await data_layer.jobs.get(timeout_job_2.id)
        assert timeout_result_2.state == JobState.FAILED


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
                select(SQLJob).where(SQLJob.id == job.id),
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
        """Test that create_sample jobs write the legacy sample string.

        The integer ``sample_id`` foreign key is left ``NULL`` on the write path
        and populated later by the backfill; the write path only records the
        legacy Mongo sample string in ``sample``.
        """
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
                    select(SQLJob).where(SQLJob.id == job.id),
                )
            ).scalar()

            job_sample = (
                await session.execute(
                    select(SQLJobSample).where(SQLJobSample.job_id == sql_job.id),
                )
            ).scalar()

        assert job_sample is not None
        assert job_sample.sample == "sample_123"
        assert job_sample.sample_id is None

    async def test_get_returns_legacy_sample_string(
        self,
        jobs_data: JobsData,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """Test that get() exposes the legacy sample string, not the integer FK.

        The create_sample workflow addresses the sample over the jobs API, which
        resolves samples by their Mongo ``_id``, so ``args["sample_id"]`` must
        stay the legacy string even after the integer ``sample_id`` foreign key
        is populated by the backfill.
        """
        user = await fake.users.create()

        job = await jobs_data.create(
            "create_sample",
            {"sample_id": "mapped_sample"},
            user.id,
            0,
        )

        assert (await jobs_data.get(job.id)).args["sample_id"] == "mapped_sample"

        async with AsyncSession(pg) as session:
            sample = SQLLegacySample(
                legacy_id="mapped_sample",
                name="mapped_sample",
                library_type="normal",
                created_at=arrow.utcnow().naive,
            )
            session.add(sample)
            await session.flush()
            sample_pk = sample.id

            job_sample = (
                await session.execute(
                    select(SQLJobSample).where(SQLJobSample.job_id == job.id),
                )
            ).scalar()
            job_sample.sample_id = sample_pk
            await session.commit()

        assert (await jobs_data.get(job.id)).args["sample_id"] == "mapped_sample"

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
                    select(SQLJob).where(SQLJob.id == job.id),
                )
            ).scalar()

            job_index = (
                await session.execute(
                    select(SQLJobIndex).where(SQLJobIndex.job_id == sql_job.id),
                )
            ).scalar()

        assert job_index is not None
        assert job_index.index_id == "index_456"

    async def test_subtraction_id_resolved_from_subtraction(
        self,
        jobs_data: JobsData,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """``get`` resolves the subtraction id from the subtraction linked by job_id."""
        user = await fake.users.create()

        job = await jobs_data.create("create_subtraction", {}, user.id, 0)

        async with AsyncSession(pg) as session:
            subtraction = SQLSubtraction(
                legacy_id="sub_789",
                name="Subtraction 789",
                created_at=arrow.utcnow().naive,
                user_id=user.id,
                job_id=job.id,
            )
            session.add(subtraction)
            await session.flush()
            subtraction_id = subtraction.id
            await session.commit()

        fetched_job = await jobs_data.get(job.id)
        assert fetched_job.args == {"subtraction_id": subtraction_id}

    @pytest.mark.parametrize("workflow", ["aodp", "nuvs", "pathoscope"])
    async def test_analysis_id_resolved_from_analysis(
        self,
        workflow: str,
        jobs_data: JobsData,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """``get`` resolves the analysis id from the analysis row linked by job_id."""
        user = await fake.users.create()

        job = await jobs_data.create(
            workflow,
            {"analysis_id": "analysis_abc"},
            user.id,
            0,
        )

        async with AsyncSession(pg) as session:
            session.add(
                SQLAnalysis(
                    legacy_id="analysis_abc",
                    created_at=arrow.utcnow().naive,
                    updated_at=arrow.utcnow().naive,
                    workflow=workflow,
                    ready=False,
                    sample="sample_abc",
                    reference="ref_abc",
                    index="index_abc",
                    user_id=user.id,
                    job_id=job.id,
                ),
            )
            await session.commit()

        fetched_job = await jobs_data.get(job.id)
        assert fetched_job.args == {"analysis_id": "analysis_abc"}


class TestStartStepPostgres:
    """Test that start_step() records step starts in Postgres."""

    async def test_progress_is_derived_from_started_steps(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
        static_time: StaticTime,
    ):
        user = await fake.users.create()
        job = await fake.jobs.create(user, state=JobState.RUNNING)

        async with AsyncSession(pg) as session:
            result = await session.execute(
                select(SQLJob).where(SQLJob.id == job.id),
            )
            sql_job = result.scalar()
            sql_job.steps = [
                {"id": "step_1", "name": "Step 1", "description": "First step"},
                {"id": "step_2", "name": "Step 2", "description": "Second step"},
            ]
            modern_job_id = sql_job.id
            await session.commit()

        await data_layer.jobs.start_step(modern_job_id, "step_1")

        updated_job = await data_layer.jobs.get(job.id)

        assert updated_job.progress == 50
        assert (
            updated_job.steps[0].started_at.replace(tzinfo=None) == static_time.datetime
        )
        assert updated_job.steps[1].started_at is None

    async def test_emits_job_update_event(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """Starting a step emits a jobs-domain update carrying the job id.

        The event data must be the full job (keyed by the integer job id), not
        the step status, so the websocket server can refetch and push the job.
        """
        user = await fake.users.create()
        job = await fake.jobs.create(user, state=JobState.RUNNING)

        async with AsyncSession(pg) as session:
            sql_job = (
                await session.execute(select(SQLJob).where(SQLJob.id == job.id))
            ).scalar()
            sql_job.steps = [
                {"id": "step_1", "name": "Step 1", "description": "First step"},
            ]
            await session.commit()

        dangerously_clear_events()

        await data_layer.jobs.start_step(job.id, "step_1")

        event = await dangerously_get_event()

        assert event.domain == "jobs"
        assert event.operation == Operation.UPDATE
        assert isinstance(event.data, Job)
        assert event.data.id == job.id


class TestClaim:
    """Test the claim() method of JobsData."""

    async def test_emits_job_without_secret_key(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """Claiming a job emits a jobs-domain update carrying a Job, not JobClaimed.

        The emitted data must not be the JobClaimed object, which carries the
        one-time secret runner key.
        """
        user = await fake.users.create()

        async with AsyncSession(pg) as session:
            sql_job = SQLJob(
                created_at=arrow.utcnow().naive,
                state="pending",
                user_id=user.id,
                workflow="nuvs",
            )
            session.add(sql_job)
            await session.flush()
            job_id = sql_job.id
            await session.commit()

        dangerously_clear_events()

        await data_layer.jobs.claim(
            Workflow.NUVS,
            CreateJobClaimRequest(
                runner_id="runner-1",
                mem=8.0,
                cpu=4.0,
                image="virtool/workflow:1.0.0",
                runtime_version="1.0.0",
                workflow_version="2.0.0",
                steps=[
                    JobStepDefinition(
                        id="step_1",
                        name="Step 1",
                        description="First step",
                    ),
                ],
            ),
        )

        event = await dangerously_get_event()

        assert event.domain == "jobs"
        assert event.operation == Operation.UPDATE
        assert isinstance(event.data, Job)
        assert not isinstance(event.data, JobClaimed)
        assert event.data.id == job_id


class TestFinish:
    """Test the finish() method of JobsData."""

    async def test_ok(
        self,
        fake: DataFaker,
        jobs_data: JobsData,
        pg: AsyncEngine,
        static_time: StaticTime,
    ):
        user = await fake.users.create()
        job = await fake.jobs.create(user, state=JobState.RUNNING)

        finished = await jobs_data.finish(job.id)

        assert finished.state == JobState.SUCCEEDED

        async with AsyncSession(pg) as session:
            sql_job = (
                await session.execute(select(SQLJob).where(SQLJob.id == job.id))
            ).scalar()

        assert sql_job.state == "succeeded"
        assert sql_job.finished_at == static_time.datetime

    async def test_not_found(self, jobs_data: JobsData):
        with pytest.raises(ResourceNotFoundError):
            await jobs_data.finish(999999)

    @pytest.mark.parametrize(
        "state",
        [JobState.PENDING, JobState.SUCCEEDED, JobState.FAILED, JobState.CANCELLED],
    )
    async def test_not_running(
        self,
        state: JobState,
        fake: DataFaker,
        jobs_data: JobsData,
    ):
        user = await fake.users.create()
        job = await fake.jobs.create(user, state=state)

        with pytest.raises(ResourceConflictError):
            await jobs_data.finish(job.id)


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

        job = await jobs_data.create("build_index", {}, user.id, 0)

        await jobs_data.cancel(job.id)

        async with AsyncSession(pg) as session:
            result = await session.execute(
                select(SQLJob).where(SQLJob.id == job.id),
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
                select(SQLJob).where(SQLJob.id == job.id),
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
                select(SQLJob).where(SQLJob.id == job.id),
            )
            sql_job = result.scalar()

        assert sql_job.state == "failed"
        assert sql_job.finished_at is not None
