"""Postgres persistence helpers for jobs.

These functions add job rows to a caller-supplied :class:`AsyncSession` without
committing, so a job can be created atomically alongside the resource it
operates on (e.g. a subtraction) inside a single transaction. The data layer
owns the transaction boundary and event emission; this module owns the SQL.
"""

from sqlalchemy.ext.asyncio import AsyncSession

import virtool.utils
from virtool.jobs.pg import SQLJob, SQLJobIndex, SQLJobSample
from virtool.types import Document


async def create_job(
    session: AsyncSession,
    workflow: str,
    args: Document,
    user_id: int,
) -> SQLJob:
    """Add a pending job and its workflow relationship row to ``session``.

    The job is flushed so its identity is available to the caller, but the
    caller owns the commit. This lets the job be persisted in the same
    transaction as the resource it creates.

    :param session: the session to add the job to
    :param workflow: the name of the workflow to run
    :param args: the arguments required to run the job
    :param user_id: the user that started the job
    :return: the added :class:`SQLJob`, flushed
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

    if workflow == "create_sample" and "sample_id" in args:
        session.add(SQLJobSample(job_id=sql_job.id, sample_id=args["sample_id"]))
    elif workflow == "build_index" and "index_id" in args:
        session.add(SQLJobIndex(job_id=sql_job.id, index_id=args["index_id"]))

    return sql_job
