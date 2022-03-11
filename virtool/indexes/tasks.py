import json
from typing import Dict, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.history.db import patch_to_version
from virtool.indexes.db import FILES
from virtool.indexes.models import IndexFile, IndexType
from virtool.indexes.utils import join_index_path
from virtool.tasks.task import Task
from virtool.types import App, Document
from virtool.utils import compress_json_with_gzip, file_stats


class AddIndexFilesTask(Task):
    """
    Add a 'files' field to index documents to list what files can be downloaded for that
    index.
    """

    task_type = "add_index_files"

    def __init__(self, app: App, task_id: int):
        super().__init__(app, task_id)
        self.steps = [self.store_index_files]

    async def store_index_files(self):
        async for index in self.db.indexes.find({"ready": True}):
            index_id = index["_id"]

            index_path = join_index_path(
                self.app["config"].data_path, index["reference"]["id"], index_id
            )

            async with AsyncSession(self.app["pg"]) as session:
                first = (
                    await session.execute(
                        select(IndexFile).where(IndexFile.index == index_id)
                    )
                ).first()

                if first:
                    continue

                session.add_all(
                    [
                        IndexFile(
                            name=path.name,
                            index=index_id,
                            type=get_index_file_type_from_name(path.name),
                            size=file_stats(path)["size"],
                        )
                        for path in sorted(index_path.iterdir())
                        if path.name in FILES
                    ]
                )

                await session.commit()


class AddIndexJSONTask(Task):
    task_type = "add_index_json"

    def __init__(self, *args):
        super().__init__(*args)
        self.steps = [self.add_index_json_file]

    async def add_index_json_file(self):
        async for index in self.db.indexes.find({"ready": True}):
            index_id = index["_id"]
            ref_id = index["reference"]["id"]
            manifest = index["manifest"]

            async with AsyncSession(self.pg) as session:
                path = join_index_path(self.app["config"].data_path, ref_id, index_id)

                index_json_path = path / "reference.json.gz"

                if index_json_path.is_file():
                    continue

                index_data = await export_index(self.app, manifest)

                reference = await self.db.references.find_one(
                    ref_id, ["data_type", "organism", "targets"]
                )

                json_string = json.dumps(
                    {
                        "data_type": reference["data_type"],
                        "organism": reference["organism"],
                        "otus": index_data,
                        "targets": reference.get("targets"),
                    }
                )

                await self.run_in_thread(
                    compress_json_with_gzip, json_string, index_json_path
                )

                session.add(
                    IndexFile(
                        name="reference.json.gz",
                        index=index_id,
                        type="json",
                        size=file_stats(index_json_path)["size"],
                    ),
                )

                await session.commit()


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
    except KeyError:
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


async def export_index(app: App, manifest: Dict[str, int]) -> List[Document]:
    """
    Dump OTUs to a JSON-serializable data structure based on an index manifest.

    :param app: the application object
    :param manifest: the index manifest
    :return: JSON-serializable OTU data
    """
    otu_list = []

    for otu_id, otu_version in manifest.items():
        _, joined, _ = await patch_to_version(app, otu_id, otu_version)
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
