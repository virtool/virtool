import logging
import os
from pathlib import Path
from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from virtool.configuration.config import Config
from virtool.subtractions.models import SubtractionFile

FILES = (
    "subtraction.fa.gz",
    "subtraction.1.bt2",
    "subtraction.2.bt2",
    "subtraction.3.bt2",
    "subtraction.4.bt2",
    "subtraction.rev.1.bt2",
    "subtraction.rev.2.bt2"
)

logger = logging.getLogger(__name__)


def check_subtraction_file_type(file_name: str) -> str:
    """
    Get the subtraction file type based on the extension of given `file_name`

    :param file_name: subtraction file name
    :return: file type

    """
    if file_name.endswith(".fa.gz"):
        return "fasta"
    else:
        return "bowtie2"


def join_subtraction_path(config: Config, subtraction_id: str) -> Path:
    return config.data_path / "subtractions" / subtraction_id.replace(" ", "_").lower()


def join_subtraction_index_path(config: Config, subtraction_id: str) -> Path:
    return join_subtraction_path(config, subtraction_id) / "reference"


async def get_subtraction_files(pg: AsyncEngine, subtraction: str) -> List[dict]:
    """
    Prepare a list of files from 'SubtractionFile' table to be added to 'files' field.

    :param pg: PostgreSQL AsyncEngine object
    :param subtraction: the ID of the subtraction

    :return: a list of files to be added to subtraction documents

    """
    async with AsyncSession(pg) as session:
        files = (
            await session.execute(select(SubtractionFile).filter_by(subtraction=subtraction))
        ).scalars().all()

    files = [file.to_dict() for file in files]

    for file in files:
        file["download_url"] = f"/subtractions/{file['subtraction']}/files/{file['name']}"

    return files


def rename_bowtie_files(path: str):
    """
    Rename all Bowtie2 index files from 'reference' to 'subtraction'.

    :param path: the subtraction path

    """
    for file in os.listdir(path):
        if file.endswith(".bt2"):
            file_path = path / file
            os.rename(file_path, str(file_path).replace("reference", "subtraction"))
