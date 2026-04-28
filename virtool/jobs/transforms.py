from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.transforms import AbstractTransform, apply_transforms
from virtool.jobs.pg import SQLJob
from virtool.jobs.utils import compute_progress
from virtool.types import Document
from virtool.users.transforms import AttachUserTransform
from virtool.utils import get_safely


class AttachJobTransform(AbstractTransform):
    def __init__(self, pg: AsyncEngine):
        self._pg = pg

    async def attach_one(self, document: Document, prepared: Document) -> Document:
        return {**document, "job": prepared}

    async def prepare_one(
        self, document: Document, session: AsyncSession
    ) -> Document | None:
        job_id = get_safely(document, "job", "id")

        if job_id is None:
            return None

        async with AsyncSession(self._pg) as pg_session:
            sql_job = (
                await pg_session.execute(
                    select(SQLJob).where(_match_job_id(job_id)),
                )
            ).scalar()

        if sql_job is None:
            return None

        return await apply_transforms(
            _serialize(sql_job),
            [AttachUserTransform(self._pg)],
            self._pg,
        )

    async def prepare_many(
        self,
        documents: list[Document],
        session: AsyncSession,
    ) -> dict[str, Document | None]:
        job_ids = {get_safely(d, "job", "id") for d in documents}
        job_ids.discard(None)

        if job_ids:
            async with AsyncSession(self._pg) as pg_session:
                sql_jobs = (
                    (
                        await pg_session.execute(
                            select(SQLJob).where(_match_job_ids(job_ids)),
                        )
                    )
                    .scalars()
                    .all()
                )
        else:
            sql_jobs = []

        jobs = await apply_transforms(
            [_serialize(sql_job) for sql_job in sql_jobs],
            [AttachUserTransform(self._pg)],
            self._pg,
        )

        jobs_by_pg_id = {sql_job.id: job for sql_job, job in zip(sql_jobs, jobs)}
        jobs_by_legacy_id = {
            sql_job.legacy_id: job
            for sql_job, job in zip(sql_jobs, jobs)
            if sql_job.legacy_id is not None
        }

        def lookup(job_id):
            if job_id is None:
                return None
            if isinstance(job_id, int) or (isinstance(job_id, str) and job_id.isdigit()):
                return jobs_by_pg_id.get(int(job_id)) or jobs_by_legacy_id.get(str(job_id))
            return jobs_by_legacy_id.get(job_id)

        return {d["id"]: lookup(get_safely(d, "job", "id")) for d in documents}


def _serialize(sql_job: SQLJob) -> Document:
    return {
        "id": sql_job.id,
        "created_at": sql_job.created_at,
        "progress": compute_progress(sql_job.state, sql_job.steps),
        "state": sql_job.state,
        "user": {"id": sql_job.user_id},
        "workflow": sql_job.workflow,
    }


def _match_job_id(job_id: int | str):
    if isinstance(job_id, int) or (isinstance(job_id, str) and job_id.isdigit()):
        return or_(SQLJob.id == int(job_id), SQLJob.legacy_id == str(job_id))
    return SQLJob.legacy_id == job_id


def _match_job_ids(job_ids: set):
    pg_ids: list[int] = []
    legacy_ids: list[str] = []

    for jid in job_ids:
        if isinstance(jid, int):
            pg_ids.append(jid)
        elif isinstance(jid, str) and jid.isdigit():
            pg_ids.append(int(jid))
            legacy_ids.append(jid)
        else:
            legacy_ids.append(jid)

    clauses = []
    if pg_ids:
        clauses.append(SQLJob.id.in_(pg_ids))
    if legacy_ids:
        clauses.append(SQLJob.legacy_id.in_(legacy_ids))

    return or_(*clauses)
