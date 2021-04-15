import pytest

import virtool.indexes.utils
from virtool.indexes.models import IndexFile


@pytest.mark.parametrize("file_type", ["json", "fasta", "bowtie2"])
async def test_check_index_file_type(file_type):
    if file_type == "json":
        result = virtool.indexes.utils.check_index_file_type("reference.json.gz")
        assert result == "json"

    if file_type == "fasta":
        result = virtool.indexes.utils.check_index_file_type("reference.fa.gz")
        assert result == "fasta"

    if file_type == "bowtie2":
        result = virtool.indexes.utils.check_index_file_type("reference.1.bt2")
        assert result == "bowtie2"


@pytest.mark.parametrize("exits", [True, False])
async def test_check_file_exists(exits, pg, pg_session):
    index_file = IndexFile(id=1, name="reference.1.bt2", index="foo", type="bowtie2", size=1234567)

    if exits:
        async with pg_session as session:
            session.add(index_file)
            await session.commit()

    result = await virtool.indexes.utils.check_file_exists(pg, "reference.1.bt2", "foo")

    if exits:
        assert result.name == "reference.1.bt2"
    else:
        assert result is None
