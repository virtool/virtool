from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.utils
from virtool.samples.models import SampleArtifact, SampleReadsFile, SampleArtifactCache


async def get_existing_reads(pg: AsyncEngine, sample_id: str):
    async with AsyncSession(pg) as session:
        query = await session.execute(
            select(SampleReadsFile).filter_by(sample=sample_id)
        )

    return [result.name for result in query.scalars().all()]


async def create_artifact_file(
    pg: AsyncEngine, name: str, sample: str, artifact_type: str, cache: bool = False
):
    """
    Create a row in an SQL table that represents uploaded sample artifact files. A row is created in either the
    `sample_artifact` or `sample_artifact_cache` table depending on the condition of `cached`.

    :param pg: PostgreSQL AsyncEngine object
    :param name: Name of the sample artifact file
    :param sample: ID that corresponds to a parent sample
    :param artifact_type: Type of artifact to be uploaded
    :param cache: Whether the row should be created in the `sample_artifact` or `sample_artifact_cache` table
    :return: A dictionary representation of the newly created row
    """
    async with AsyncSession(pg) as session:
        if not cache:
            artifact = SampleArtifact()
        else:
            artifact = SampleArtifactCache()
        
        artifact.sample, artifact.name, artifact.type = sample, name, artifact_type

        session.add(artifact)
        await session.flush()

        artifact.name_on_disk = f"{artifact.id}-{artifact.name}"

        artifact = artifact.to_dict()

        await session.commit()

        return artifact


async def create_reads_file(
    pg: AsyncEngine, size: int, name: str, name_on_disk: str, sample_id: str
):
    """
    Create one or two rows in the `samples_reads_files` SQL table that represents uploaded sample reads files.

    :param pg: PostgreSQL AsyncEngine object
    :param size: Size of a newly uploaded file in bytes
    :param name: Name of the file (either `reads_1.fq.gz` or `reads_2.fq.gz`)
    :param name_on_disk: Name of the newly uploaded file on disk
    :param sample_id: ID that corresponds to a parent sample
    :return: List of dictionary representations of the newly created row(s)
    """

    async with AsyncSession(pg) as session:
        reads_file = SampleReadsFile(
            sample=sample_id,
            name=name,
            name_on_disk=name_on_disk,
            size=size,
            uploaded_at=virtool.utils.timestamp(),
        )

        session.add(reads_file)

        await session.flush()

        reads = reads_file.to_dict()

        await session.commit()

        return reads
