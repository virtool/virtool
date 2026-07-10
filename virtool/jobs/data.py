import math
from collections import defaultdict

import arrow
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from structlog import get_logger

import virtool.utils
from virtool.analyses.sql import SQLAnalysis
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.events import Operation, emit, emits
from virtool.data.transforms import apply_transforms
from virtool.jobs.models import (
    CreateJobClaimRequest,
    Job,
    JobClaim,
    JobClaimed,
    JobCounts,
    JobMinimal,
    JobPing,
    JobSearchResult,
    JobState,
    JobStep,
    JobStepStarted,
    Workflow,
)
from virtool.jobs.pg import (
    SQLJob,
    SQLJobIndex,
)
from virtool.jobs.utils import compute_progress
from virtool.samples.sql import SQLLegacySample
from virtool.subtractions.pg import SQLSubtraction
from virtool.types import Document
from virtool.users.models_base import UserNested
from virtool.users.pg import SQLUser
from virtool.users.transforms import AttachUserTransform

logger = get_logger("jobs")

JOB_CLEAN_DOUBLE_CHECK_DELAY = 15
"""Delay before checking for queued jobs again during the clean task."""


class JobsData:
    name = "jobs"

    def __init__(self, pg: AsyncEngine):
        self._pg = pg

    async def get_counts(self) -> JobCounts:
        """Get job counts grouped by state and workflow."""
        async with AsyncSession(self._pg) as session:
            return await self._query_counts(session)

    async def _query_counts(self, session: AsyncSession) -> JobCounts:
        """Run the counts query against an existing session."""
        counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))

        result = await session.execute(
            select(SQLJob.state, SQLJob.workflow, func.count()).group_by(
                SQLJob.state,
                SQLJob.workflow,
            ),
        )

        for state, workflow, count in result.all():
            counts[state][workflow] = count

        return JobCounts.parse_obj(counts)

    async def find(
        self,
        page: int,
        per_page: int,
        states: list[JobState],
        users: list[str],
    ) -> JobSearchResult:
        """Find jobs."""
        filters = []

        if states:
            filters.append(SQLJob.state.in_([s.value for s in states]))

        async with AsyncSession(self._pg) as session:
            if users:
                modern_ids: list[int] = []
                handles_or_legacy: list[str] = []

                for user in users:
                    if isinstance(user, int):
                        modern_ids.append(user)
                    elif user.isdigit():
                        modern_ids.append(int(user))
                    else:
                        handles_or_legacy.append(user)

                user_clauses = []

                if modern_ids:
                    user_clauses.append(SQLUser.id.in_(modern_ids))

                if handles_or_legacy:
                    user_clauses.append(SQLUser.legacy_id.in_(handles_or_legacy))
                    user_clauses.append(SQLUser.handle.in_(handles_or_legacy))

                resolved = await session.execute(
                    select(SQLUser.id).where(or_(*user_clauses)),
                )
                resolved_user_ids = [row[0] for row in resolved.all()]

                if not resolved_user_ids:
                    total_count = (
                        await session.execute(
                            select(func.count()).select_from(SQLJob),
                        )
                    ).scalar_one()

                    return JobSearchResult(
                        counts=await self._query_counts(session),
                        items=[],
                        total_count=total_count,
                        found_count=0,
                        page_count=0,
                        per_page=per_page,
                        page=page,
                    )

                filters.append(SQLJob.user_id.in_(resolved_user_ids))

            skip_count = (page - 1) * per_page if page > 1 else 0

            total_count = (
                await session.execute(select(func.count()).select_from(SQLJob))
            ).scalar_one()

            found_count_query = select(func.count()).select_from(SQLJob)
            if filters:
                found_count_query = found_count_query.where(*filters)
            found_count = (await session.execute(found_count_query)).scalar_one()

            data_query = (
                select(SQLJob, SQLUser)
                .join(SQLUser, SQLJob.user_id == SQLUser.id)
                .order_by(SQLJob.created_at.desc())
                .offset(skip_count)
                .limit(per_page)
            )
            if filters:
                data_query = data_query.where(*filters)

            rows = (await session.execute(data_query)).unique().all()

            counts = await self._query_counts(session)

        page_count = int(math.ceil(found_count / per_page)) if found_count else 0

        items = [
            JobMinimal(
                id=sql_job.id,
                created_at=sql_job.created_at,
                progress=compute_progress(sql_job.state, sql_job.steps),
                state=JobState(sql_job.state),
                user=UserNested(id=sql_user.id, handle=sql_user.handle),
                workflow=Workflow(sql_job.workflow),
            )
            for sql_job, sql_user in rows
        ]

        return JobSearchResult(
            counts=counts,
            items=items,
            total_count=total_count,
            found_count=found_count,
            page_count=page_count,
            per_page=per_page,
            page=page,
        )

    async def create_in_session(
        self,
        session: AsyncSession,
        workflow: str,
        job_args: Document,
        user_id: int,
    ) -> int:
        """Create a job within the caller's session and return its id.

        The job is added to ``session`` and flushed but not committed, so it
        participates in the caller's transaction and only becomes claimable once
        that transaction commits. This lets a job be created atomically with the
        resource that supplies its arguments — e.g. a ``create_sample`` job and
        its sample, whose ``legacy_samples.job_id`` back-reference is the source
        of the job's ``sample_id`` argument. Without this a runner could claim the
        job before the sample row commits and read empty arguments.

        It is the caller's responsibility to commit ``session``. Unlike
        :meth:`create`, this does not emit a job-creation event; the caller should
        emit once its transaction has committed.

        :param session: the PostgreSQL session to create the job within
        :param workflow: the name of the workflow to run
        :param job_args: the arguments required to run the job
        :param user_id: the user that started the job
        :return: the id of the created job
        """
        sql_job = SQLJob(
            acquired=False,
            created_at=virtool.utils.timestamp(),
            state="pending",
            user_id=user_id,
            workflow=workflow,
        )
        session.add(sql_job)
        await session.flush()

        if workflow == "build_index" and "index_id" in job_args:
            session.add(SQLJobIndex(job_id=sql_job.id, index_id=job_args["index_id"]))

        return sql_job.id

    @emits(Operation.CREATE)
    async def create(
        self,
        workflow: str,
        job_args: Document,
        user_id: int,
        space_id: int = 1,
    ) -> Job:
        """Create a job record.

        :param workflow: the name of the workflow to run
        :param job_args: the arguments required to run the job
        :param user_id: the user that started the job
        :param space_id: the space that the job belongs to
        """
        async with AsyncSession(self._pg) as session:
            new_id = await self.create_in_session(session, workflow, job_args, user_id)
            await session.commit()

        return await self.get(new_id)

    async def get(self, job_id: int) -> Job:
        """Get a job by ID.

        :param job_id: the ID of the job
        :return: the job
        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                select(
                    SQLJob,
                    SQLUser,
                    SQLLegacySample.id.label("sample_id"),
                    SQLJobIndex.index_id,
                    SQLSubtraction.id.label("subtraction_id"),
                    SQLAnalysis.id.label("analysis_id"),
                )
                .join(SQLUser, SQLJob.user_id == SQLUser.id)
                .outerjoin(SQLLegacySample, SQLLegacySample.job_id == SQLJob.id)
                .outerjoin(SQLJobIndex, SQLJob.id == SQLJobIndex.job_id)
                .outerjoin(SQLSubtraction, SQLSubtraction.job_id == SQLJob.id)
                .outerjoin(SQLAnalysis, SQLAnalysis.job_id == SQLJob.id)
                .where(SQLJob.id == job_id),
            )
            row = result.unique().first()

        if row is None:
            raise ResourceNotFoundError

        sql_job, sql_user, sample_id, index_id, subtraction_id, analysis_id = row

        # The create_sample job's sample is resolved through the reverse
        # ``legacy_samples.job_id`` foreign key rather than a ``job_samples`` link
        # row.
        args = {
            field: value
            for field, value in (
                ("sample_id", sample_id),
                ("index_id", index_id),
                ("subtraction_id", subtraction_id),
                ("analysis_id", analysis_id),
            )
            if value is not None
        }

        return Job(
            id=sql_job.id,
            args=args,
            claim=JobClaim(**sql_job.claim) if sql_job.claim else None,
            claimed_at=sql_job.claimed_at,
            created_at=sql_job.created_at,
            pinged_at=sql_job.pinged_at,
            progress=compute_progress(sql_job.state, sql_job.steps),
            state=JobState(sql_job.state),
            steps=[JobStep(**s) for s in sql_job.steps] if sql_job.steps else None,
            user=UserNested(id=sql_user.id, handle=sql_user.handle),
            workflow=Workflow(sql_job.workflow),
        )

    async def claim(
        self, workflow: Workflow, body: CreateJobClaimRequest
    ) -> JobClaimed:
        """Find and claim an available job.

        Finds the oldest unclaimed job for the given workflow and claims it
        atomically.

        :param workflow: the workflow type to claim a job for
        :param body: claim request body with runner metadata and steps
        :return: the job with the secret key
        :raises ResourceNotFoundError: if no unclaimed job is available
        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                select(SQLJob)
                .where(
                    SQLJob.workflow == workflow.value,
                    SQLJob.acquired == False,  # noqa: E712
                    SQLJob.state == "pending",
                )
                .order_by(SQLJob.created_at)
                .limit(1)
                .with_for_update(skip_locked=True),
            )
            job = result.scalar()

            if job is None:
                raise ResourceNotFoundError("No job available")

            key, hashed = virtool.utils.generate_key()
            now = virtool.utils.timestamp()

            claim = JobClaim(**body.dict(exclude={"steps"}))
            steps = [JobStep(**step.dict(), started_at=None) for step in body.steps]

            job.acquired = True
            job.claim = claim.dict()
            job.claimed_at = now
            job.key = hashed
            job.pinged_at = now
            job.state = "running"
            job.steps = [step.dict() for step in steps]

            job_id = job.id
            created_at = job.created_at
            user_id = job.user_id

            await session.commit()

        document = await apply_transforms(
            {"user": {"id": user_id}},
            [AttachUserTransform(self._pg)],
            self._pg,
        )

        emit(await self.get(job_id), self.name, "claim", Operation.UPDATE)

        return JobClaimed(
            id=job_id,
            acquired=True,
            claim=claim,
            claimed_at=now,
            created_at=created_at,
            key=key,
            state=JobState.RUNNING,
            steps=steps,
            user=UserNested(**document["user"]),
            workflow=workflow,
        )

    async def start_step(self, job_id: int, step_id: str) -> JobStepStarted:
        """Start a job step.

        Sets the `started_at` timestamp on the step identified by `step_id`.

        :param job_id: the ID of the job
        :param step_id: the ID of the step to start
        :return: the step status
        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(select(SQLJob).where(SQLJob.id == job_id))
            job = result.scalar()

            if job is None:
                raise ResourceNotFoundError("Job not found")

            if job.state in ("cancelled", "failed", "succeeded"):
                raise ResourceConflictError("Job is in a terminal state")

            if not job.steps:
                raise ResourceNotFoundError("Step not found")

            step_index = next(
                (i for i, s in enumerate(job.steps) if s.get("id") == step_id),
                None,
            )

            if step_index is None:
                raise ResourceNotFoundError("Step not found")

            step = job.steps[step_index]

            if step.get("started_at") is not None:
                raise ResourceConflictError("Step already started")

            now = virtool.utils.timestamp()

            updated_steps = list(job.steps)
            updated_steps[step_index] = {**step, "started_at": now}
            job.steps = updated_steps

            await session.commit()

        emit(await self.get(job_id), self.name, "start_step", Operation.UPDATE)

        return JobStepStarted(
            id=step["id"],
            name=step["name"],
            description=step["description"],
            started_at=now,
        )

    async def ping(self, job_id: int) -> JobPing:
        """Update the pinged_at timestamp on a job.

        :param job_id: the ID of the job to ping
        :return: the ping response
        """
        now = virtool.utils.timestamp()

        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                select(SQLJob).where(SQLJob.id == job_id),
            )
            sql_job = result.scalar()

            if sql_job is None:
                raise ResourceNotFoundError("Job not found")

            sql_job.pinged_at = now
            cancelled = sql_job.state == "cancelled"

            await session.commit()

        return JobPing(
            cancelled=cancelled,
            pinged_at=now,
        )

    @emits(Operation.UPDATE)
    async def finish(self, job_id: int) -> Job:
        """Finish a job.

        Marks the job as succeeded.

        :param job_id: the ID of the job to finish
        :return: the updated job
        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                select(SQLJob).where(SQLJob.id == job_id).with_for_update(),
            )
            sql_job = result.scalar()

            if sql_job is None:
                raise ResourceNotFoundError

            if sql_job.state != "running":
                raise ResourceConflictError("Job is not running")

            sql_job.state = JobState.SUCCEEDED.value
            sql_job.finished_at = virtool.utils.timestamp()

            await session.commit()

        return await self.get(job_id)

    @emits(Operation.UPDATE)
    async def cancel(self, job_id: int) -> Job:
        """Cancel a job.

        :param job_id: the ID of the job to cancel
        :return: the updated job
        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                select(SQLJob).where(SQLJob.id == job_id),
            )
            sql_job = result.scalar()

            if sql_job is None:
                raise ResourceNotFoundError

            if sql_job.state not in ("pending", "running"):
                raise ResourceConflictError("Not cancellable")

            sql_job.state = JobState.CANCELLED.value
            sql_job.finished_at = virtool.utils.timestamp()

            await session.commit()

        return await self.get(job_id)

    async def delete(self, job_id: int) -> None:
        """Delete a job by its ID.

        :param job_id: the ID of the job to delete
        """
        job = await self.get(job_id)

        if job.state in (JobState.PENDING, JobState.RUNNING):
            raise ResourceConflictError(
                "Job is running or pending and cannot be removed.",
            )

        async with AsyncSession(self._pg) as session:
            await session.execute(delete(SQLJob).where(SQLJob.id == job_id))
            await session.commit()

        emit(job, "jobs", "delete", Operation.DELETE)

    async def force_delete(self) -> None:
        """Force the deletion of all jobs."""
        async with AsyncSession(self._pg) as session:
            await session.execute(delete(SQLJob))
            await session.commit()

    async def timeout_stalled_jobs(self) -> int:
        """Timeout stalled jobs.

        Finds running jobs that have not been pinged in the last 5 minutes
        and marks them as failed.

        :return: the number of jobs that were timed out
        """
        cutoff = arrow.utcnow().shift(minutes=-5).naive
        now = virtool.utils.timestamp()
        timeout_count = 0

        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                select(SQLJob)
                .where(
                    SQLJob.state == "running",
                    SQLJob.pinged_at < cutoff,
                )
                .with_for_update(),
            )
            stalled_jobs = result.scalars().all()

            stalled_ids = []

            for sql_job in stalled_jobs:
                sql_job.state = JobState.FAILED.value
                sql_job.finished_at = now
                stalled_ids.append(sql_job.id)
                timeout_count += 1

            await session.commit()

        for job_id in stalled_ids:
            try:
                emit(
                    await self.get(job_id),
                    self.name,
                    "timeout",
                    Operation.UPDATE,
                )
            except Exception as e:
                logger.warning(
                    "failed to emit timeout event",
                    error=str(e),
                    job_id=job_id,
                )

        if timeout_count > 0:
            logger.info("timed out stalled jobs", count=timeout_count)

        return timeout_count
