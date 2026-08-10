import asyncio
import json
from collections.abc import (
    AsyncIterable,
    AsyncIterator,
    Iterable,
    Mapping,
)
from pathlib import Path
from typing import Any

import aiofiles
from pyfixtures import fixture
from structlog import get_logger

from virtool.analyses.models import Analysis
from virtool.indexes.db import REFERENCE_JSON_V2_FILE_NAME
from virtool.indexes.models import Index
from virtool.references.sqlite import (
    REFERENCE_SQLITE_FILE_NAME,
    OTUSummary,
    SQLiteReference,
)
from virtool.utils import decompress_file
from virtool.workflow.client import WorkflowAPIClient

logger = get_logger("api")

INDEX_SQLITE_FILE_NAME = "index.v1.sqlite"


class WFIndex:
    """Represents a Virtool reference index for use in analysis workflows."""

    id: int
    """The ID of the index."""

    def __init__(self, id_: int, reference: SQLiteReference) -> None:
        self.id = id_
        self._reference = reference

    @property
    def path(self) -> Path:
        """The path to the underlying portable reference."""
        return self._reference.path

    @classmethod
    async def create(
        cls,
        id_: int,
        path: Path,
        reference: Mapping[str, Any] | None,
        otus: AsyncIterable[Mapping[str, Any]],
    ) -> "WFIndex":
        """Create a SQLite reference and return a workflow index for it."""
        return cls(
            id_,
            await SQLiteReference.create(path, reference, otus),
        )

    @classmethod
    def load(cls, id_: int, path: Path) -> "WFIndex":
        """Load an existing SQLite reference as a workflow index."""
        return cls(id_, SQLiteReference.load(path))

    async def iter_otus(self) -> AsyncIterator[dict[str, Any]]:
        """Iterate complete OTUs in the index reference."""
        async for otu in self._reference.iter_otus():
            yield otu

    async def iter_sequences(self) -> AsyncIterator[dict[str, Any]]:
        """Iterate indexed sequences."""
        async for sequence in self._reference.iter_sequences():
            yield sequence

    async def iter_default_sequences(self) -> AsyncIterator[dict[str, Any]]:
        """Iterate indexed sequences that belong to default isolates."""
        async for sequence in self._reference.iter_default_sequences():
            yield sequence

    async def iter_otu_sequences(
        self,
        otu_ids: str | Iterable[str],
    ) -> AsyncIterator[dict[str, Any]]:
        """Iterate indexed sequences belonging to the given OTU IDs."""
        async for sequence in self._reference.iter_otu_sequences(otu_ids):
            yield sequence

    async def write_fasta(
        self,
        path: Path,
        sequences: AsyncIterable[Mapping[str, Any]],
    ) -> None:
        """Write the given sequence documents to a FASTA file."""
        async with aiofiles.open(path, "w") as f:
            async for sequence in sequences:
                await f.write(
                    f">{_get_sequence_id(sequence)}\n{sequence['sequence']}\n"
                )

    async def get_otu_summaries_by_sequence_ids(
        self,
        sequence_ids: Iterable[str],
    ) -> dict[str, OTUSummary]:
        """Get top-level OTU information keyed by the given sequence IDs."""
        return await self._reference.get_otu_summaries_by_sequence_ids(sequence_ids)

    async def get_reference_metadata(self) -> dict[str, Any]:
        """Get reference metadata excluding OTUs."""
        return await self._reference.get_metadata()


def _get_sequence_id(sequence: Mapping[str, Any]) -> str:
    return sequence["id"]


async def _read_json(path: Path) -> dict[str, Any] | list[dict[str, Any]]:
    async with aiofiles.open(path) as f:
        return await asyncio.to_thread(json.loads, await f.read())


def _shape_reference_json_metadata(
    data: Mapping[str, Any],
) -> dict[str, Any] | None:
    if "_id" not in data and "id" not in data:
        return None

    return {
        "id": data["_id"] if "_id" in data else data["id"],
        "created_at": data["created_at"],
        "data_type": data["data_type"],
        "name": data["name"],
        "organism": data["organism"],
    }


async def _iter_reference_json_otus(
    data: Mapping[str, Any],
    manifest: Mapping[str, int],
) -> AsyncIterator[dict[str, Any]]:
    for otu in data["otus"]:
        otu_id = otu.get("_id") or otu["id"]
        otu["version"] = manifest[otu_id]

        yield otu


async def _iter_otus(
    otus: Iterable[Mapping[str, Any]],
) -> AsyncIterator[Mapping[str, Any]]:
    for otu in otus:
        yield otu


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

    index_work_path = work_path / "indexes" / str(index_.id)
    await asyncio.to_thread(index_work_path.mkdir, parents=True, exist_ok=True)

    log.info("created index directory")

    if any(file.name == REFERENCE_SQLITE_FILE_NAME for file in index_.files):
        reference_sqlite_path = index_work_path / REFERENCE_SQLITE_FILE_NAME

        await _api.get_file(
            f"/indexes/{id_}/files/{REFERENCE_SQLITE_FILE_NAME}",
            reference_sqlite_path,
        )

        log.info("loaded server SQLite reference")

        return WFIndex.load(id_, reference_sqlite_path)

    if any(file.name == REFERENCE_JSON_V2_FILE_NAME for file in index_.files):
        compressed_reference_json_path = index_work_path / REFERENCE_JSON_V2_FILE_NAME
        reference_json_path = compressed_reference_json_path.with_suffix("")

        await _api.get_file(
            f"/indexes/{id_}/files/{REFERENCE_JSON_V2_FILE_NAME}",
            compressed_reference_json_path,
        )
        await asyncio.to_thread(
            decompress_file,
            compressed_reference_json_path,
            reference_json_path,
            proc,
        )

        reference_json = await _read_json(reference_json_path)

        reference = _shape_reference_json_metadata(reference_json)
        otus = _iter_reference_json_otus(reference_json, index_.manifest)

        log.info("creating local SQLite reference from reference json")
    else:
        otus_json_path = index_work_path / "otus.json"
        compressed_otus_json_path = index_work_path / "otus.json.gz"

        await _api.get_file(
            f"/indexes/{id_}/files/otus.json.gz",
            compressed_otus_json_path,
        )
        await asyncio.to_thread(
            decompress_file,
            compressed_otus_json_path,
            otus_json_path,
            proc,
        )

        otus_json = await _read_json(otus_json_path)

        if not isinstance(otus_json, list):
            msg = "otus.json must contain a list of OTUs"
            raise TypeError(msg)

        reference = None
        otus = _iter_otus(otus_json)

        log.info("creating local SQLite reference from otus json")

    return await WFIndex.create(
        id_,
        index_work_path / INDEX_SQLITE_FILE_NAME,
        reference,
        otus,
    )
