from pathlib import Path
from tempfile import TemporaryDirectory
from typing import TYPE_CHECKING, Dict, List

from virtool.history.db import patch_to_version
from virtool.indexes.models import IndexType
from virtool.tasks.task import BaseTask
from virtool.types import Document

if TYPE_CHECKING:
    from virtool.data.layer import DataLayer
    from virtool.mongo.core import DB


class EnsureIndexFilesTask(BaseTask):
    """
    Add a 'files' field to index documents to list what files can be downloaded for that
    index.
    """

    name = "ensure_index_files"

    def __init__(
        self,
        task_id: int,
        data: "DataLayer",
        context: Dict,
        temp_dir: TemporaryDirectory,
    ):
        super().__init__(task_id, data, context, temp_dir)
        self.steps = [self.ensure_index_files]

    async def ensure_index_files(self):
        await self.data.index.ensure_files()


def format_sequence_for_export(sequence: Document) -> Document:
    """
    Prepare a raw sequence document for export.

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


def format_otu_for_export(otu: Document) -> Document:
    """
    Prepare a raw, joined OTU for export.

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
        "schema": otu["schema"],
    }


async def export_index(
    data_path: Path, mongo: "DB", manifest: Dict[str, int]
) -> List[Document]:
    """
    Dump OTUs to a JSON-serializable data structure based on an index manifest.

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


def get_index_file_type_from_name(name: str) -> IndexType:
    if ".json" in name:
        return IndexType.json

    if ".fa" in name:
        return IndexType.fasta

    if ".bt" in name:
        return IndexType.bowtie2

    raise ValueError(f"Filename does not map to valid IndexType: {name}")
