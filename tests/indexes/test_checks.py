import pytest

from virtool.data.errors import ResourceConflictError
from virtool.indexes.checks import (
    check_legacy_index_files_uploaded,
    check_task_index_files_uploaded,
)
from virtool.indexes.db import LEGACY_INDEX_FILE_NAMES, TASK_INDEX_FILE_NAMES
from virtool.indexes.utils import check_index_file_type


@pytest.mark.parametrize("error", [None, 409])
async def test_check_legacy_index_files_uploaded(error):
    results = {file: check_index_file_type(file) for file in LEGACY_INDEX_FILE_NAMES}

    if error == 409:
        del results["reference.2.bt2"]
        del results["reference.3.bt2"]

        with pytest.raises(ResourceConflictError) as err:
            await check_legacy_index_files_uploaded(results, "genome")

        assert "reference.2.bt2" in str(err) and "reference.3.bt2" in str(err)
        return

    assert await check_legacy_index_files_uploaded(results, "genome") is None


async def test_check_legacy_index_files_uploaded_requires_fasta_for_all_data_types():
    results = {file: check_index_file_type(file) for file in LEGACY_INDEX_FILE_NAMES}
    del results["reference.fa.gz"]

    with pytest.raises(ResourceConflictError) as err:
        await check_legacy_index_files_uploaded(results, "barcode")

    assert "reference.fa.gz" in str(err)


async def test_check_legacy_index_files_uploaded_allows_missing_bowtie_files_for_barcode():
    results = {"reference.fa.gz": "fasta"}

    assert await check_legacy_index_files_uploaded(results, "barcode") is None


@pytest.mark.parametrize("error", [None, 409])
async def test_check_task_index_files_uploaded(error):
    results = {
        file: TASK_INDEX_FILE_NAMES.index(file) for file in TASK_INDEX_FILE_NAMES
    }

    if error == 409:
        results["reference.fa.gz"] = "fasta"

        with pytest.raises(ResourceConflictError) as err:
            await check_task_index_files_uploaded(results)

        assert "unexpected files: reference.fa.gz" in str(err)
        return

    assert await check_task_index_files_uploaded(results) is None
