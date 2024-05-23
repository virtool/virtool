from typing import Dict, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

# Keep this so models are recognized by the ORM.
import virtool.caches.models
import virtool.utils
from virtool.samples.models import SQLSampleArtifact, SQLSampleReads
from virtool.uploads.models import SQLUpload


async def get_existing_reads(pg: AsyncEngine, sample_id: str) -> list[str]:
    """Get read file names for a sample.

    :param pg: the application asyncengine object
    :param sample_id: a sample id
    :return: read file names associated with the sample
    """
    async with AsyncSession(pg) as session:
        result = await session.execute(
            select(SQLSampleReads).filter_by(sample=sample_id),
        )

    return [row.name for row in result.scalars().all()]


async def create_artifact_file(
    pg: AsyncEngine,
    name: str,
    name_on_disk: str,
    sample: str,
    artifact_type: str,
) -> Dict[str, any]:
    """Create a row in an SQL table that represents uploaded sample artifact files. A row is created
    in either the `sample_artifact` or `sample_artifact_cache` table depending on the value of
    `key`.

    :param pg: PostgreSQL AsyncEngine object
    :param name: Name of the sample artifact file
    :param name_on_disk: Name of the sample artifact file as it appears on disk
    :param sample: ID that corresponds to a parent sample
    :param artifact_type: Type of artifact to be uploaded
    :return: A dictionary representation of the newly created row
    """
    async with AsyncSession(pg) as session:
        artifact = SQLSampleArtifact(
            name=name,
            name_on_disk=name_on_disk,
            sample=sample,
            type=artifact_type,
            uploaded_at=virtool.utils.timestamp(),
        )

        session.add(artifact)
        await session.flush()

        artifact = artifact.to_dict()

        await session.commit()

    return artifact


async def create_reads_file(
    pg: AsyncEngine,
    size: int,
    name: str,
    name_on_disk: str,
    sample_id: str,
    upload_id: Optional[int] = None,
) -> Dict[str, any]:
    """Create a row in a SQL table that represents uploaded sample reads files.

    :param pg: PostgreSQL AsyncEngine object
    :param size: Size of a newly uploaded file in bytes
    :param name: Name of the file (either `reads_1.fq.gz` or `reads_2.fq.gz`)
    :param name_on_disk: Name of the newly uploaded file on disk
    :param sample_id: ID that corresponds to a parent sample
    :param upload_id: ID for a row in the `uploads` table to pair with
    :return: List of dictionary representations of the newly created row(s)

    """
    async with AsyncSession(pg) as session:
        reads = SQLSampleReads(
            sample=sample_id,
            name=name,
            name_on_disk=name_on_disk,
            size=size,
            uploaded_at=virtool.utils.timestamp(),
        )

        if upload_id and (
            upload := (
                await session.execute(select(SQLUpload).filter_by(id=upload_id))
            ).scalar()
        ):
            upload.reads.append(reads)

        session.add(reads)

        await session.flush()

        reads = reads.to_dict()

        await session.commit()

    return reads
