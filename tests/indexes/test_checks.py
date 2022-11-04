import pytest

from virtool.data.errors import ResourceConflictError
from virtool.indexes.checks import check_fasta_file_uploaded, check_index_files_uploaded
from virtool.indexes.db import FILES


@pytest.mark.parametrize("error", [None, 409])
async def test_check_fasta_file_uploaded(error):

    results = {"file1": "gz", "file2": "fasta"}

    if error == 409:
        del results["file2"]
        with pytest.raises(ResourceConflictError) as err:
            await check_fasta_file_uploaded(results)
        assert "FASTA" in str(err)
        return

    assert await check_fasta_file_uploaded(results) is None


@pytest.mark.parametrize("error", [None, 409])
async def test_check_index_files_uploaded(error):

    results = {file: FILES.index(file) for file in FILES}

    if error == 409:
        del results["reference.2.bt2"]
        del results["reference.3.bt2"]
        with pytest.raises(ResourceConflictError) as err:
            await check_index_files_uploaded(results)
        assert "reference.2.bt2" in str(err) and "reference.3.bt2" in str(err)
        return

    assert await check_index_files_uploaded(results) is None
