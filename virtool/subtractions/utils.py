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
    files = list()
    for file in os.listdir(path):
        if file in FILES:
            file_path = os.path.join(path, file)
            document = {
                "size": virtool.utils.file_stats(file_path)["size"],
                "name": file
            }

            if file.endswith(".fa.gz"):
                document["type"] = "fasta"
            if file.endswith(".bt2"):
                document["type"] = "bowtie2"

            files.append(document)

    return files


def rename_bowtie_files(path: str):
    for file in os.listdir(path):
        if file.endswith(".bt2"):
            file_path = os.path.join(path, file)
            os.rename(file_path, file_path.replace("reference", "subtraction"))
