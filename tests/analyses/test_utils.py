from pathlib import Path

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine
from syrupy import SnapshotAssertion

import virtool.analyses.files
import virtool.analyses.utils


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


@pytest.mark.parametrize("name", ["nuvs", "pathoscope"])
def test_get_json_path(name: str):
    """Test that the function can correctly extrapolate the path to a nuvs.json file given the `data_path`, `sample_id`,
    and `analysis_id` arguments.

    """
    path = virtool.analyses.utils.join_analysis_json_path(Path("data"), "bar", "foo")

    assert path == Path("data/samples/foo/analysis/bar/results.json")
