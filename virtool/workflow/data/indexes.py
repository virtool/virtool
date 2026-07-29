import asyncio
import json
from collections.abc import (
    AsyncIterable,
    AsyncIterator,
    Iterable,
    Iterator,
    Mapping,
)
from dataclasses import dataclass
from pathlib import Path
from typing import Any, TypedDict

import aiofiles
from pyfixtures import fixture
from sqlalchemy import select
from sqlalchemy.sql import Select
from structlog import get_logger

from virtool.analyses.models import Analysis
from virtool.indexes.db import REFERENCE_JSON_V2_FILE_NAME
from virtool.indexes.models import Index
from virtool.references.sqlite import (
    REFERENCE_SQLITE_FILE_NAME,
    SQLiteReference,
    isolates_table,
    otus_table,
    sequences_table,
)
from virtool.utils import decompress_file
from virtool.workflow.client import WorkflowAPIClient

logger = get_logger("api")

_SQLITE_SEQUENCE_BATCH_SIZE = 500
INDEX_SQLITE_FILE_NAME = "index.v1.sqlite"


class WFIndexOTURef(TypedDict):
    """Reduced OTU reference data."""

    id: str
    abbreviation: str
    name: str
    taxid: int | None
    version: int


@dataclass(frozen=True)
class WFIndex(SQLiteReference):
    """Represents a Virtool reference index for use in analysis workflows."""

    id: int
    """The ID of the index."""

    @classmethod
    async def create(
        cls,
        id_: int,
        path: Path,
        reference: Mapping[str, Any] | None,
        otus: Iterable[Mapping[str, Any]],
    ) -> "WFIndex":
        """Create a SQLite reference and return a workflow index for it."""
        index = cls(path=path, id=id_)
        await index._create(reference, otus)

        return index

    @classmethod
    def load(cls, id_: int, path: Path) -> "WFIndex":
        """Load an existing SQLite reference as a workflow index."""
        if not path.exists():
            raise FileNotFoundError(path)

        return cls(path=path, id=id_)

    async def iter_sequences(self) -> AsyncIterator[dict[str, Any]]:
        """Iterate indexed sequences."""
        async for sequence in self._iter_sequence_query(
            _select_sqlite_sequences_with_isolates()
            .order_by(None)
            .order_by(sequences_table.c.id),
        ):
            yield sequence

    async def iter_default_sequences(self) -> AsyncIterator[dict[str, Any]]:
        """Iterate indexed sequences that belong to default isolates."""
        async for sequence in self._iter_sequence_query(
            _select_sqlite_sequences_with_isolates().where(
                isolates_table.c.is_default == 1,
            ),
        ):
            yield sequence

    async def iter_otu_sequences(
        self,
        otu_ids: str | Iterable[str],
    ) -> AsyncIterator[dict[str, Any]]:
        """Iterate indexed sequences belonging to the given OTU IDs."""
        otu_id_set = _normalize_otu_ids(otu_ids)

        if not otu_id_set:
            return

        async for sequence in self._iter_sequence_query(
            _select_sqlite_sequences_with_isolates().where(
                isolates_table.c.otu_id.in_(otu_id_set),
            ),
        ):
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

    async def get_otu_refs_by_sequence_ids(
        self,
        sequence_ids: Iterable[str],
    ) -> dict[str, WFIndexOTURef]:
        """Get reduced OTU reference data keyed by the given sequence IDs."""
        return await asyncio.to_thread(
            self._get_otu_refs_by_sequence_ids,
            set(sequence_ids),
        )

    async def get_reference_metadata(self) -> dict[str, Any]:
        """Get reference metadata excluding OTUs."""
        return await self.get_metadata()

    async def _iter_sequence_query(
        self,
        query: Select,
    ) -> AsyncIterator[dict[str, Any]]:
        async for sequences in self.iter_query_batches(
            query,
            _SQLITE_SEQUENCE_BATCH_SIZE,
            "mapping",
            _shape_sqlite_sequence,
        ):
            for sequence in sequences:
                yield sequence

    def _get_otu_refs_by_sequence_ids(
        self,
        sequence_ids: set[str],
    ) -> dict[str, WFIndexOTURef]:
        if not sequence_ids:
            return {}

        with self.connect() as connection:
            rows = list(
                connection.execute(
                    select(
                        sequences_table.c.id.label("sequence_id"),
                        otus_table.c.id.label("otu_id"),
                        otus_table.c.abbreviation,
                        otus_table.c.name,
                        otus_table.c.taxid,
                        otus_table.c.version,
                    )
                    .join(
                        isolates_table,
                        sequences_table.c.isolate_id == isolates_table.c.id,
                    )
                    .join(otus_table, isolates_table.c.otu_id == otus_table.c.id)
                    .where(sequences_table.c.id.in_(sequence_ids)),
                ).mappings()
            )

        otu_ref_by_sequence_id = {
            row["sequence_id"]: {
                "id": row["otu_id"],
                "abbreviation": row["abbreviation"],
                "name": row["name"],
                "taxid": row["taxid"],
                "version": row["version"],
            }
            for row in rows
        }

        missing_sequence_ids = sequence_ids - otu_ref_by_sequence_id.keys()

        if missing_sequence_ids:
            msg = "The sequence_id does not exist in the index"
            raise ValueError(msg)

        return otu_ref_by_sequence_id


def _get_sequence_id(sequence: Mapping[str, Any]) -> str:
    return sequence["id"]


def _normalize_otu_ids(otu_ids: str | Iterable[str]) -> set[str]:
    if isinstance(otu_ids, str):
        return {otu_ids}

    return set(otu_ids)


def _select_sqlite_sequences_with_isolates() -> Select:
    return (
        select(
            sequences_table.c.id,
            sequences_table.c.isolate_id.label("isolate_internal_id"),
            sequences_table.c.accession,
            sequences_table.c.definition,
            sequences_table.c.host,
            isolates_table.c.virtool_id.label("isolate_virtool_id"),
            isolates_table.c.otu_id,
            sequences_table.c.segment,
            sequences_table.c.sequence,
        )
        .join(
            isolates_table,
            sequences_table.c.isolate_id == isolates_table.c.id,
        )
        .order_by(
            isolates_table.c.otu_id,
            isolates_table.c.virtool_id,
            sequences_table.c.id,
        )
    )


def _shape_sqlite_sequence(sequence: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "id": sequence["id"],
        "accession": sequence["accession"],
        "definition": sequence["definition"],
        "host": sequence["host"],
        "isolate_id": sequence["isolate_virtool_id"],
        "otu_id": sequence["otu_id"],
        "segment": sequence["segment"],
        "sequence": sequence["sequence"],
    }


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


def _iter_reference_json_otus(
    data: Mapping[str, Any],
    manifest: Mapping[str, int],
) -> Iterator[dict[str, Any]]:
    for otu in data["otus"]:
        otu_id = otu.get("_id") or otu["id"]
        otu["version"] = manifest[otu_id]

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
        otus = otus_json

        log.info("creating local SQLite reference from otus json")

    return await WFIndex.create(
        id_,
        index_work_path / INDEX_SQLITE_FILE_NAME,
        reference,
        otus,
    )
