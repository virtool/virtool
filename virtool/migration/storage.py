"""Per-category storage migration from filesystem to object storage.

Provides the implementation behind ``virtool migration storage``. Streams
files from a :class:`~virtool.storage.filesystem.FilesystemProvider`
(optionally wrapped in :class:`~virtool.storage.legacy.LegacyIndexFilesystemAdapter`
for the ``indexes`` category) into the configured object backend obtained
via :func:`~virtool.storage.factory.build_primary_backend`, bypassing the
runtime :class:`~virtool.storage.routing.FallbackStorageRouter`.

The migrator is idempotent: it probes the destination for each key and
skips files already present with a matching byte size. Source files are
never deleted; operators do that manually after verifying.
"""

from dataclasses import dataclass

from structlog import get_logger

from virtool.migration.storage_settings import StorageMigrationSettings
from virtool.storage.factory import build_primary_backend
from virtool.storage.filesystem import FilesystemProvider
from virtool.storage.legacy import LegacyIndexFilesystemAdapter
from virtool.storage.protocol import StorageBackend

logger = get_logger("migration")


CATEGORY_PREFIXES: dict[str, str] = {
    "hmms": "hmm/",
    "uploads": "files/",
    "subtractions": "subtractions/",
    "ml-models": "ml/",
    "history": "history/",
    "indexes": "indexes/",
    "samples": "samples/",
    "analyses": "analyses/",
}
"""Maps a CLI ``--category`` value to its on-disk / storage key prefix.

The on-disk directory names were confirmed against the data-layer modules
(``virtool/hmm/data.py``, ``virtool/uploads/utils.py`` etc.). Note that the
``hmms`` category uses the ``hmm/`` prefix (singular on disk).

There is intentionally no ``references`` category. The on-disk
``data_path/references/`` tree holds only the legacy index file layout;
the application reads those files via ``indexes/{index_id}/...`` keys, so
the ``indexes`` category (with :class:`LegacyIndexFilesystemAdapter`)
already migrates them to the correct destination keys. A literal
``references/`` migration would copy them under keys nothing reads.
"""


PROGRESS_LOG_INTERVAL: int = 100
"""Log a running progress line every N files processed."""


FAILURE_LOG_SAMPLE: int = 10
"""Cap the per-list sample of failing keys included in the verification log.

The full :class:`StorageVerificationReport` is still returned to the caller;
the log line is bounded so a large failure does not produce an unwieldy
structured log entry.
"""


@dataclass(frozen=True, slots=True)
class StorageMigrationReport:
    """Result of a single ``migrate_category`` invocation."""

    copied: int
    skipped: int
    bytes_copied: int


@dataclass(frozen=True, slots=True)
class StorageVerificationReport:
    """Comparison of source and destination after a migration."""

    source_count: int
    destination_count: int
    missing_keys: list[str]
    size_mismatches: list[str]

    @property
    def ok(self) -> bool:
        return not self.missing_keys and not self.size_mismatches


async def migrate_category(
    source: StorageBackend,
    destination: StorageBackend,
    prefix: str,
    *,
    dry_run: bool = False,
) -> StorageMigrationReport:
    """Stream every object under ``prefix`` from ``source`` to ``destination``.

    Skips objects already present in ``destination`` with the same byte
    size. When ``dry_run`` is true, logs what would be copied without
    writing.

    The destination prefix is enumerated once up-front into an in-memory
    ``key -> size`` map, so per-file existence checks don't fire an extra
    metadata round-trip (e.g. an S3 ``HEAD``) for every source object.
    """
    destination_sizes: dict[str, int] = {
        info.key: info.size async for info in destination.list(prefix)
    }

    copied = 0
    skipped = 0
    bytes_copied = 0
    seen = 0

    async for info in source.list(prefix):
        seen += 1

        destination_size = destination_sizes.get(info.key)

        if destination_size == info.size:
            skipped += 1
        elif dry_run:
            logger.info(
                "would copy",
                key=info.key,
                size=info.size,
                replaces=destination_size is not None,
            )
        else:
            written = await destination.write(info.key, source.read(info.key))
            copied += 1
            bytes_copied += written

        if seen % PROGRESS_LOG_INTERVAL == 0:
            logger.info(
                "migration progress",
                prefix=prefix,
                seen=seen,
                copied=copied,
                skipped=skipped,
                bytes_copied=bytes_copied,
                dry_run=dry_run,
            )

    logger.info(
        "migration finished",
        prefix=prefix,
        copied=copied,
        skipped=skipped,
        bytes_copied=bytes_copied,
        dry_run=dry_run,
    )

    return StorageMigrationReport(
        copied=copied,
        skipped=skipped,
        bytes_copied=bytes_copied,
    )


async def verify_category(
    source: StorageBackend,
    destination: StorageBackend,
    prefix: str,
) -> StorageVerificationReport:
    """Compare source and destination listings under ``prefix``.

    For every source key, asserts the destination has the same key with a
    matching byte size. Catches truncated or partial writes without
    re-streaming file contents.
    """
    source_keys: dict[str, int] = {}
    async for info in source.list(prefix):
        source_keys[info.key] = info.size

    destination_keys: dict[str, int] = {}
    async for info in destination.list(prefix):
        destination_keys[info.key] = info.size

    missing_keys = sorted(k for k in source_keys if k not in destination_keys)
    size_mismatches = sorted(
        k
        for k, size in source_keys.items()
        if k in destination_keys and destination_keys[k] != size
    )

    return StorageVerificationReport(
        source_count=len(source_keys),
        destination_count=len(destination_keys),
        missing_keys=missing_keys,
        size_mismatches=size_mismatches,
    )


def build_source_backend(
    settings: StorageMigrationSettings,
    category: str,
) -> StorageBackend:
    """Build the filesystem source backend for ``category``.

    The ``indexes`` category requires :class:`LegacyIndexFilesystemAdapter`
    to translate ``indexes/{index_id}/...`` keys to the legacy on-disk
    layout under ``data_path/references/{ref_id}/{index_id}/...``.
    """
    filesystem = FilesystemProvider(settings.data_path)

    if category == "indexes":
        return LegacyIndexFilesystemAdapter(filesystem, settings.data_path)

    return filesystem


async def run_storage_migration(
    settings: StorageMigrationSettings,
    category: str,
    dry_run: bool,
) -> None:
    """Run ``migrate_category`` then ``verify_category`` for one CLI invocation.

    Raises :class:`SystemExit` with a non-zero status when verification
    detects missing keys or size mismatches.
    """
    prefix = CATEGORY_PREFIXES[category]

    source = build_source_backend(settings, category)
    destination = build_primary_backend(settings)

    logger.info(
        "starting storage migration",
        category=category,
        prefix=prefix,
        backend=settings.storage_backend,
        dry_run=dry_run,
    )

    report = await migrate_category(source, destination, prefix, dry_run=dry_run)

    if dry_run:
        return

    verification = await verify_category(source, destination, prefix)

    if verification.ok:
        logger.info(
            "verification passed",
            category=category,
            source_count=verification.source_count,
            destination_count=verification.destination_count,
            copied=report.copied,
            skipped=report.skipped,
            bytes_copied=report.bytes_copied,
        )
        return

    logger.error(
        "verification failed",
        category=category,
        source_count=verification.source_count,
        destination_count=verification.destination_count,
        missing_count=len(verification.missing_keys),
        size_mismatch_count=len(verification.size_mismatches),
        missing_keys_sample=verification.missing_keys[:FAILURE_LOG_SAMPLE],
        size_mismatches_sample=verification.size_mismatches[:FAILURE_LOG_SAMPLE],
    )
    raise SystemExit(1)
