import logging
import os

import aiofiles

import virtool.utils

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


async def calculate_fasta_gc(path):
    nucleotides = {
        "a": 0,
        "t": 0,
        "g": 0,
        "c": 0,
        "n": 0
    }

    count = 0

    # Go through the fasta file getting the nucleotide counts, lengths, and number of sequences
    async with aiofiles.open(path, "r") as f:
        async for line in f:
            if line[0] == ">":
                count += 1
                continue

            for i in ["a", "t", "g", "c", "n"]:
                # Find lowercase and uppercase nucleotide characters
                nucleotides[i] += line.lower().count(i)

    nucleotides_sum = sum(nucleotides.values())

    return {k: round(nucleotides[k] / nucleotides_sum, 3) for k in nucleotides}, count


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


def join_subtraction_path(settings: dict, subtraction_id: str) -> str:
    return os.path.join(
        settings["data_path"],
        "subtractions",
        subtraction_id.replace(" ", "_").lower()
    )


def join_subtraction_index_path(settings: dict, subtraction_id: str) -> str:
    return os.path.join(
        join_subtraction_path(settings, subtraction_id),
        "reference"
    )


def prepare_files_field(path: str):
    """
    Prepare a list of documents to be added to 'files' field,
    and attach name, size, and type to the document.

    :param path: the subtraction path
    :return: a list of files to be added to subtraction documents

    """
    files = list()
    for file in sorted(os.listdir(path)):
        if file in FILES:
            file_path = os.path.join(path, file)
            document = {
                "size": virtool.utils.file_stats(file_path)["size"],
                "name": file,
                "type": check_subtraction_file_type(file)
            }

            files.append(document)

    return files


def rename_bowtie_files(path: str):
    """
    Rename all Bowtie2 index files from 'reference' to 'subtraction'.

    :param path: the subtraction path

    """
    for file in os.listdir(path):
        if file.endswith(".bt2"):
            file_path = os.path.join(path, file)
            os.rename(file_path, file_path.replace("reference", "subtraction"))
