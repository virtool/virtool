from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, AsyncEngine

from virtool.indexes.models import IndexFile


def check_index_file_type(file_name: str) -> str:
    """
    Get the index file type based on the extension of given `file_name`

    :param file_name: index file name
    :return: file type

    """
    if file_name.endswith(".fa.gz"):
        return "fasta"
    elif file_name.endswith(".json.gz"):
        return "json"
    else:
        return "bowtie2"


async def check_file_exists(pg: AsyncEngine, filename: str, index: str) -> bool:
    """
    Check if a index file already exists in `IndexFile` SQL table.

    :param pg: the PostgreSQL AsyncEngine object
    :param filename: the name of the index file
    :param index: the id of the index

    :return: `True` is file already exists, otherwise return `False`

    """
    async with AsyncSession(pg) as session:
        exists = (await session.execute(
            select(IndexFile).filter_by(name=filename, index=index)
        )).scalar()

    return False if exists is None else True
