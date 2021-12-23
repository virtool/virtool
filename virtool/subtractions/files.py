from pathlib import Path
from typing import Dict, List, Union

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.subtractions.models import SubtractionFile
from virtool.subtractions.utils import check_subtraction_file_type
from virtool.utils import file_stats


async def create_subtraction_file(
    pg: AsyncEngine, subtraction_id: str, file_type: str, name: str
) -> Dict[str, any]:
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
            name=name, subtraction=subtraction_id, type=file_type
        )

        session.add(subtraction_file)

        await session.flush()

        subtraction_file = subtraction_file.to_dict()

        await session.commit()

        return subtraction_file


async def create_subtraction_files(
    pg: AsyncEngine, subtraction_id: str, files: List[str], path: Union[str, Path]
):
    """
    Create multiple rows in the `subtraction_files` SQL table in a single transaction.

    :param pg: PostgreSQL AsyncEngine object
    :param subtraction_id: ID that corresponds to a parent subtraction
    :param files: A list of filenames
    :param path: The path to the subtraction files

    """
    subtraction_files = list()

    for filename in files:
        subtraction_files.append(
            SubtractionFile(
                name=filename,
                subtraction=subtraction_id,
                type=check_subtraction_file_type(filename),
                size=file_stats(path / filename)["size"],
            )
        )

    async with AsyncSession(pg) as session:
        session.add_all(subtraction_files)

        await session.commit()


async def delete_subtraction_file(pg: AsyncEngine, file_id: int):
    """
    Deletes a row in the `subtraction_files` SQL by its row `id`

    :param pg: PostgreSQL AsyncEngine object
    :param file_id: Row `id` to delete
    """
    async with AsyncSession(pg) as session:
        subtraction_file = (
            await session.execute(
                select(SubtractionFile).where(SubtractionFile.id == file_id)
            )
        ).scalar()

        if not subtraction_file:
            return None

        await session.delete(subtraction_file)
        await session.commit()
