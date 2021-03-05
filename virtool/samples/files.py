from typing import Dict

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from virtool.samples.models import SampleArtifacts, SampleReadsFile


async def create_artifacts_file(pg: AsyncEngine, name: str, sample_id: str, artifact_type: str):
    """
    Create a row in the `sample_artifacts` SQL table that represents uploaded sample artifact files.

    :param pg: PostgreSQL AsyncEngine object
    :param name: Name of the sample artifacts file
    :param sample_id: ID that corresponds to a parent sample
    :return: A dictionary representation of the newly created row
    """
    async with AsyncSession(pg) as session:
        artifacts_file = SampleArtifacts(
            sample=sample_id,
            name=name,
            type=artifact_type
        )

        session.add(artifacts_file)
        await session.flush()

        artifacts_file.name_on_disk = f"{artifacts_file.id}-{artifacts_file.name}"

        artifacts_file = artifacts_file.to_dict()

        await session.commit()

        return artifacts_file


async def create_reads_files(pg: AsyncEngine, sample_id: str, files: Dict[str, int]):
    """
    Create one or two rows in the `samples_reads_files` SQL table that represents uploaded sample reads files.

    :param pg: PostgreSQL AsyncEngine object
    :param sample_id: ID that corresponds to a parent sample
    :param files: A dictionary containing the names of the files on disk mapped to their file size in bytes
    :return: List of dictionary representations of the newly created row(s)
    """
    reads = list()

    async with AsyncSession(pg) as session:
        for name_on_disk, file in files.items():
            reads_file = SampleReadsFile(
                sample=sample_id,
                name_on_disk=name_on_disk,
                size=file["size"],
                uploaded_at=file["uploaded_at"]
            )

            reads.append(reads_file)

        session.add_all(reads)
        await session.flush()

        if len(reads) == 2:
            reads[0].paired, reads[1].paired = reads[1].id, reads[0].id

        reads = [reads_file.to_dict() for reads_file in reads]

        await session.commit()

        return reads
