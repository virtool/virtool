from virtool.data.errors import ResourceConflictError

GENOME_REQUIRED_INDEX_FILE_NAMES = (
    "reference.fa.gz",
    "reference.1.bt2",
    "reference.2.bt2",
    "reference.3.bt2",
    "reference.4.bt2",
    "reference.rev.1.bt2",
    "reference.rev.2.bt2",
)


async def check_legacy_index_files_uploaded(results: dict, data_type: str) -> None:
    if data_type == "genome":
        required_files = GENOME_REQUIRED_INDEX_FILE_NAMES
    else:
        required_files = ("reference.fa.gz",)

    missing_files = [
        file_name for file_name in required_files if file_name not in results
    ]

    if missing_files:
        raise ResourceConflictError(
            "Job-backed index builds require all legacy index files. "
            f"missing files: {', '.join(missing_files)}"
        )
