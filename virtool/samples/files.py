from typing import Dict

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from virtool.samples.models import SampleReadsFile


async def create_reads_files(pg: AsyncEngine, sample_id: str, files: Dict[str, int]):
    """
    Create one or two rows in the `samples_reads_files` SQL table that represent sample reads files.

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
