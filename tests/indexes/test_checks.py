import pytest

from virtool.data.errors import ResourceConflictError
from virtool.indexes.checks import (
    check_fasta_file_uploaded,
    check_index_files_uploaded,
)
from virtool.indexes.db import JOB_INDEX_FILE_NAMES


class TestCheckFastaFileUploaded:
    async def test_accepts_fasta_file(self):
        results = {"file1": "gz", "file2": "fasta"}

        assert await check_fasta_file_uploaded(results) is None

    async def test_raises_when_fasta_file_is_missing(self):
        results = {"file1": "gz", "file2": "fasta"}
        del results["file2"]

        with pytest.raises(ResourceConflictError) as err:
            await check_fasta_file_uploaded(results)

        assert "FASTA" in str(err.value)


class TestCheckIndexFilesUploaded:
    async def test_accepts_complete_index_files(self):
        results = {
            file: JOB_INDEX_FILE_NAMES.index(file) for file in JOB_INDEX_FILE_NAMES
        }

        assert await check_index_files_uploaded(results) is None

    async def test_raises_when_bowtie_files_are_missing(self):
        results = {
            file: JOB_INDEX_FILE_NAMES.index(file) for file in JOB_INDEX_FILE_NAMES
        }
        del results["reference.2.bt2"]
        del results["reference.3.bt2"]

        with pytest.raises(ResourceConflictError) as err:
            await check_index_files_uploaded(results)

        assert "reference.2.bt2" in str(err.value)
        assert "reference.3.bt2" in str(err.value)
