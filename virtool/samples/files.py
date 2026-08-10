from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.utils
from virtool.data.topg import compose_legacy_id_subquery
from virtool.samples.sql import SQLLegacySample, SQLSampleReads
from virtool.uploads.sql import SQLUpload


async def get_existing_reads(pg: AsyncEngine, sample_id: str) -> list[str]:
    """Get read file names for a sample.

    :param pg: the application asyncengine object
    :param sample_id: a sample id
    :return: read file names associated with the sample
    """
    async with AsyncSession(pg) as session:
        result = await session.execute(
            select(SQLSampleReads).where(
                SQLSampleReads.sample_id
                == compose_legacy_id_subquery(SQLLegacySample, sample_id),
            ),
        )

    return [row.name for row in result.scalars().all()]


async def create_reads_file(
    pg: AsyncEngine,
    size: int,
    name: str,
    name_on_disk: str,
    sample_id: int,
    storage_key: str,
    upload_id: int | None = None,
) -> dict[str, any]:
    """Create a row in a SQL table that represents uploaded sample reads files.

    ``sample`` is the dead legacy prefix column, still ``NOT NULL`` until it is
    dropped, so it is filled with the sample's primary key. Nothing reads it.

    :param pg: PostgreSQL AsyncEngine object
    :param size: Size of a newly uploaded file in bytes
    :param name: Name of the file (either `reads_1.fq.gz` or `reads_2.fq.gz`)
    :param name_on_disk: Name of the newly uploaded file on disk
    :param sample_id: Primary key of the parent sample
    :param storage_key: Complete object-storage key the reads file is written to
    :param upload_id: ID for a row in the `uploads` table to pair with
    :return: List of dictionary representations of the newly created row(s)

    """
    async with AsyncSession(pg) as session:
        reads = SQLSampleReads(
            sample=str(sample_id),
            sample_id=sample_id,
            name=name,
            name_on_disk=name_on_disk,
            size=size,
            storage_key=storage_key,
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
