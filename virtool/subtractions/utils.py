from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.subtractions.pg import SQLSubtractionFile

FILES = (
    "subtraction.fa.gz",
    "subtraction.1.bt2",
    "subtraction.2.bt2",
    "subtraction.3.bt2",
    "subtraction.4.bt2",
    "subtraction.rev.1.bt2",
    "subtraction.rev.2.bt2",
)


def check_subtraction_file_type(file_name: str) -> str:
    """Get the subtraction file type based on the extension of given `file_name`.

    :param file_name: subtraction file name
    :return: file type
    """
    if file_name.endswith(".fa.gz"):
        return "fasta"

    return "bowtie2"


async def get_subtraction_files(pg: AsyncEngine, subtraction_id: int) -> list[dict]:
    """Get a list of files associated with the passed subtraction id.

    :param pg: PostgreSQL AsyncEngine object
    :param subtraction_id: the integer id of the parent subtraction
    :return: a list of files to be added to subtraction documents
    """
    async with AsyncSession(pg) as session:
        files = (
            (
                await session.execute(
                    select(SQLSubtractionFile).filter_by(subtraction_id=subtraction_id)
                )
            )
            .scalars()
            .all()
        )

    # Where an object lives is internal; clients address files by name.
    return [
        {k: v for k, v in file.to_dict().items() if k != "storage_key"}
        for file in files
    ]
