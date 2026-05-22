"""Environment-variable configuration for the storage migration CLI.

Designed to be populated from Kubernetes ``Secret`` / ``ConfigMap`` env vars
when ``virtool migration storage`` runs as a ``Job``. Uses Pydantic v1
``BaseSettings`` because the project is pinned to Pydantic v1; this is the
same API ``pydantic-settings`` was extracted from at the v1 → v2 split.
"""

from pathlib import Path

from pydantic import BaseSettings, root_validator

from virtool.config.cls import StorageBackendName, _validate_s3_credentials


class StorageMigrationSettings(BaseSettings):
    """Storage and data-path configuration loaded from ``VT_*`` env vars."""

    data_path: Path
    storage_backend: StorageBackendName

    storage_s3_bucket: str = ""
    storage_s3_region: str = ""
    storage_s3_endpoint: str = ""
    storage_s3_access_key_id: str = ""
    storage_s3_secret_access_key: str = ""

    storage_azure_account: str = ""
    storage_azure_container: str = ""
    storage_azure_access_key: str = ""
    storage_azure_endpoint: str = ""

    class Config:
        env_prefix = "VT_"
        case_sensitive = False

    @root_validator
    def _validate(cls, values: dict) -> dict:
        backend = values.get("storage_backend")

        if backend == "s3":
            if not values.get("storage_s3_bucket"):
                raise ValueError(
                    "storage_backend=s3 requires VT_STORAGE_S3_BUCKET",
                )
            _validate_s3_credentials(
                values.get("storage_s3_access_key_id", ""),
                values.get("storage_s3_secret_access_key", ""),
            )

        if backend == "azure":
            if not values.get("storage_azure_account"):
                raise ValueError(
                    "storage_backend=azure requires VT_STORAGE_AZURE_ACCOUNT",
                )
            if not values.get("storage_azure_container"):
                raise ValueError(
                    "storage_backend=azure requires VT_STORAGE_AZURE_CONTAINER",
                )

        return values
