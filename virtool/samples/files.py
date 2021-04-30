from typing import Dict, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.pg.utils
import virtool.utils
from virtool.caches.models import SampleArtifactCache, SampleReadsCache
from virtool.samples.models import SampleArtifact, SampleReads
from virtool.uploads.models import Upload


async def get_existing_reads(
    pg: AsyncEngine, sample: str, key: str = None
) -> List[str]:
    """
    Get reads files in either `sample_reads_files` or `sample_reads_files_cache` depending on value of `key`.

    :param pg: PostgreSQL AsyncEngine object
    :param sample: ID that corresponds to a parent sample
    :param key: A key for a given cache
    :return: List of reads file names that are in a given table
    """
    async with AsyncSession(pg) as session:
        statement = (
            select(SampleReads).filter_by(sample=sample)
            if not key
            else select(SampleReadsCache).filter_by(sample=sample, key=key)
        )

        query = await session.execute(statement)

    return [result.name for result in query.scalars().all()]


async def create_artifact_file(
    pg: AsyncEngine, name: str, name_on_disk: str, sample: str, artifact_type: str, key: str = None
) -> Dict[str, any]:
    """
    Create a row in an SQL table that represents uploaded sample artifact files. A row is created in either the
    `sample_artifact` or `sample_artifact_cache` table depending on the value of `key`.

    :param pg: PostgreSQL AsyncEngine object
    :param name: Name of the sample artifact file
    :param name_on_disk: Name of the sample artifact file as it appears on disk
    :param sample: ID that corresponds to a parent sample
    :param artifact_type: Type of artifact to be uploaded
    :param key: A key for a given cache
    :return: A dictionary representation of the newly created row
    """
    async with AsyncSession(pg) as session:
        artifact = SampleArtifactCache(key=key) if key else SampleArtifact()

        artifact.name = name
        artifact.name_on_disk = name_on_disk
        artifact.sample = sample
        artifact.type = artifact_type

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
    cache: bool = False,
    upload_id: int = None,
) -> Dict[str, any]:
    """
    Create a row in a SQL table that represents uploaded sample reads files.

    :param pg: PostgreSQL AsyncEngine object
    :param size: Size of a newly uploaded file in bytes
    :param name: Name of the file (either `reads_1.fq.gz` or `reads_2.fq.gz`)
    :param name_on_disk: Name of the newly uploaded file on disk
    :param sample_id: ID that corresponds to a parent sample
    :param cache: Whether the row should be created in the `sample_reads_files` or `sample_reads_files_cache` table
    :param upload_id: ID for a row in the `uploads` table to pair with

    :return: List of dictionary representations of the newly created row(s)
    """

    async with AsyncSession(pg) as session:
        reads = SampleReads() if not cache else SampleReadsCache()

        reads.sample, reads.name, reads.name_on_disk, reads.size, reads.uploaded_at = (
            sample_id,
            name,
            name_on_disk,
            size,
            virtool.utils.timestamp(),
        )

        if upload_id and (
            upload := (
                await session.execute(select(Upload).filter_by(id=upload_id))
            ).scalar()
        ):
            upload.reads.append(reads)

        session.add(reads)

        await session.flush()

        reads = reads.to_dict()

        await session.commit()

    return reads
