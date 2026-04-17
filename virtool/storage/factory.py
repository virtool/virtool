"""Factory for constructing the configured storage backend."""

from virtool.config.cls import ServerConfig
from virtool.storage.filesystem import FilesystemProvider
from virtool.storage.protocol import StorageBackend


def create_storage_backend(config: ServerConfig) -> StorageBackend:
    """Create the storage backend selected by ``config``."""
    match config.storage_backend:
        case "filesystem":
            config.storage_filesystem_path.mkdir(parents=True, exist_ok=True)
            return FilesystemProvider(config.storage_filesystem_path)

        case "s3":
            from obstore.store import S3Store

            from virtool.storage.obstore import ObstoreProvider

            kwargs = {}
            if config.storage_s3_region:
                kwargs["region"] = config.storage_s3_region
            if config.storage_s3_endpoint:
                kwargs["endpoint"] = config.storage_s3_endpoint
            if config.storage_s3_access_key_id:
                kwargs["access_key_id"] = config.storage_s3_access_key_id
            if config.storage_s3_secret_access_key:
                kwargs["secret_access_key"] = config.storage_s3_secret_access_key

            return ObstoreProvider(S3Store(config.storage_s3_bucket, **kwargs))

        case "azure":
            from obstore.store import AzureStore

            from virtool.storage.obstore import ObstoreProvider

            kwargs = {"account": config.storage_azure_account}
            if config.storage_azure_access_key:
                kwargs["access_key"] = config.storage_azure_access_key

            return ObstoreProvider(
                AzureStore(config.storage_azure_container, **kwargs),
            )

        case _:
            raise ValueError(
                f"Unknown storage_backend: {config.storage_backend}",
            )
