from typing import Dict

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.samples.models import SampleArtifact, SampleReadsFile


async def create_artifact_file(pg: AsyncEngine, name: str, sample_id: str, artifact_type: str):
    """
    Create a row in the `sample_artifact` SQL table that represents uploaded sample artifact files.

    :param pg: PostgreSQL AsyncEngine object
    :param name: Name of the sample artifact file
    :param sample_id: ID that corresponds to a parent sample
    :param artifact_type: Type of artifact to be uploaded
    :return: A dictionary representation of the newly created row
    """
    async with AsyncSession(pg) as session:
        artifact_file = SampleArtifact(
            sample=sample_id,
            name=name,
            type=artifact_type
        )

        session.add(artifact_file)
        await session.flush()

        artifact_file.name_on_disk = f"{artifact_file.id}-{artifact_file.name}"

        artifact_file = artifact_file.to_dict()

        await session.commit()

        return artifact_file


async def create_reads_file(pg: AsyncEngine, file: Dict[str, any], sample_id: str):
    """
    Create one or two rows in the `samples_reads_files` SQL table that represents uploaded sample reads files.

    :param pg: PostgreSQL AsyncEngine object
    :param file: A dictionary containing info on an uploaded file
    :param sample_id: ID that corresponds to a parent sample
    :return: List of dictionary representations of the newly created row(s)
    """

    async with AsyncSession(pg) as session:
        reads_file = SampleReadsFile(
            sample=sample_id,
            name_on_disk=file["name_on_disk"],
            size=file["size"],
            uploaded_at=file["uploaded_at"]
        )

        session.add(reads_file)

        await session.flush()

        reads = reads_file.to_dict()

        await session.commit()

        return reads
