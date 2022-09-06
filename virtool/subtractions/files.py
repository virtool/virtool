from pathlib import Path
from typing import List, Union

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.subtractions.models import SubtractionFile
from virtool.subtractions.utils import check_subtraction_file_type
from virtool.utils import file_stats


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
    subtraction_files = []

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
