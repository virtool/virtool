from asyncio import to_thread
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.subtractions.pg import SQLSubtractionFile
from virtool.subtractions.utils import check_subtraction_file_type
from virtool.utils import file_stats


async def create_subtraction_files(
    pg: AsyncEngine, subtraction_id: str, files: list[str], path: str | Path
):
    """Create multiple rows in `subtraction_files` in a single transaction.

    :param pg: PostgreSQL AsyncEngine object
    :param subtraction_id: ID that corresponds to a parent subtraction
    :param files: A list of filenames
    :param path: The path to the subtraction files

    """
    async with AsyncSession(pg) as session:
        session.add_all(
            [
                SQLSubtractionFile(
                    name=filename,
                    subtraction=subtraction_id,
                    type=check_subtraction_file_type(filename),
                    size=(await to_thread(file_stats, path / filename))["size"],
                )
                for filename in files
            ]
        )
        await session.commit()
