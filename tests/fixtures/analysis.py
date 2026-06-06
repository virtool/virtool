from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.analyses.sql import SQLAnalysis
from virtool.mongo.core import Mongo


async def seed_analysis(mongo: Mongo, pg: AsyncEngine, document: dict) -> int:
    """Seed an analysis into both backends and its index, mirroring production
    dual-writes.

    The index version is taken from the inline ``index.version`` and written to the
    ``indexes`` collection, where ``AttachIndexTransform`` resolves it at read time.
    Non-integer ``job.id`` placeholders are stored as a null ``job_id`` since the
    Postgres column is a foreign key to ``jobs.id``.

    :return: the integer ``analyses.id`` of the seeded row
    """
    index = document["index"]
    job = document.get("job")
    results = document.get("results")

    await mongo.indexes.update_one(
        {"_id": index["id"]},
        {"$set": {"version": index["version"]}},
        upsert=True,
    )

    await mongo.analyses.insert_one(document)

    async with AsyncSession(pg) as session:
        analysis = SQLAnalysis(
            legacy_id=document["_id"],
            created_at=document["created_at"],
            updated_at=document.get("updated_at", document["created_at"]),
            workflow=document["workflow"],
            ready=document["ready"],
            results=results if isinstance(results, dict) else None,
            sample=document["sample"]["id"],
            reference=document["reference"]["id"],
            index=index["id"],
            subtractions=document.get("subtractions") or [],
            user_id=document["user"]["id"],
            job_id=job["id"] if job and isinstance(job["id"], int) else None,
            ml_id=document.get("ml"),
        )

        session.add(analysis)
        await session.flush()

        analysis_id = analysis.id

        await session.commit()

    return analysis_id
