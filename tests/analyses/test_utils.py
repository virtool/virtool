import pytest
from sqlalchemy.ext.asyncio import AsyncEngine
from syrupy import SnapshotAssertion

import virtool.analyses.files
import virtool.analyses.utils
from virtool.analyses.utils import analysis_file_key, analysis_result_key


@pytest.mark.parametrize("exists", [True, False])
async def test_attach_analysis_files(
    exists: bool,
    pg: AsyncEngine,
    snapshot: SnapshotAssertion,
):
    if exists:
        await virtool.analyses.files.create_analysis_file(
            pg,
            "foobar",
            "fasta",
            "reference-fa",
        )

    document = {"_id": "foobar", "ready": True}

    assert (
        await virtool.analyses.utils.attach_analysis_files(pg, "foobar", document)
        == snapshot
    )


def test_analysis_file_key():
    assert analysis_file_key("1-output.fasta") == "analyses/1-output.fasta"


def test_analysis_result_key():
    assert (
        analysis_result_key("abc123", "sample1")
        == "samples/sample1/analysis/abc123/results.json"
    )
