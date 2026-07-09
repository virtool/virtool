from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.analyses.sql import SQLAnalysis, SQLAnalysisSubtraction
from virtool.data.topg import compose_legacy_id_multi_expression
from virtool.mongo.core import Mongo
from virtool.references.sql import SQLReference
from virtool.samples.sql import SQLLegacySample
from virtool.subtractions.pg import SQLSubtraction


async def seed_analysis(mongo: Mongo, pg: AsyncEngine, document: dict) -> int:
    """Seed an analysis into both backends and its index, mirroring production
    dual-writes.

    The index version is taken from the inline ``index.version`` and written to the
    ``indexes`` collection, where ``AttachIndexTransform`` resolves it at read time.
    Non-integer ``job.id`` placeholders are stored as a null ``job_id`` since the
    Postgres column is a foreign key to ``jobs.id``.

    When the parent sample has no ``legacy_samples`` row yet, one is created from the
    sample's Mongo document so that its rights columns match. Rights are read from
    Postgres, so a row seeded with the column defaults would deny access to a sample
    the Mongo document marks readable.

    A sample with no Mongo document is left unseeded, giving the analysis a null
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
        sample_pg_id = (
            await session.execute(
                select(SQLLegacySample.id).where(
                    SQLLegacySample.legacy_id == sample["id"],
                ),
            )
        ).scalar_one_or_none()

        if sample_pg_id is None:
            sample_document = await mongo.samples.find_one({"_id": sample["id"]})

            if sample_document is not None:
                legacy_sample = SQLLegacySample(
                    legacy_id=sample["id"],
                    name=sample.get("name", sample["id"]),
                    library_type="normal",
                    created_at=document["created_at"],
                    user_id=document["user"]["id"],
                    all_read=sample_document.get("all_read", False),
                    all_write=sample_document.get("all_write", False),
                    group_read=sample_document.get("group_read", False),
                    group_write=sample_document.get("group_write", False),
                )
                session.add(legacy_sample)
                await session.flush()
                sample_pg_id = legacy_sample.id

        reference_pg_id = (
            await session.execute(
                select(SQLReference.id).where(
                    SQLReference.legacy_id == reference["id"],
                ),
            )
        ).scalar_one_or_none()

        if reference_pg_id is None:
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

        analysis = SQLAnalysis(
            legacy_id=document["_id"],
            created_at=document["created_at"],
            updated_at=document.get("updated_at", document["created_at"]),
            workflow=document["workflow"],
            ready=document["ready"],
            results=results if isinstance(results, dict) else None,
            sample=sample["id"],
            sample_id=sample_pg_id,
            reference=reference["id"],
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
