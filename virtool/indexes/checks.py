from virtool.data.errors import ResourceConflictError
from virtool.indexes.db import LEGACY_INDEX_FILE_NAMES, TASK_INDEX_FILE_NAMES


async def check_legacy_index_files_uploaded(results: dict, data_type: str) -> None:
    if data_type == "genome":
        required_files = [
            file_name
            for file_name in LEGACY_INDEX_FILE_NAMES
            if file_name != "reference.json.gz"
        ]
    else:
        required_files = ["reference.fa.gz"]

    missing_files = [
        file_name for file_name in required_files if file_name not in results
    ]

    if missing_files:
        raise ResourceConflictError(
            "Job-backed index builds require all legacy index files. "
            f"missing files: {', '.join(missing_files)}"
        )


async def check_task_index_files_uploaded(results: dict) -> None:
    missing_files = [
        file_name for file_name in TASK_INDEX_FILE_NAMES if file_name not in results
    ]
    unexpected_files = [
        file_name for file_name in results if file_name not in TASK_INDEX_FILE_NAMES
    ]

    if missing_files or unexpected_files:
        details = []

        if missing_files:
            details.append(f"missing files: {', '.join(missing_files)}")

        if unexpected_files:
            details.append(f"unexpected files: {', '.join(unexpected_files)}")

        raise ResourceConflictError(
            "Task-backed index builds require exactly the task index files. "
            + "; ".join(details)
        )
