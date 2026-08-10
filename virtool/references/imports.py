"""Load uploaded reference artifacts."""

import json
from pathlib import Path

import aiofiles
from structlog import get_logger

from virtool.references.sqlite import (
    REFERENCE_SQLITE_FILE_NAME,
    SQLiteReference,
    SQLiteReferenceReadError,
)
from virtool.references.utils import load_reference_from_storage
from virtool.storage.protocol import StorageBackend
from virtool.tasks.progress import AbstractProgressHandler

logger = get_logger("references.imports")


async def load_json_import(
    storage: StorageBackend,
    key: str,
    progress_handler: AbstractProgressHandler,
) -> dict | None:
    """Load an uploaded gzip-compressed JSON reference."""
    try:
        return await load_reference_from_storage(storage, key)
    except json.decoder.JSONDecodeError as err:
        await progress_handler.set_error(str(err))
    except (OSError, EOFError) as err:
        if "Not a gzipped file" in str(err):
            await progress_handler.set_error("Not a gzipped file")
        else:
            await progress_handler.set_error(str(err))

    return None


async def load_sqlite_import(
    storage: StorageBackend,
    key: str,
    temp_path: Path,
    progress_handler: AbstractProgressHandler,
    ref_id: int,
) -> dict | None:
    """Load an uploaded SQLite reference."""
    sqlite_path = temp_path / REFERENCE_SQLITE_FILE_NAME

    try:
        async with aiofiles.open(sqlite_path, "wb") as handle:
            async for chunk in storage.read(key):
                await handle.write(chunk)

        sqlite_reference = SQLiteReference.load(sqlite_path)
        await sqlite_reference.validate()
        reference = await sqlite_reference.get_metadata()
        otus = [otu async for otu in sqlite_reference.iter_otus()]
    except SQLiteReferenceReadError:
        logger.exception(
            "could not read SQLite reference database",
            ref_id=ref_id,
        )
        await progress_handler.set_error(
            "Invalid SQLite reference file: could not read the database"
        )
        return None
    except OSError:
        logger.exception(
            "could not read uploaded SQLite reference file",
            ref_id=ref_id,
        )
        await progress_handler.set_error(
            "Could not read uploaded SQLite reference file"
        )
        return None
    except ValueError as err:
        await progress_handler.set_error(f"Invalid SQLite reference file: {err}")
        return None

    return {**reference, "otus": otus}
