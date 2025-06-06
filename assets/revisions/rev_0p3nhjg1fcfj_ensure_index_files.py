"""ensure index files

Revision ID: 0p3nhjg1fcfj
Date: 2024-05-22 20:47:09.866326

"""

from asyncio import to_thread
from pathlib import Path
from typing import TYPE_CHECKING

import arrow
from motor.motor_asyncio import AsyncIOMotorDatabase
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.api.custom_json import dump_bytes
from virtool.history.db import patch_to_version
from virtool.indexes.db import INDEX_FILE_NAMES
from virtool.indexes.sql import IndexType, SQLIndexFile
from virtool.indexes.utils import join_index_path
from virtool.migration import MigrationContext
from virtool.types import Document
from virtool.utils import compress_json_with_gzip, file_stats

if TYPE_CHECKING:
    from virtool.mongo.core import Mongo

# Revision identifiers.
name = "ensure index files"
created_at = arrow.get("2024-05-22 20:47:09.866326")
revision_id = "0p3nhjg1fcfj"

alembic_down_revision = None
virtool_down_revision = "ulapmx8i3vpg"


# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext):
    async for index in ctx.mongo.indexes.find({"ready": True}):
        index_id = index["_id"]

        index_path = join_index_path(
            ctx.data_path,
            index["reference"]["id"],
            index_id,
        )

        if not index_path.is_dir():
            continue

        try:
            await ensure_json(
                ctx.mongo,
                index_path,
                ctx.data_path,
                index["reference"]["id"],
                index["manifest"],
            )
        except IndexError:
            continue

        async with AsyncSession(ctx.pg) as session:
            first = (
                await session.execute(
                    select(SQLIndexFile).where(SQLIndexFile.index == index_id),
                )
            ).first()

            if first:
                continue

            session.add_all(
                [
                    SQLIndexFile(
                        name=path.name,
                        index=index_id,
                        type=get_index_file_type_from_name(path.name),
                        size=(await to_thread(file_stats, path))["size"],
                    )
                    for path in sorted(index_path.iterdir())
                    if path.name in INDEX_FILE_NAMES
                ],
            )

            await session.commit()


async def ensure_json(
    mongo: AsyncIOMotorDatabase,
    index_path: Path,
    data_path: Path,
    ref_id: str,
    manifest: dict,
):
    """Ensure that a there is a compressed JSON representation of the index found at
    `path`` exists.

    :param mongo: the application mongo client
    :param index_path: the path to the index directory
    :param data_path: the path to the data directory
    :param ref_id: the id of the parent reference
    :param manifest: the otu id-version manifest for the index
    """
    json_path = index_path / "reference.json.gz"

    if await to_thread(json_path.is_file):
        return

    reference = await mongo.references.find_one(
        ref_id,
        ["data_type", "organism", "targets"],
    )

    await to_thread(
        compress_json_with_gzip,
        dump_bytes(
            {
                "data_type": reference["data_type"],
                "organism": reference["organism"],
                "otus": await export_index(data_path, mongo, manifest),
                "targets": reference.get("targets"),
            },
        ),
        json_path,
    )


async def export_index(
    data_path: Path,
    mongo: "Mongo",
    manifest: dict[str, int],
) -> list[Document]:
    """Dump OTUs to a JSON-serializable data structure based on an index manifest.

    :param data_path: the application data path
    :param mongo: the application mongo client
    :param manifest: the index manifest
    :return: JSON-serializable OTU data
    """
    otu_list = []

    for otu_id, otu_version in manifest.items():
        _, joined, _ = await patch_to_version(data_path, mongo, otu_id, otu_version)
        otu_list.append(format_otu_for_export(joined))

    return otu_list


def format_otu_for_export(otu: Document) -> Document:
    """Prepare a raw, joined OTU for export.

    If the OTU has a remote ID use this as the `_id` for export. This makes the OTU
    compatible with the original remote reference.

    :param otu: a joined OTU document
    :return: the formatted, joined OTU document
    """
    try:
        otu_id = otu["remote"]["id"]
    except KeyError:
        otu_id = otu["_id"]

    isolates = [
        {
            "id": isolate["id"],
            "default": isolate["default"],
            "source_name": isolate["source_name"],
            "source_type": isolate["source_type"],
            "sequences": [
                format_sequence_for_export(sequence)
                for sequence in isolate["sequences"]
            ],
        }
        for isolate in otu["isolates"]
    ]

    return {
        "_id": otu_id,
        "name": otu["name"],
        "abbreviation": otu["abbreviation"],
        "isolates": isolates,
        "schema": otu.get("schema", []),
    }


def format_sequence_for_export(sequence: Document) -> Document:
    """Prepare a raw sequence document for export.

    If the sequence has a remote ID use this as the `_id` for export. This makes the
    sequence compatible with the original remote reference.

    :param sequence: a sequence document
    :return: the formatted sequence document
    """
    try:
        sequence_id = sequence["remote"]["id"]
    except (KeyError, TypeError):
        sequence_id = sequence["_id"]

    cleaned_sequence = {
        "_id": sequence_id,
        "accession": sequence["accession"],
        "definition": sequence["definition"],
        "host": sequence["host"],
        "sequence": sequence["sequence"],
    }

    for key in ["segment", "target"]:
        try:
            return {**cleaned_sequence, key: sequence[key]}
        except KeyError:
            pass

    return cleaned_sequence


def get_index_file_type_from_name(file_name: str) -> IndexType:
    if ".json" in file_name:
        return IndexType.json

    if ".fa" in file_name:
        return IndexType.fasta

    if ".bt" in file_name:
        return IndexType.bowtie2

    raise ValueError(f"Filename does not map to valid IndexType: {file_name}")
