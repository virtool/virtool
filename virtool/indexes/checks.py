from virtool.data.errors import ResourceConflictError
from virtool.indexes.sql import IndexType

GENOME_REQUIRED_INDEX_FILE_NAMES = (
    "reference.fa.gz",
    "reference.1.bt2",
    "reference.2.bt2",
    "reference.3.bt2",
    "reference.4.bt2",
    "reference.rev.1.bt2",
    "reference.rev.2.bt2",
)


async def check_fasta_file_uploaded(results: dict) -> None:
    if IndexType.fasta not in results.values():
        raise ResourceConflictError(
            "A FASTA file must be uploaded in order to finalize index"
        )


async def check_legacy_index_files_uploaded(results: dict) -> None:
    if missing_files := [
        file_name
        for file_name in GENOME_REQUIRED_INDEX_FILE_NAMES
        if file_name not in results
    ]:
        raise ResourceConflictError(
            f"Reference requires that all Bowtie2 index files have been uploaded. "
            f"Missing files: {', '.join(missing_files)}"
        )
