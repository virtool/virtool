from typing import Dict, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.subtractions.models import SubtractionFile


async def create_subtraction_file(pg: AsyncEngine, subtraction_id: str, file_type: str, name: str) -> Dict[str, any]:
    """
    Create a row in the `subtraction_files` SQL table that represents an subtraction file.

    :param pg: PostgreSQL AsyncEngine object
    :param subtraction_id: ID that corresponds to a parent subtraction
    :param file_type: type of the subtraction file
    :param name: Name of the subtraction file
    :return: A dictionary representation of the newly created row
    """
    async with AsyncSession(pg) as session:
        subtraction_file = SubtractionFile(
            name=name,
            subtraction=subtraction_id,
            type=file_type
        )

        session.add(subtraction_file)

        await session.flush()

        subtraction_file = subtraction_file.to_dict()

        await session.commit()

        return subtraction_file


async def delete_subtraction_file(pg: AsyncEngine, file_id: int):
    """
    Deletes a row in the `subtraction_files` SQL by its row `id`

    :param pg: PostgreSQL AsyncEngine object
    :param file_id: Row `id` to delete
    """
    async with AsyncSession(pg) as session:
        subtraction_file = (await session.execute(select(SubtractionFile).where(SubtractionFile.id == file_id))).scalar()

        if not subtraction_file:
            return None

        await session.delete(subtraction_file)
        await session.commit()


async def get_subtraction_file(pg: AsyncEngine, file_id: int) -> Optional[SubtractionFile]:
    """
    Get a row that represents an subtraction file by its `id`

    :param pg: PostgreSQL AsyncEngine object
    :param file_id: Row `id` to get
    :return: Row from the `subtraction_files` SQL table
    """
    async with AsyncSession(pg) as session:
        upload = (await session.execute(select(SubtractionFile).filter_by(id=file_id))).scalar()

        if not upload:
            return None

    return upload
