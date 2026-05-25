"""Read-only post-migration inspection for the storage migration.

Provides the implementation behind ``virtool migration storage-inspect``.
The script never deletes from disk or object storage; it produces a
report and a non-zero exit when any check fails. Three checks run:

1. **Orphan walk.** Every file under ``data_path/`` must be covered by a
   source-backend listing for one of the configured categories, or fall
   in an explicit "ignored" bucket (defunct top-level dirs, top-level
   archive files). Anything left over is an orphan and fails the run.
2. **Listing parity.** :func:`~virtool.migration.storage.verify_category`
   re-runs for each requested category — cheap drift detection.
3. **Content hash sample.** For each requested category, a random sample
   of source keys is stream-hashed end to end and compared against the
   destination. ``--full-hash`` upgrades the sample to every key.

This is the gate before deleting the on-disk source: matching listings
plus matching content hashes give defensible evidence that the migration
landed correctly.
"""

import hashlib
import os
import random
import re
from collections.abc import AsyncIterator
from dataclasses import dataclass
from pathlib import Path

from structlog import get_logger

from virtool.migration.storage import (
    CATEGORY_PREFIXES,
    FAILURE_LOG_SAMPLE,
    StorageVerificationReport,
    build_source_backend,
    verify_category,
)
from virtool.migration.storage_settings import StorageMigrationSettings
from virtool.storage.errors import StorageKeyNotFoundError
from virtool.storage.factory import build_primary_backend
from virtool.storage.legacy import LegacyIndexFilesystemAdapter
from virtool.storage.protocol import StorageBackend

logger = get_logger("migration")


DEFUNCT_TOP_LEVEL_DIRS: frozenset[str] = frozenset({"caches", "logs"})
"""Top-level directories under ``data_path`` that no longer hold live data.

Files under these prefixes are reported in ``ignored`` rather than
``orphans`` so they do not block a deletion gate. They predate the
object-storage migration and were never enumerated by any category.
"""


TOP_LEVEL_ARCHIVE_RE = re.compile(r"^[^/]+\.(tar\.gz|tgz|zip)$")
"""Matches a top-level archive file (e.g. ``azcopy_linux_amd64_10.16.1.tar.gz``).

Operator tooling occasionally lands a tarball at the root of ``data_path``;
those don't belong to any storage category but are not data corruption.
"""


@dataclass(frozen=True, slots=True)
class StorageInspectionReport:
    """Aggregated result of a single ``run_storage_inspection`` invocation."""

    orphans: list[str]
    ignored: list[str]
    verification: dict[str, StorageVerificationReport]
    hash_mismatches: dict[str, list[str]]
    hash_sampled: dict[str, int]
    walked: int = 0
    covered: int = 0

    @property
    def ok(self) -> bool:
        return (
            not self.orphans
            and all(v.ok for v in self.verification.values())
            and not any(self.hash_mismatches.values())
        )


@dataclass(frozen=True, slots=True)
class _OrphanWalkResult:
    walked: int
    covered: int
    orphans: list[str]
    ignored: list[str]


def _walk_disk(data_path: Path) -> set[str]:
    """Return every regular file under ``data_path`` as a ``/``-joined string."""
    paths: set[str] = set()

    for dirpath, _, filenames in os.walk(data_path):
        for filename in filenames:
            full = Path(dirpath) / filename
            paths.add(full.relative_to(data_path).as_posix())

    return paths


async def _collect_covered_disk_paths(
    settings: StorageMigrationSettings,
) -> set[str]:
    """Project every category's source listing back to disk-relative paths."""
    covered: set[str] = set()

    for category in CATEGORY_PREFIXES:
        prefix = CATEGORY_PREFIXES[category]
        source = build_source_backend(settings, category)

        if isinstance(source, LegacyIndexFilesystemAdapter):
            async for info in source.list(prefix):
                disk_path = await source._translate(info.key)  # noqa: SLF001
                if disk_path is not None:
                    covered.add(disk_path)
        else:
            async for info in source.list(prefix):
                covered.add(info.key)

    return covered


def _classify_remaining(
    walked: set[str],
    covered: set[str],
) -> tuple[list[str], list[str]]:
    """Split disk paths not covered by any category into orphans and ignored."""
    orphans: list[str] = []
    ignored: list[str] = []

    for path in sorted(walked - covered):
        top = path.split("/", 1)[0]

        if top in DEFUNCT_TOP_LEVEL_DIRS or TOP_LEVEL_ARCHIVE_RE.match(path):
            ignored.append(path)
        else:
            orphans.append(path)

    return orphans, ignored


async def _orphan_walk(settings: StorageMigrationSettings) -> _OrphanWalkResult:
    """Run the orphan walk and return classified results."""
    logger.info("orphan walk start", data_path=str(settings.data_path))

    walked = _walk_disk(settings.data_path)
    covered = await _collect_covered_disk_paths(settings)
    orphans, ignored = _classify_remaining(walked, covered)

    logger.info(
        "orphan walk complete",
        walked=len(walked),
        covered=len(walked & covered),
        orphans=len(orphans),
        ignored=len(ignored),
    )

    return _OrphanWalkResult(
        walked=len(walked),
        covered=len(walked & covered),
        orphans=orphans,
        ignored=ignored,
    )


async def _hash_stream(chunks: AsyncIterator[bytes]) -> str:
    h = hashlib.sha256()
    async for chunk in chunks:
        h.update(chunk)
    return h.hexdigest()


def _pick_sample(
    keys: list[str],
    sample_size: int,
    full_hash: bool,
    rng: random.Random,
) -> list[str]:
    if full_hash or sample_size >= len(keys):
        return keys
    return rng.sample(keys, sample_size)


async def _hash_sample(
    source: StorageBackend,
    destination: StorageBackend,
    keys: list[str],
) -> list[str]:
    mismatches: list[str] = []

    for key in keys:
        source_hash = await _hash_stream(source.read(key))

        try:
            destination_hash = await _hash_stream(destination.read(key))
        except StorageKeyNotFoundError:
            mismatches.append(key)
            continue

        if source_hash != destination_hash:
            mismatches.append(key)

    return sorted(mismatches)


async def _inspect_category(
    settings: StorageMigrationSettings,
    destination: StorageBackend,
    category: str,
    sample_size: int,
    full_hash: bool,
    rng: random.Random,
) -> tuple[StorageVerificationReport, list[str], int]:
    prefix = CATEGORY_PREFIXES[category]
    source = build_source_backend(settings, category)

    logger.info("inspecting category", category=category, prefix=prefix)

    verification = await verify_category(source, destination, prefix)

    if verification.ok:
        logger.info(
            "listing parity ok",
            category=category,
            source_count=verification.source_count,
            destination_count=verification.destination_count,
        )
    else:
        logger.error(
            "listing parity failed",
            category=category,
            source_count=verification.source_count,
            destination_count=verification.destination_count,
            missing_count=len(verification.missing_keys),
            size_mismatch_count=len(verification.size_mismatches),
            missing_keys_sample=verification.missing_keys[:FAILURE_LOG_SAMPLE],
            size_mismatches_sample=verification.size_mismatches[:FAILURE_LOG_SAMPLE],
        )

    source_keys: list[str] = [info.key async for info in source.list(prefix)]

    sample_keys = _pick_sample(source_keys, sample_size, full_hash, rng)
    mismatches = await _hash_sample(source, destination, sample_keys)

    if mismatches:
        logger.error(
            "content sample mismatch",
            category=category,
            mismatches=len(mismatches),
            sampled=len(sample_keys),
            sample=mismatches[:FAILURE_LOG_SAMPLE],
        )
    else:
        logger.info(
            "content sample ok",
            category=category,
            sampled=len(sample_keys),
            mismatches=0,
        )

    return verification, mismatches, len(sample_keys)


async def run_storage_inspection(
    settings: StorageMigrationSettings,
    category: str | None,
    sample_size: int,
    full_hash: bool,
) -> None:
    """Run the orphan walk, listing parity, and content sample checks.

    Raises :class:`SystemExit` with a non-zero status if any check fails.
    """
    categories: list[str] = (
        [category] if category is not None else list(CATEGORY_PREFIXES)
    )

    destination = build_primary_backend(settings)

    logger.info(
        "starting storage inspection",
        backend=settings.storage_backend,
        categories=len(categories),
        sample_size=sample_size,
        full_hash=full_hash,
    )

    orphan_result = await _orphan_walk(settings)

    if orphan_result.orphans:
        logger.error(
            "orphans detected",
            count=len(orphan_result.orphans),
            sample=orphan_result.orphans[:FAILURE_LOG_SAMPLE],
        )

    if orphan_result.ignored:
        logger.info(
            "ignored paths",
            count=len(orphan_result.ignored),
            sample=orphan_result.ignored[:FAILURE_LOG_SAMPLE],
        )

    rng = random.Random()  # noqa: S311 — sampling for QA, not cryptography

    verification: dict[str, StorageVerificationReport] = {}
    hash_mismatches: dict[str, list[str]] = {}
    hash_sampled: dict[str, int] = {}

    for cat in categories:
        cat_verification, cat_mismatches, cat_sampled = await _inspect_category(
            settings,
            destination,
            cat,
            sample_size,
            full_hash,
            rng,
        )
        verification[cat] = cat_verification
        hash_mismatches[cat] = cat_mismatches
        hash_sampled[cat] = cat_sampled

    report = StorageInspectionReport(
        orphans=orphan_result.orphans,
        ignored=orphan_result.ignored,
        verification=verification,
        hash_mismatches=hash_mismatches,
        hash_sampled=hash_sampled,
        walked=orphan_result.walked,
        covered=orphan_result.covered,
    )

    sampled_total = sum(hash_sampled.values())
    missing_total = sum(len(v.missing_keys) for v in verification.values())
    size_mismatch_total = sum(len(v.size_mismatches) for v in verification.values())
    hash_mismatch_total = sum(len(v) for v in hash_mismatches.values())

    if report.ok:
        logger.info(
            "inspection passed",
            orphans=0,
            verification_ok=True,
            hash_mismatches=0,
            sampled_total=sampled_total,
        )
        return

    logger.error(
        "inspection failed",
        orphans=len(report.orphans),
        missing_keys=missing_total,
        size_mismatches=size_mismatch_total,
        hash_mismatches=hash_mismatch_total,
    )
    raise SystemExit(1)
