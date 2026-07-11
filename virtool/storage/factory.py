"""Factory for constructing the configured storage backend."""

from typing import Protocol

from virtool.config.cls import StorageBackendName
from virtool.storage.object import ObjectProvider
from virtool.storage.protocol import StorageBackend


class StorageBackendConfig(Protocol):
    """Structural type for the ``storage_*`` fields ``create_storage_backend`` reads.

    ``ServerConfig``, ``TaskRunnerConfig``, and ``MigrationConfig`` all satisfy
    this without explicit inheritance.
    """

    storage_backend: StorageBackendName
    storage_s3_bucket: str
    storage_s3_region: str
    storage_s3_endpoint: str
    storage_s3_access_key_id: str
    storage_s3_secret_access_key: str
    storage_azure_account: str
    storage_azure_container: str
    storage_azure_access_key: str
    storage_azure_endpoint: str


def create_storage_backend(config: StorageBackendConfig) -> StorageBackend:
    """Create the configured object-storage backend (S3 or Azure Blob).

    The backend is selected by ``config.storage_backend``.
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
