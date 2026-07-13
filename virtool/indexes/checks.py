from virtool.data.errors import ResourceConflictError
from virtool.indexes.db import INDEX_FILE_NAMES
from virtool.indexes.sql import IndexType


async def check_fasta_file_uploaded(results: dict) -> None:
    if IndexType.fasta not in results.values():
        raise ResourceConflictError(
            "A FASTA file must be uploaded in order to finalize index"
        )


async def check_index_files_uploaded(results: dict) -> None:
    required_files = [f for f in INDEX_FILE_NAMES if f != "reference.json.gz"]

    if missing_files := [f for f in required_files if f not in results]:
        raise ResourceConflictError(
            f"Reference requires that all Bowtie2 index files have been uploaded. "
            f"Missing files: {', '.join(missing_files)}"
        )
