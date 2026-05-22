"""Factory for constructing the configured storage backend."""

from virtool.config.cls import ServerConfig
from virtool.storage.filesystem import FilesystemProvider
from virtool.storage.legacy import LegacyIndexFilesystemAdapter
from virtool.storage.object import ObjectProvider
from virtool.storage.protocol import StorageBackend
from virtool.storage.routing import FallbackStorageRouter


def create_storage_backend(config: ServerConfig) -> StorageBackend:
    """Create the configured storage backend.

    The primary is an object-storage backend (S3 or Azure Blob) determined by
    ``config.storage_backend``. A :class:`FilesystemProvider` rooted at
    ``config.data_path`` is wired in as a read/migration fallback via
    :class:`FallbackStorageRouter`, wrapped in
    :class:`LegacyIndexFilesystemAdapter` so legacy index files at
    ``references/{ref_id}/{index_id}/...`` are reachable via the new
    ``indexes/{index_id}/...`` keys.

    The fallback exists only to surface legacy on-disk files during the
    migration to object storage and will be removed entirely once that
    migration is complete.
    """
    primary = build_primary_backend(config)
    fallback = LegacyIndexFilesystemAdapter(
        FilesystemProvider(config.data_path), config.data_path
    )
    return FallbackStorageRouter(primary, fallback)


def build_primary_backend(config: ServerConfig) -> StorageBackend:
    """Build the object-storage primary backend.

    Exposed for tests that need to drive the remote backend directly without
    the filesystem fallback wrapper.
    """
    match config.storage_backend:
        case "s3":
            return ObjectProvider.for_s3(
                config.storage_s3_bucket,
                region=config.storage_s3_region or None,
                endpoint=config.storage_s3_endpoint or None,
                access_key_id=config.storage_s3_access_key_id or None,
                secret_access_key=config.storage_s3_secret_access_key or None,
            )

        case "azure":
            return ObjectProvider.for_azure(
                config.storage_azure_container,
                account=config.storage_azure_account,
                access_key=config.storage_azure_access_key or None,
                endpoint=config.storage_azure_endpoint or None,
            )

        case _:
            raise ValueError(
                f"Unknown storage_backend: {config.storage_backend}",
            )
