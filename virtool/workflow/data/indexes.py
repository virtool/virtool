import asyncio
import json
from collections.abc import AsyncIterator
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import aiofiles
from pyfixtures import fixture
from structlog import get_logger

from virtool.analyses.models import Analysis
from virtool.indexes.models import Index
from virtool.jobs.models import Job
from virtool.references.models import ReferenceNested
from virtool.utils import decompress_file
from virtool.workflow.client import WorkflowAPIClient
from virtool.workflow.errors import MissingJobArgumentError
from virtool.workflow.files import VirtoolFileFormat

logger = get_logger("api")


@dataclass
class WFIndex:
    """Represents a Virtool reference index for use in analysis workflows."""

    id: str
    """The ID of the index."""

    path: Path
    """The path to the index directory in the workflow's work directory."""

    manifest: dict[str, int | str]
    """The manifest (OTU ID: OTU Version) for the index."""

    reference: ReferenceNested
    """The parent reference."""

    sequence_lengths: dict[str, int]
    """A dictionary of the lengths of all sequences keyed by their IDs."""

    sequence_otu_map: dict[str, str]
    """A dictionary of the OTU IDs for all sequences keyed by their sequence IDs."""

    otu_source: "OTUSource"
    """The source used to asynchronously iterate indexed OTUs."""

    @property
    def fasta_path(self) -> Path:
        """The path to the FASTA file for legacy analysis workflows."""
        return self.path / "reference.fa"

    async def iter_otus(self) -> AsyncIterator[dict[str, Any]]:
        """Iterate indexed OTUs regardless of the backing artifact format."""
        async for otu in self.otu_source.iter_otus():
            yield otu

    def get_otu_id_by_sequence_id(self, sequence_id: str) -> str:
        """Get the ID of the parent OTU for the given ``sequence_id``.

        :param sequence_id: the sequence ID
        :return: the matching OTU ID

        """
        try:
            return self.sequence_otu_map[sequence_id]
        except KeyError:
            raise ValueError("The sequence_id does not exist in the index")

    def get_sequence_length(self, sequence_id: str) -> int:
        """Get the sequence length for the given ``sequence_id``.

        :param sequence_id: the sequence ID
        :return: the length of the sequence

        """
        try:
            return self.sequence_lengths[sequence_id]
        except KeyError:
            raise ValueError("The sequence_id does not exist in the index")


class OTUSource:
    async def iter_otus(self) -> AsyncIterator[dict[str, Any]]:
        raise NotImplementedError


@dataclass
class LegacyOTUJsonSource(OTUSource):
    path: Path

    async def iter_otus(self) -> AsyncIterator[dict[str, Any]]:
        async with aiofiles.open(self.path) as f:
            data = json.loads(await f.read())

        otus = data["otus"] if isinstance(data, dict) else data

        for otu in otus:
            yield otu


@dataclass
class ReferenceNDJSONSource(OTUSource):
    path: Path

    async def iter_otus(self) -> AsyncIterator[dict[str, Any]]:
        async with aiofiles.open(self.path) as f:
            while line := await f.readline():
                if line.strip():
                    record = json.loads(line)

                    if record["type"] == "reference":
                        continue

                    if record["type"] == "otu":
                        yield record
                        continue

                    raise ValueError(
                        f"Unsupported reference NDJSON type: {record['type']}",
                    )


class WFNewIndex:
    def __init__(
        self,
        api: WorkflowAPIClient,
        index_id: str,
        manifest: dict[str, int | str],
        path: Path,
        reference: ReferenceNested,
    ):
        self._api = api

        self.id = index_id
        """The ID of the index."""

        self.manifest = manifest
        """The manifest (OTU ID: OTU Version) for the index."""

        self.path = path
        """The path to the index directory in the workflow's work directory."""

        self.reference = reference
        """The parent reference."""

    async def delete(self) -> None:
        await self._api.delete(f"/indexes/{self.id}")

    async def finalize(self) -> None:
        """Finalize the current index."""
        await self._api.patch_json(f"/indexes/{self.id}", {})

    async def upload(
        self,
        path: Path,
        fmt: VirtoolFileFormat = "fasta",
        name: str | None = None,
    ):
        """Upload a file to associate with the index being built.

        Allowed file names are:

        - reference.json.gz
        - reference.fa.gz
        - reference.1.bt2
        - reference.2.bt2
        - reference.3.bt2
        - reference.4.bt2
        - reference.rev.1.bt2
        - reference.rev.2.bt2
        :param path: The path to the file.
        :param fmt: The format of the file.
        :param name: An optional name for the file different that its name on disk.
        :return: A :class:`VirtoolFile` object.
        """
        return await self._api.put_file(
            f"/indexes/{self.id}/files/{name or path.name}",
            path,
            fmt,
        )

    @property
    def otus_json_path(self) -> Path:
        """The path to the JSON file of the index's OTUs in the workflow work path."""
        return self.path / "otus.json"


async def _load_otu_maps(source: OTUSource) -> tuple[dict[str, int], dict[str, str]]:
    sequence_lengths = {}
    sequence_otu_map = {}

    async for otu in source.iter_otus():
        otu_id = _get_otu_id(otu)

        for isolate in otu["isolates"]:
            for sequence in isolate["sequences"]:
                sequence_id = _get_sequence_id(sequence)

                sequence_otu_map[sequence_id] = otu_id
                sequence_lengths[sequence_id] = len(sequence["sequence"])

    return sequence_lengths, sequence_otu_map


def _get_otu_id(otu: dict[str, Any]) -> str:
    return otu["_id"] if "_id" in otu else otu["id"]


def _get_sequence_id(sequence: dict[str, Any]) -> str:
    return sequence["_id"] if "_id" in sequence else sequence["id"]


@fixture
async def index(
    _api: WorkflowAPIClient,
    analysis: Analysis,
    proc: int,
    work_path: Path,
) -> WFIndex:
    """The reference index for the current analysis job."""
    id_ = analysis.index.id

    log = logger.bind(id=id_, resource="index")

    log.info("loading index")

    index_json = await _api.get_json(f"/indexes/{id_}")
    index_ = Index(**index_json)

    log.info("got index json")

    index_work_path = work_path / "indexes" / index_.id
    await asyncio.to_thread(index_work_path.mkdir, parents=True, exist_ok=True)

    log.info("created index directory")

    if any(file.name == "reference.ndjson.gz" for file in index_.files):
        ndjson_path = index_work_path / "reference.ndjson"
        await _api.get_file(
            f"/indexes/{id_}/files/reference.ndjson.gz",
            index_work_path / "reference.ndjson.gz",
        )
        await asyncio.to_thread(
            decompress_file,
            index_work_path / "reference.ndjson.gz",
            ndjson_path,
            proc,
        )

        otu_source = ReferenceNDJSONSource(ndjson_path)
        log.info("loaded index OTUs from reference ndjson")
    else:
        await _api.get_file(
            f"/indexes/{id_}/files/reference.fa.gz",
            index_work_path / "reference.fa.gz",
        )
        log.info("downloaded legacy index fasta")

        await asyncio.to_thread(
            decompress_file,
            index_work_path / "reference.fa.gz",
            index_work_path / "reference.fa",
            proc,
        )

        compressed_otus_path = index_work_path / "otus.json.gz"
        await _api.get_file(f"/indexes/{id_}/files/otus.json.gz", compressed_otus_path)
        await asyncio.to_thread(
            decompress_file,
            compressed_otus_path,
            index_work_path / "otus.json",
            proc,
        )

        otu_source = LegacyOTUJsonSource(index_work_path / "otus.json")
        log.info("loaded index OTUs from legacy otus json")

    sequence_lengths, sequence_otu_map = await _load_otu_maps(otu_source)

    return WFIndex(
        id=id_,
        path=index_work_path,
        manifest=index_.manifest,
        reference=index_.reference,
        sequence_lengths=sequence_lengths,
        sequence_otu_map=sequence_otu_map,
        otu_source=otu_source,
    )


@fixture
async def new_index(
    _api: WorkflowAPIClient,
    job: Job,
    proc: int,
    work_path: Path,
) -> WFNewIndex:
    """The :class:`.WFNewIndex` for an index being created by the current job."""
    try:
        id_ = job.args["index_id"]
    except KeyError:
        raise MissingJobArgumentError("Missing jobs args key 'index_id'")

    log = logger.bind(resource="new_index", id=id_, job_id=job.id)
    log.info("loading index")

    index_json = await _api.get_json(f"/indexes/{id_}")
    index_ = Index(**index_json)

    log.info("got index json")

    index_work_path = work_path / "indexes" / index_.id
    await asyncio.to_thread(index_work_path.mkdir, parents=True, exist_ok=True)

    log.info("created index directory")

    compressed_otus_json_path = index_work_path / "otus.json.gz"
    await _api.get_file(f"/indexes/{id_}/files/otus.json.gz", compressed_otus_json_path)
    log.info("downloaded otus json")

    await asyncio.to_thread(
        decompress_file,
        compressed_otus_json_path,
        index_work_path / "otus.json",
        processes=proc,
    )

    log.info("decompressed otus json")

    return WFNewIndex(
        api=_api,
        index_id=id_,
        manifest=index_.manifest,
        path=index_work_path,
        reference=index_.reference,
    )
