import aiofiles
import glob
import logging
import os

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


async def check_subtraction_file(app):
    db = app["db"]
    settings = app["settings"]
    cursor = db.subtraction.find()
    subtraction_without_file = []

    async for subtraction in cursor:
        path = join_subtraction_path(settings, subtraction["_id"])

        if not glob.glob(f'{path}/*.fa.gz'):
            has_file = False
            subtraction_without_file.append(subtraction["_id"])
        else:
            has_file = True

        await db.subtraction.find_one_and_update({"_id": subtraction["_id"]}, {
            "$set": {
                "has_file": has_file
            }
        })
    return subtraction_without_file
