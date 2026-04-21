import os
from asyncio import to_thread
from pathlib import Path

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


async def get_subtraction_files(pg: AsyncEngine, subtraction_id: str) -> list[dict]:
    """Get a list of files associated with the passed subtraction id.

    :param pg: PostgreSQL AsyncEngine object
    :param subtraction_id: the ID of the subtraction_id
    :return: a list of files to be added to subtraction documents
    """
    async with AsyncSession(pg) as session:
        files = (
            (
                await session.execute(
                    select(SQLSubtractionFile).filter_by(subtraction=subtraction_id)
                )
            )
            .scalars()
            .all()
        )

    return [file.to_dict() for file in files]


def subtraction_file_key(subtraction_id: str, filename: str) -> str:
    return f"subtractions/{subtraction_id.replace(' ', '_')}/{filename}"


def subtraction_prefix(subtraction_id: str) -> str:
    return f"subtractions/{subtraction_id.replace(' ', '_')}/"


async def rename_bowtie_files(path: Path) -> None:
    """Rename all Bowtie2 index files from 'reference' to 'subtraction'.

    :param path: the subtraction_id path

    """
    for file_path in await to_thread(path.iterdir):
        if file_path.suffix == ".bt2":
            await to_thread(
                os.rename, file_path, str(file_path).replace("reference", "subtraction")
            )
