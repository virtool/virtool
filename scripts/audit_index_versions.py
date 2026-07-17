"""Audit the ``indexes`` collection before it is normalized into Postgres.

Answers whether the planned ``indexes`` table can carry ``UNIQUE (reference_id,
version)`` and ``CHECK (num_nonnulls(job_id, task_id) = 1)``, and sizes the backfill.

Index version allocation is a check-then-act race (``ReferenceData.create_index``
guards and allocates outside its own transaction), no unique index has ever existed
on the Mongo collection, and ``IndexData.delete`` has no ``ready`` guard so a deleted
ready index frees its version for reuse. Any of the three can have produced a
duplicate ``(reference.id, version)`` pair that would fail the backfill partway
through, so the condition is measured rather than assumed.

``indexes`` documents embed ``reference.id`` in dual form mid-migration: some hold the
legacy Mongo string id, others the integer ``legacy_references`` primary key. Grouping
on the raw value would miss exactly the duplicates a mid-migration race produces, so
every embedded id is resolved to a canonical primary key first, mirroring
``compose_reference_ids_match``. The mapping lives in Postgres and cannot be joined
server-side, so the grouping is done in Python.

This script is read-only. It mutates neither store, and is safe to run against
production with a read-only connection or against a restored snapshot.

Run it with::

    python scripts/audit_index_versions.py \
        --mongodb-connection-string mongodb://.../virtool \
        --postgres-connection-string postgresql://.../virtool

"""

import asyncio
import statistics
from dataclasses import dataclass

import bson
import click
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.uri_parser import parse_uri
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.config.options import (
    mongodb_connection_string_option,
    postgres_connection_string_option,
)
from virtool.jobs.pg import SQLJob
from virtool.logs import configure_logging
from virtool.mongo.connect import connect_motor_database
from virtool.pg.utils import PgOptions, connect_pg
from virtool.references.sql import SQLReference

TOP_REFERENCE_COUNT = 10
"""How many of the highest-volume references to list in the Q2 report."""


@dataclass
class ReferenceMap:
    """A resolver from either embedded ``reference.id`` form to a canonical pk."""

    canonical: dict[int | str, int]
    """Maps both the integer pk and the legacy string id to the integer pk."""

    legacy_ids: dict[int, str | None]
    """Maps a pk to its ``legacy_id``, which is ``NULL`` for a Postgres-native row."""

    names: dict[int, str]
    """Maps a pk to its reference name, for report readability."""


@dataclass
class IndexRecord:
    """The audited facts of one ``indexes`` document."""

    id: str
    reference_id: int | str
    canonical_reference_id: int | None
    version: int | None
    ready: bool | None
    created_at: object
    manifest_key_count: int
    bson_size: int
    job_id: int | str | None
    task_id: int | str | None

    @property
    def reference_id_form(self) -> str:
        """Which of the two dual-form id representations this document stored."""
        return "integer pk" if isinstance(self.reference_id, int) else "legacy string"

    @property
    def linkage(self) -> str:
        """The build-linkage bucket this document falls into.

        ``both`` and ``neither`` violate the planned CHECK constraint.
        """
        if self.job_id is not None and self.task_id is not None:
            return "both"

        if self.job_id is not None:
            return "job"

        if self.task_id is not None:
            return "task"

        return "neither"


async def load_reference_map(pg: AsyncEngine) -> ReferenceMap:
    """Build a resolver covering both embedded ``reference.id`` forms.

    Mirrors ``compose_reference_ids_match``: a reference is addressable by its integer
    primary key and, when it has one, by its legacy Mongo string id.
    """
    async with AsyncSession(pg) as session:
        rows = (
            await session.execute(
                select(SQLReference.id, SQLReference.legacy_id, SQLReference.name),
            )
        ).all()

    canonical: dict[int | str, int] = {}

    for row in rows:
        canonical[row.id] = row.id

        if row.legacy_id is not None:
            canonical[row.legacy_id] = row.id

    return ReferenceMap(
        canonical=canonical,
        legacy_ids={row.id: row.legacy_id for row in rows},
        names={row.id: row.name for row in rows},
    )


async def load_job_ids(pg: AsyncEngine) -> tuple[set[int], set[str]]:
    """Return every job primary key and legacy id in Postgres."""
    async with AsyncSession(pg) as session:
        rows = (await session.execute(select(SQLJob.id, SQLJob.legacy_id))).all()

    return (
        {row.id for row in rows},
        {row.legacy_id for row in rows if row.legacy_id is not None},
    )


def job_resolves(job_id: int | str, ids: set[int], legacy_ids: set[str]) -> bool:
    """Whether ``job_id`` resolves to a job row.

    Mirrors ``_match_job_id`` in ``virtool.jobs.transforms``, which the API's
    ``AttachJobTransform`` uses today: a digit-like id may be either form, and any
    other string can only be a legacy id.
    """
    if isinstance(job_id, int) or (isinstance(job_id, str) and job_id.isdigit()):
        return int(job_id) in ids or str(job_id) in legacy_ids

    return job_id in legacy_ids


def _linkage_id(value: dict | None) -> int | str | None:
    """Pull the id out of an embedded ``job`` or ``task`` linkage object.

    ``_get_index_build_type`` subscripts ``document["job"]`` and ``document["task"]``
    directly, so it assumes both keys exist and may be null. This audit exists to
    measure malformed state, so an absent key, a null linkage, and a linkage object
    with no ``id`` are all read as "not linked" rather than raising.
    """
    if value is None:
        return None

    return value.get("id")


async def scan_indexes(
    mongo: AsyncIOMotorDatabase, references: ReferenceMap
) -> list[IndexRecord]:
    """Read every ``indexes`` document and reduce it to its audited facts.

    Document ids are snapshotted up front and each document is then fetched
    individually. Manifests hold one key per OTU and a large reference is tens of
    thousands of OTUs, so a single cursor held across the whole collection risks a
    timeout on production.
    """
    index_ids = [
        document["_id"] async for document in mongo.indexes.find({}, projection=["_id"])
    ]

    records = []

    for index_id in index_ids:
        document = await mongo.indexes.find_one({"_id": index_id})

        if document is None:
            continue

        reference_id = document["reference"]["id"]
        manifest = document.get("manifest") or {}

        records.append(
            IndexRecord(
                id=document["_id"],
                reference_id=reference_id,
                canonical_reference_id=references.canonical.get(reference_id),
                version=document.get("version"),
                ready=document.get("ready"),
                created_at=document.get("created_at"),
                manifest_key_count=len(manifest),
                bson_size=len(bson.encode(document)),
                job_id=_linkage_id(document.get("job")),
                task_id=_linkage_id(document.get("task")),
            ),
        )

    return records


def _describe_reference(references: ReferenceMap, pk: int) -> str:
    return (
        f"pk={pk} legacy_id={references.legacy_ids.get(pk)!r} "
        f"name={references.names.get(pk)!r}"
    )


def _report_duplicates(records: list[IndexRecord], references: ReferenceMap) -> None:
    groups: dict[tuple[int, int | None], list[IndexRecord]] = {}

    for record in records:
        if record.canonical_reference_id is None:
            continue

        groups.setdefault(
            (record.canonical_reference_id, record.version),
            [],
        ).append(record)

    duplicates = {key: group for key, group in groups.items() if len(group) > 1}

    print("1. DUPLICATE (reference_id, version) PAIRS")

    if not duplicates:
        print("   NO. UNIQUE (reference_id, version) is safe to add.")
        print(f"   Checked {len(groups)} distinct (reference, version) pairs.")
        return

    pairs = "pair" if len(duplicates) == 1 else "pairs"

    print(f"   YES -- {len(duplicates)} duplicated {pairs}. DO NOT ADD THE CONSTRAINT.")
    print("   A repair revision is needed before the backfill (VIR-2766 is blocked).")

    for (pk, version), group in sorted(duplicates.items(), key=lambda item: item[0][0]):
        print(f"\n   reference {_describe_reference(references, pk)} version={version}")

        for record in sorted(group, key=lambda r: str(r.created_at)):
            print(
                f"     _id={record.id} ready={record.ready} "
                f"created_at={record.created_at} stored={record.reference_id_form}",
            )


def _report_orphans(records: list[IndexRecord]) -> None:
    orphans = [r for r in records if r.canonical_reference_id is None]

    print("\n2. ORPHANED REFERENCES")

    if not orphans:
        print("   0. Every index resolves to a reference row.")
        return

    print(f"   {len(orphans)} indexes resolve to no reference row.")

    for record in orphans:
        print(f"     _id={record.id} reference.id={record.reference_id!r}")


def _report_volumes(records: list[IndexRecord], references: ReferenceMap) -> None:
    print("\n3. VOLUMES")
    print(f"   Total indexes: {len(records)}")

    per_reference: dict[int, int] = {}

    for record in records:
        if record.canonical_reference_id is not None:
            per_reference[record.canonical_reference_id] = (
                per_reference.get(record.canonical_reference_id, 0) + 1
            )

    if not per_reference:
        print("   No indexes resolve to a reference.")
        return

    counts = sorted(per_reference.values())

    print(f"   References with indexes: {len(per_reference)}")
    print(
        f"   Per-reference min={counts[0]} "
        f"median={statistics.median(counts)} max={counts[-1]}",
    )
    print(f"   Top {TOP_REFERENCE_COUNT}:")

    for pk, count in sorted(
        per_reference.items(),
        key=lambda item: item[1],
        reverse=True,
    )[:TOP_REFERENCE_COUNT]:
        print(f"     {count:>5} indexes  {_describe_reference(references, pk)}")


def _report_manifests(records: list[IndexRecord]) -> None:
    print("\n4. MANIFEST SIZING")

    if not records:
        print("   No indexes.")
        return

    key_counts = sorted(r.manifest_key_count for r in records)
    largest_manifest = max(records, key=lambda r: r.manifest_key_count)
    largest_document = max(records, key=lambda r: r.bson_size)

    print(
        f"   Manifest keys min={key_counts[0]} "
        f"median={statistics.median(key_counts)} max={key_counts[-1]}",
    )
    print(
        f"   Largest manifest: _id={largest_manifest.id} "
        f"keys={largest_manifest.manifest_key_count} "
        f"bson={largest_manifest.bson_size} bytes",
    )
    print(
        f"   Largest document: _id={largest_document.id} "
        f"bson={largest_document.bson_size} bytes "
        f"({largest_document.bson_size / 1_048_576:.2f} MiB) "
        f"keys={largest_document.manifest_key_count}",
    )


def _report_linkage(records: list[IndexRecord]) -> None:
    buckets: dict[str, list[IndexRecord]] = {
        "job": [],
        "task": [],
        "both": [],
        "neither": [],
    }

    for record in records:
        buckets[record.linkage].append(record)

    print("\n5. BUILD LINKAGE")
    print(f"   job-backed (job set, task null):  {len(buckets['job'])}")
    print(f"   task-backed (task set, job null): {len(buckets['task'])}")
    print(f"   both set (violates CHECK):        {len(buckets['both'])}")
    print(f"   neither set (violates CHECK):     {len(buckets['neither'])}")

    violations = buckets["both"] + buckets["neither"]

    if not violations:
        print("   CHECK (num_nonnulls(job_id, task_id) = 1) is safe to add.")
        return

    print(
        f"   {len(violations)} documents violate the CHECK. "
        "A repair path is needed before the backfill.",
    )

    for record in buckets["both"]:
        print(f"     both    _id={record.id} job={record.job_id} task={record.task_id}")

    for record in buckets["neither"]:
        print(f"     neither _id={record.id}")


def _report_jobs(
    records: list[IndexRecord], ids: set[int], legacy_ids: set[str]
) -> None:
    unresolvable = [
        record
        for record in records
        if record.job_id is not None
        and not job_resolves(record.job_id, ids, legacy_ids)
    ]

    print("\n6. UNRESOLVABLE JOBS")

    # Every index carrying a job.id is checked, including any that also carry a task
    # and so fall in the "both" bucket above. This count is therefore not the
    # "job-backed" count in section 5, which excludes those.
    with_job = [r for r in records if r.job_id is not None]

    if not unresolvable:
        print(
            f"   0 of {len(with_job)} indexes with a job.id point at a vanished job. "
            "job_id can be a NOT NULL FK on job-backed rows.",
        )
        return

    print(
        f"   {len(unresolvable)} of {len(with_job)} indexes with a job.id point at a "
        "job with no Postgres row. The backfill needs a documented drop path.",
    )

    for record in unresolvable:
        print(f"     _id={record.id} job.id={record.job_id!r}")


def report(
    records: list[IndexRecord],
    references: ReferenceMap,
    job_ids: set[int],
    job_legacy_ids: set[str],
) -> None:
    """Print all six findings, including those whose answer is zero."""
    print("=" * 78)
    print("INDEX VERSION AUDIT")
    print("=" * 78)

    _report_duplicates(records, references)
    _report_orphans(records)
    _report_volumes(records, references)
    _report_manifests(records)
    _report_linkage(records)
    _report_jobs(records, job_ids, job_legacy_ids)

    print("\n" + "=" * 78)


async def audit(
    mongodb_connection_string: str, postgres_connection_string: str
) -> None:
    """Read both stores and print the audit report."""
    mongo = await connect_motor_database(
        mongodb_connection_string,
        parse_uri(mongodb_connection_string)["database"],
    )

    pg = await connect_pg(PgOptions.from_connection_string(postgres_connection_string))

    try:
        references = await load_reference_map(pg)
        job_ids, job_legacy_ids = await load_job_ids(pg)
        records = await scan_indexes(mongo, references)
    finally:
        await pg.dispose()

    report(records, references, job_ids, job_legacy_ids)


@click.command()
@mongodb_connection_string_option
@postgres_connection_string_option
def entry(mongodb_connection_string: str, postgres_connection_string: str) -> None:
    """Audit the indexes collection for duplicate versions and CHECK violations."""
    configure_logging(use_sentry=False)
    asyncio.run(audit(mongodb_connection_string, postgres_connection_string))


if __name__ == "__main__":
    entry()
