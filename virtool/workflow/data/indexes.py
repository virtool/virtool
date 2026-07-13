import asyncio
import json
from collections.abc import (
    AsyncIterable,
    AsyncIterator,
    Callable,
    Generator,
    Iterable,
    Mapping,
)
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal, TypedDict

import aiofiles
from pyfixtures import fixture
from sqlalchemy import JSON, case, func, literal, select, type_coerce
from sqlalchemy.sql import Select
from sqlalchemy.sql.elements import ColumnElement
from structlog import get_logger

from virtool.analyses.models import Analysis
from virtool.indexes.models import Index
from virtool.jobs.models import Job
from virtool.references.models import ReferenceNested
from virtool.utils import decompress_file
from virtool.workflow.client import WorkflowAPIClient
from virtool.workflow.data.index_sqlite import (
    INDEX_SQLITE_FILE_NAME,
    connect_index_sqlite,
    create_index_sqlite,
    isolates_table,
    otu_schema_table,
    otus_table,
    reference_table,
    sequences_table,
)
from virtool.workflow.errors import MissingJobArgumentError
from virtool.workflow.files import VirtoolFileFormat

logger = get_logger("api")

_SQLITE_SEQUENCE_BATCH_SIZE = 500
_SQLITE_OTU_BATCH_SIZE = 1


class WFIndexOTURef(TypedDict):
    """Reduced OTU reference data."""

    id: str
    abbreviation: str
    name: str
    taxid: int | None
    version: int


@dataclass
class WFIndex:
    """Represents a Virtool reference index for use in analysis workflows."""

    id: str
    """The ID of the index."""

    path: Path
    """The path to the SQLite index artifact."""

    @classmethod
    async def create(
        cls,
        id_: str,
        path: Path,
        reference: Mapping[str, Any] | None,
        otus: AsyncIterable[Mapping[str, Any]],
    ) -> "WFIndex":
        """Create a SQLite index artifact and return a workflow index for it."""
        await create_index_sqlite(path, reference, otus)

        return cls(id_, path)

    @classmethod
    def load(cls, id_: str, path: Path) -> "WFIndex":
        """Load an existing SQLite index artifact."""
        if not path.exists():
            raise FileNotFoundError(path)

        return cls(id_, path)

    async def iter_otus(self) -> AsyncIterator[dict[str, Any]]:
        """Iterate indexed OTUs."""
        async for otus in _iter_sqlite_query_batches(
            self.path,
            _select_sqlite_otus(),
            _SQLITE_OTU_BATCH_SIZE,
            "scalar",
            _validate_sqlite_otu,
        ):
            for otu in otus:
                yield otu

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
        """Get indexed reference metadata excluding OTUs."""
        return await asyncio.to_thread(self._get_reference_metadata)

    async def _iter_sequence_query(
        self,
        query: Select,
    ) -> AsyncIterator[dict[str, Any]]:
        async for sequences in _iter_sqlite_query_batches(
            self.path,
            query,
            _SQLITE_SEQUENCE_BATCH_SIZE,
            "mapping",
            _shape_sqlite_sequence,
        ):
            for sequence in sequences:
                yield sequence

    def _get_reference_metadata(self) -> dict[str, Any]:
        with connect_index_sqlite(self.path) as connection:
            row = connection.execute(select(reference_table)).mappings().one_or_none()

        if row is None:
            msg = "Reference metadata does not exist in the index"
            raise ValueError(msg)

        return dict(row)

    def _get_otu_refs_by_sequence_ids(
        self,
        sequence_ids: set[str],
    ) -> dict[str, WFIndexOTURef]:
        if not sequence_ids:
            return {}

        with connect_index_sqlite(self.path) as connection:
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


def _identity[T](value: T) -> T:
    return value


async def _iter_sqlite_query_batches[T](
    path: Path,
    query: Select,
    batch_size: int,
    row_mode: Literal["mapping", "scalar"],
    shape_row: Callable[[Any], T] = _identity,
) -> AsyncIterator[list[T]]:
    def iter_batches() -> Generator[list[T]]:
        with (
            connect_index_sqlite(path) as connection,
            connection.execute(query) as result,
        ):
            rows = result.scalars() if row_mode == "scalar" else result.mappings()

            for partition in rows.partitions(batch_size):
                yield [shape_row(row) for row in partition]

    batch_iterator = iter_batches()
    event_loop = asyncio.get_running_loop()

    # Resume the SQLite-backed generator on one stable thread for cursor affinity.
    with ThreadPoolExecutor(max_workers=1) as executor:
        try:
            while (
                batch := await event_loop.run_in_executor(
                    executor,
                    next,
                    batch_iterator,
                    None,
                )
            ) is not None:
                yield batch
        finally:
            await event_loop.run_in_executor(executor, batch_iterator.close)


def _get_sequence_id(sequence: Mapping[str, Any]) -> str:
    return sequence["id"]


def _validate_sqlite_otu(otu: dict[str, Any]) -> dict[str, Any]:
    otu_id = otu["id"]

    if not otu["isolates"]:
        msg = f"OTU {otu_id} has no isolates in the index"
        raise ValueError(msg)

    for isolate in otu["isolates"]:
        if not isolate["sequences"]:
            msg = (
                f"Isolate {isolate['id']} in OTU {otu_id} has no sequences in the index"
            )
            raise ValueError(msg)

    return otu


def _normalize_otu_ids(otu_ids: str | Iterable[str]) -> set[str]:
    if isinstance(otu_ids, str):
        return {otu_ids}

    return set(otu_ids)


def _select_sqlite_otus() -> Select:
    return select(
        type_coerce(
            func.json_object(
                "id",
                otus_table.c.id,
                "abbreviation",
                otus_table.c.abbreviation,
                "isolates",
                func.json(_select_sqlite_isolates(otus_table.c.id)),
                "name",
                otus_table.c.name,
                "schema",
                func.json(_select_sqlite_otu_schema(otus_table.c.id)),
                "taxid",
                otus_table.c.taxid,
                "version",
                otus_table.c.version,
            ),
            JSON,
        )
    ).order_by(otus_table.c.id)


def _select_sqlite_otu_schema(otu_id: ColumnElement[str]) -> Select:
    return (
        select(
            func.coalesce(
                func.json_group_array(
                    func.json_object(
                        "molecule",
                        otu_schema_table.c.molecule,
                        "name",
                        otu_schema_table.c.name,
                        "required",
                        _json_bool(otu_schema_table.c.required),
                    )
                ),
                func.json(literal("[]")),
            )
        )
        .where(otu_schema_table.c.otu_id == otu_id)
        .order_by(otu_schema_table.c.name)
        .scalar_subquery()
    )


def _select_sqlite_isolates(otu_id: ColumnElement[str]) -> Select:
    return (
        select(
            func.coalesce(
                func.json_group_array(
                    func.json_object(
                        "default",
                        _json_bool(isolates_table.c.is_default),
                        "id",
                        isolates_table.c.virtool_id,
                        "sequences",
                        func.json(
                            _select_sqlite_isolate_sequences(
                                isolates_table.c.id,
                            )
                        ),
                        "source_name",
                        isolates_table.c.source_name,
                        "source_type",
                        isolates_table.c.source_type,
                    )
                ),
                func.json(literal("[]")),
            )
        )
        .where(isolates_table.c.otu_id == otu_id)
        .order_by(isolates_table.c.virtool_id)
        .scalar_subquery()
    )


def _select_sqlite_isolate_sequences(
    isolate_id: ColumnElement[int],
) -> Select:
    return (
        select(
            func.coalesce(
                func.json_group_array(
                    func.json_object(
                        "id",
                        sequences_table.c.id,
                        "accession",
                        sequences_table.c.accession,
                        "definition",
                        sequences_table.c.definition,
                        "host",
                        sequences_table.c.host,
                        "segment",
                        sequences_table.c.segment,
                        "sequence",
                        sequences_table.c.sequence,
                    )
                ),
                func.json(literal("[]")),
            )
        )
        .where(sequences_table.c.isolate_id == isolate_id)
        .order_by(sequences_table.c.id)
        .scalar_subquery()
    )


def _json_bool(value: ColumnElement[int]) -> ColumnElement[bool]:
    return func.json(
        case(
            (value == 1, literal("true")),
            else_=literal("false"),
        )
    )


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
        return json.loads(await f.read())


def _shape_reference_json_metadata(
    data: Mapping[str, Any],
    index_: Index,
) -> dict[str, Any]:
    return {
        "id": data.get("_id") or data.get("id") or index_.reference.id,
        "created_at": data.get("created_at") or index_.created_at,
        "data_type": data.get("data_type") or index_.reference.data_type,
        "name": data.get("name") or index_.reference.name,
        "organism": data.get("organism") or "unknown",
    }


async def _iter_reference_json_otus(
    data: Mapping[str, Any],
    manifest: Mapping[str, int],
) -> AsyncIterator[dict[str, Any]]:
    for otu in data["otus"]:
        otu_id = otu.get("_id") or otu["id"]
        otu["version"] = manifest[otu_id]

        yield _shape_json_otu(otu)


async def _iter_otus_json(
    data: list[dict[str, Any]],
) -> AsyncIterator[dict[str, Any]]:
    for otu in data:
        yield _shape_json_otu(otu)


def _shape_json_otu(
    otu: dict[str, Any],
) -> dict[str, Any]:
    otu["isolates"] = [_shape_json_isolate(isolate) for isolate in otu["isolates"]]

    return otu


def _shape_json_isolate(isolate: dict[str, Any]) -> dict[str, Any]:
    isolate["sequences"] = [
        _shape_json_sequence(sequence) for sequence in isolate["sequences"]
    ]

    return isolate


def _shape_json_sequence(sequence: dict[str, Any]) -> dict[str, Any]:
    if sequence.get("host") is None:
        sequence["host"] = ""

    return sequence


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

    if any(file.name == "reference.json.gz" for file in index_.files):
        reference_json_path = index_work_path / "reference.json"
        compressed_reference_json_path = index_work_path / "reference.json.gz"

        await _api.get_file(
            f"/indexes/{id_}/files/reference.json.gz",
            compressed_reference_json_path,
        )
        await asyncio.to_thread(
            decompress_file,
            compressed_reference_json_path,
            reference_json_path,
            proc,
        )

        reference_json = await _read_json(reference_json_path)

        reference = _shape_reference_json_metadata(reference_json, index_)
        otus = _iter_reference_json_otus(reference_json, index_.manifest)

        log.info("creating local index sqlite from reference json")
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
        otus = _iter_otus_json(otus_json)

        log.info("creating local index sqlite from otus json")

    return await WFIndex.create(
        id_,
        index_work_path / INDEX_SQLITE_FILE_NAME,
        reference,
        otus,
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
