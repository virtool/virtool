from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.analyses.sql import SQLAnalysis, SQLAnalysisSubtraction
from virtool.data.topg import (
    compose_legacy_id_multi_expression,
    compose_legacy_id_single_expression,
)
from virtool.mongo.core import Mongo
from virtool.references.sql import SQLReference
from virtool.samples.sql import SQLLegacySample
from virtool.subtractions.pg import SQLSubtraction


async def seed_analysis(mongo: Mongo, pg: AsyncEngine, document: dict) -> int:
    """Seed an analysis into both backends and its index, mirroring production
    dual-writes.

    The index version is taken from the inline ``index.version`` and written to the
    ``indexes`` collection, where ``AttachIndexTransform`` resolves it at read time.
    This is an upsert rather than a ``fake.indexes.create`` call because the analysis
    names its own index: the write back-fills a version for that id instead of creating
    an index resource, and the transform reads nothing else off the document. A test
    that needs a real index creates one with ``fake.indexes.create`` and names it in
    ``index.id``, in which case this only stamps the version onto that index.

    Non-integer ``job.id`` placeholders are stored as a null ``job_id`` since the
    Postgres column is a foreign key to ``jobs.id``.

    The parent sample must already exist. ``sample.id`` addresses it by either its
    integer primary key or its ``legacy_id``.

    A sample that does not resolve is left unseeded, giving the analysis a null
    ``sample_id``. That is the only shape a parentless analysis can take in Postgres,
    where the foreign key guarantees a non-null ``sample_id`` points at a real row.

    :return: the integer ``analyses.id`` of the seeded row
    """
    index = document["index"]
    job = document.get("job")
    results = document.get("results")
    subtractions = document.get("subtractions") or []

    await mongo.indexes.update_one(
        {"_id": index["id"]},
        {"$set": {"version": index["version"]}},
        upsert=True,
    )

    await mongo.analyses.insert_one(document)

    sample = document["sample"]
    reference = document["reference"]

    async with AsyncSession(pg) as session:
        sample_row = (
            await session.execute(
                select(SQLLegacySample.id, SQLLegacySample.legacy_id).where(
                    compose_legacy_id_single_expression(SQLLegacySample, sample["id"]),
                ),
            )
        ).first()

        if sample_row is None:
            sample_pg_id = None
            sample_storage_id = str(sample["id"])
        else:
            sample_pg_id = sample_row.id
            sample_storage_id = sample_row.legacy_id or str(sample_row.id)

        reference_row = (
            await session.execute(
                select(SQLReference.id, SQLReference.legacy_id).where(
                    compose_legacy_id_single_expression(SQLReference, reference["id"]),
                ),
            )
        ).first()

        if reference_row is None:
            if not isinstance(reference["id"], str):
                raise AssertionError(
                    f"No reference row for primary key {reference['id']}",
                )

            reference_doc = await mongo.references.find_one(reference["id"], ["name"])
            reference_name = (
                reference_doc["name"]
                if reference_doc
                else reference.get("name", reference["id"])
            )
            legacy_reference = SQLReference(
                legacy_id=reference["id"],
                name=reference_name,
                description="",
                created_at=document["created_at"],
                source_types=[],
                user_id=document["user"]["id"],
            )
            session.add(legacy_reference)
            await session.flush()
            reference_pg_id = legacy_reference.id
            reference_legacy_id = legacy_reference.legacy_id
        else:
            reference_pg_id = reference_row.id
            reference_legacy_id = reference_row.legacy_id

        analysis = SQLAnalysis(
            legacy_id=document["_id"],
            created_at=document["created_at"],
            updated_at=document.get("updated_at", document["created_at"]),
            workflow=document["workflow"],
            ready=document["ready"],
            results=results if isinstance(results, dict) else None,
            sample=sample_storage_id,
            sample_id=sample_pg_id,
            reference=reference_legacy_id or str(reference_pg_id),
            reference_id=reference_pg_id,
            index=index["id"],
            user_id=document["user"]["id"],
            job_id=job["id"] if job and isinstance(job["id"], int) else None,
        )

        session.add(analysis)
        await session.flush()

        analysis_id = analysis.id

        if subtractions:
            subtraction_ids = (
                (
                    await session.execute(
                        select(SQLSubtraction.id).where(
                            compose_legacy_id_multi_expression(
                                SQLSubtraction, subtractions
                            ),
                        ),
                    )
                )
                .scalars()
                .all()
            )

            if len(subtraction_ids) != len(set(subtractions)):
                raise AssertionError(
                    "seed_analysis received unresolved subtraction identifiers",
                )

            session.add_all(
                SQLAnalysisSubtraction(
                    analysis_id=analysis_id,
                    subtraction_id=subtraction_id,
                )
                for subtraction_id in subtraction_ids
            )

        await session.commit()

    return analysis_id
