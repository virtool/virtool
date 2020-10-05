"""
Functions for working with the database to provide file downloads. All functions are currently related to OTUs and their
child models.

"""
from typing import Tuple

import virtool.downloads.utils
import virtool.errors
import virtool.otus.utils


async def generate_isolate_fasta(db, otu_id: str, isolate_id: str) -> Tuple[str, str]:
    """
    Generate a FASTA filename and body for the sequences associated with the isolate identified by the passed
    ``otu_id`` and ``isolate_id``.

    :param db: the application database client
    :param otu_id: the id of the isolates' parent otu
    :param isolate_id: the id of the isolate to FASTAfy
    :return: as FASTA filename and body

    """
    _, isolate_name = await get_otu_and_isolate_names(db, otu_id, isolate_id)

    otu = await db.otus.find_one({"_id": otu_id, "isolates.id": isolate_id}, ["name", "isolates"])

    fasta = list()

    async for sequence in db.sequences.find({"otu_id": otu_id, "isolate_id": isolate_id}, ["sequence"]):
        fasta.append(virtool.downloads.utils.format_fasta_entry(
            otu["name"],
            isolate_name,
            sequence["_id"],
            sequence["sequence"]
        ))

    return virtool.downloads.utils.format_fasta_filename(otu["name"], isolate_name), "\n".join(fasta)


async def generate_sequence_fasta(db, sequence_id: str) -> Tuple[str, str]:
    """
    Generate a FASTA filename and body for the sequence associated with the passed ``sequence_id``.

    :param db: the application database client
    :param sequence_id: the id sequence of the sequence to FASTAfy
    :return: as FASTA filename and body

    """
    sequence = await db.sequences.find_one(sequence_id, ["sequence", "otu_id", "isolate_id"])

    if not sequence:
        raise virtool.errors.DatabaseError("Sequence does not exist")

    otu_name, isolate_name = await get_otu_and_isolate_names(db, sequence["otu_id"], sequence["isolate_id"])

    fasta = virtool.downloads.utils.format_fasta_entry(
        otu_name,
        isolate_name,
        sequence_id,
        sequence["sequence"]
    )

    return virtool.downloads.utils.format_fasta_filename(otu_name, isolate_name, sequence["_id"]), fasta


async def generate_otu_fasta(db, otu_id: str) -> Tuple[str, str]:
    """
    Generate a FASTA filename and body for the sequences associated with the otu identified by the passed
    ``otu_id``.

    :param db: the application database client
    :param otu_id: the id of the otu whose sequences should be expressed in FASTA format
    :return: as FASTA filename and body

    """
    otu = await db.otus.find_one(otu_id, ["name", "isolates"])

    if not otu:
        raise virtool.errors.DatabaseError("OTU does not exist")

    fasta = list()

    for isolate in otu["isolates"]:
        async for sequence in db.sequences.find({"otu_id": otu_id, "isolate_id": isolate["id"]}, ["sequence"]):
            fasta.append(virtool.downloads.utils.format_fasta_entry(
                otu["name"],
                virtool.otus.utils.format_isolate_name(isolate),
                sequence["_id"],
                sequence["sequence"]
            ))

    fasta = "\n".join(fasta)

    return virtool.downloads.utils.format_fasta_filename(otu["name"]), fasta


async def get_otu_and_isolate_names(db, otu_id: str, isolate_id: str) -> Tuple[str, str]:
    """
    Get the OTU name and isolate name for a OTU-isolate combination specified by `otu_id` and `isolate_id`.

    :param db: the application database object
    :param otu_id: the OTU ID
    :param isolate_id: the isolate ID
    :return: an OTU name and isolate name

    """
    otu = await db.otus.find_one({"_id": otu_id, "isolates.id": isolate_id}, ["name", "isolates"])

    if not otu:
        raise virtool.errors.DatabaseError("OTU does not exist")

    isolate = virtool.otus.utils.find_isolate(otu["isolates"], isolate_id)

    if not isolate:
        raise virtool.errors.DatabaseError("Isolate does not exist")

    return otu["name"], virtool.otus.utils.format_isolate_name(isolate)
