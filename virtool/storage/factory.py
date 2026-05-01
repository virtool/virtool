"""Factory for constructing the configured storage backend."""

from virtool.config.cls import ServerConfig
from virtool.storage.filesystem import FilesystemProvider
from virtool.storage.object import ObjectProvider
from virtool.storage.protocol import StorageBackend
from virtool.storage.routing import FallbackStorageRouter


def create_storage_backend(
    config: ServerConfig,
    *,
    with_fallback: bool = True,
) -> StorageBackend:
    """Create the configured storage backend.

    The primary backend is determined by ``config.storage_backend``. When
    ``with_fallback`` is true (the default) a non-filesystem primary is wrapped
    in a :class:`FallbackStorageRouter` whose fallback is a
    :class:`FilesystemProvider` rooted at ``config.storage_filesystem_path``.

    Pass ``with_fallback=False`` to obtain the bare primary — useful for tests
    that need to drive the remote backend directly.
    """
    primary = _create_primary_backend(config)

    if config.storage_backend == "filesystem" or not with_fallback:
        return primary

    config.storage_filesystem_path.mkdir(parents=True, exist_ok=True)
    fallback = FilesystemProvider(config.storage_filesystem_path)

    return FallbackStorageRouter(primary, fallback)


def _create_primary_backend(config: ServerConfig) -> StorageBackend:
    match config.storage_backend:
        case "filesystem":
            config.storage_filesystem_path.mkdir(parents=True, exist_ok=True)
            return FilesystemProvider(config.storage_filesystem_path)

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
