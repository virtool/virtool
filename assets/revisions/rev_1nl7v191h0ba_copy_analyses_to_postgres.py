"""copy analyses to postgres

Revision ID: 1nl7v191h0ba
Date: 2026-06-03 00:10:43.710684

"""

import arrow
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from structlog import get_logger

from virtool.analyses.sql import SQLAnalysis, SQLAnalysisResult
from virtool.data.topg import compose_legacy_id_single_expression
from virtool.jobs.pg import SQLJob
from virtool.migration import MigrationContext
from virtool.pg.base import Base
from virtool.users.pg import SQLUser

logger = get_logger("migration")

# Revision identifiers.
name = "copy analyses to postgres"
created_at = arrow.get("2026-06-03 00:10:43.710684")
revision_id = "1nl7v191h0ba"

alembic_down_revision = "1e6490edc217"
virtool_down_revision = None

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = "1e6490edc217"


async def upgrade(ctx: MigrationContext) -> None:
    """Backfill every Mongo ``analyses`` document into the Postgres ``analyses`` table.

    One row is written per Mongo document, including result content. Documents
    are processed one at a time and committed individually, so memory stays
    bounded to a single document and its (potentially large) result body, and a
    failure part-way through keeps the rows already written rather than rolling
    back the entire collection.

    The document ``_id`` values are snapshotted up front so the rest of the run
    fetches one document at a time by id, rather than holding a single Mongo
    cursor open for the whole migration. With large documents that each take real
    time to write, a long-lived cursor would risk the server idle/lifetime
    timeout.

    Documents already present in Postgres (by ``legacy_id``) are skipped, and the
    insert uses ``ON CONFLICT (legacy_id) DO NOTHING`` as a second line of
    defence, so the migration is safe to re-run after an interruption.

    Fails loudly on any document it cannot faithfully map: an unresolvable
    ``user`` or ``job`` reference raises, and a ``"file"`` results marker raises.
    """
    async with AsyncSession(ctx.pg) as session:
        existing_result = await session.execute(
            select(SQLAnalysis.legacy_id).where(SQLAnalysis.legacy_id.isnot(None)),
        )
        existing_legacy_ids = {row[0] for row in existing_result}

        logger.info(
            "found existing analyses in postgres",
            count=len(existing_legacy_ids),
        )

        analysis_ids = [
            document["_id"]
            async for document in ctx.mongo.analyses.find({}, projection=["_id"])
        ]

        migrated_count = 0
        skipped_count = 0

        user_id_cache: dict[int | str, int | None] = {}
        job_id_cache: dict[int | str, int | None] = {}

        for analysis_id in analysis_ids:
            if analysis_id in existing_legacy_ids:
                skipped_count += 1
                continue

            document = await ctx.mongo.analyses.find_one({"_id": analysis_id})

            if document is None:
                skipped_count += 1
                continue

            results = await _resolve_results(session, document)
            user_id = await _resolve_user_id(session, document, user_id_cache)
            job_id = await _resolve_job_id(session, document, job_id_cache)

            await session.execute(
                insert(SQLAnalysis)
                .values(**_build_values(document, results, user_id, job_id))
                .on_conflict_do_nothing(index_elements=["legacy_id"]),
            )
            await session.commit()

            migrated_count += 1

        logger.info(
            "analysis migration complete",
            migrated=migrated_count,
            skipped=skipped_count,
        )


def _build_values(
    document: dict,
    results: dict | None,
    user_id: int,
    job_id: int | None,
) -> dict:
    """Map a Mongo analysis document to a ``SQLAnalysis`` values dict.

    The integer ``id`` is omitted so the database assigns the identity surrogate
    key. The ``space`` field is intentionally dropped. ``user_id`` and ``job_id``
    are the resolved Postgres integer foreign keys, not the raw Mongo references.
    """
    return {
        "legacy_id": document["_id"],
        "created_at": document["created_at"],
        "updated_at": document.get("updated_at") or document["created_at"],
        "workflow": document["workflow"],
        "ready": document["ready"],
        "results": results,
        "sample": document["sample"]["id"],
        "reference": document["reference"]["id"],
        "index": document["index"]["id"],
        "subtractions": document.get("subtractions") or [],
        "user_id": user_id,
        "job_id": job_id,
        "ml_id": document.get("ml"),
    }


async def _resolve_id(
    session: AsyncSession,
    model: type[Base],
    reference: int | str,
    cache: dict[int | str, int | None],
) -> int | None:
    """Resolve a Mongo reference to a Postgres primary key, memoising results.

    The reference may be a legacy string id or a modern integer id. The resolved
    id (or ``None`` if no row matches) is cached by reference so that analyses
    sharing the same user or job do not each issue a query.
    """
    if reference in cache:
        return cache[reference]

    resolved = (
        await session.execute(
            select(model.id).where(
                compose_legacy_id_single_expression(model, reference),
            ),
        )
    ).scalar_one_or_none()

    cache[reference] = resolved

    return resolved


async def _resolve_user_id(
    session: AsyncSession,
    document: dict,
    cache: dict[int | str, int | None],
) -> int:
    """Resolve a document's ``user`` reference to a Postgres ``users.id``.

    Raises if the referenced user is not present in Postgres.
    """
    reference = document["user"]["id"]

    user_id = await _resolve_id(session, SQLUser, reference, cache)

    if user_id is None:
        msg = f"Analysis {document['_id']} references unknown user {reference!r}"
        raise ValueError(msg)

    return user_id


async def _resolve_job_id(
    session: AsyncSession,
    document: dict,
    cache: dict[int | str, int | None],
) -> int | None:
    """Resolve a document's ``job`` reference to a Postgres ``jobs.id``.

    Returns ``None`` when the document has no job. Raises if a job is referenced
    but not present in Postgres, rather than silently dropping the association.
    """
    job = document.get("job")

    if job is None:
        return None

    reference = job["id"]

    job_id = await _resolve_id(session, SQLJob, reference, cache)

    if job_id is None:
        msg = f"Analysis {document['_id']} references unknown job {reference!r}"
        raise ValueError(msg)

    return job_id


async def _resolve_results(session: AsyncSession, document: dict) -> dict | None:
    """Resolve the actual results content from a document's results marker.

    - ``None`` / absent -> ``None``
    - ``"sql"`` -> content from the ``analysis_results`` table for this document
    - inline ``dict`` -> the dict itself
    - ``"file"`` -> raise; result content lives in object storage and must never
      be read here (production count is 0).
    """
    results = document.get("results")

    if results is None:
        return None

    if results == "sql":
        result = await session.execute(
            select(SQLAnalysisResult.results).where(
                SQLAnalysisResult.analysis_id == document["_id"],
            ),
        )
        return result.scalar_one()

    if results == "file":
        msg = f"Analysis {document['_id']} has file-backed results; cannot migrate"
        raise ValueError(msg)

    if isinstance(results, dict):
        return results

    msg = f"Analysis {document['_id']} has unexpected results value {results!r}"
    raise ValueError(msg)
