from typing import Dict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.indexes.models import IndexFile


async def create_index_file(pg: AsyncEngine, reference_id: str, file_type: str, name: str) -> Dict[str, any]:
    """
    Create a row in the `index_files` SQL table that represents an index file.

    :param pg: PostgreSQL AsyncEngine object
    :param reference_id: ID that corresponds to a parent reference
    :param file_type: type of the index file
    :param name: Name of the index file
    :return: A dictionary representation of the newly created row
    """
    async with AsyncSession(pg) as session:
        index_file = IndexFile(
            name=name,
            reference=reference_id,
            type=file_type
        )

        session.add(index_file)

        await session.flush()

        index_file = index_file.to_dict()

        await session.commit()

        return index_file


async def delete_index_file(pg: AsyncEngine, file_id: int):
    """
    Deletes a row in the `index_files` SQL by its row `id`

    :param pg: PostgreSQL AsyncEngine object
    :param file_id: Row `id` to delete
    """
    async with AsyncSession(pg) as session:
        index_file = (await session.execute(select(IndexFile).where(IndexFile.id == file_id))).scalar()

        if not index_file:
            return None

        session.delete(index_file)

        await session.commit()

