import json

import pytest
from pytest_mock import MockerFixture
from syrupy import SnapshotAssertion

import virtool.analyses
from virtool.analyses.format import load_results, transform_coverage_to_coordinates
from virtool.mongo.core import Mongo
from virtool.storage.memory import MemoryStorageProvider


@pytest.mark.parametrize("loadable", [True, False])
async def test_load_results(loadable: bool):
    """Test that results are loaded from a `results.json` as expected.

    Check that the file loading action is not pursued if the results are stored in the
    analysis document.
    """
    results = {"foo": "bar", "bar": "baz"}

    storage = MemoryStorageProvider()

    if loadable:

        async def _data():
            yield json.dumps(results).encode()

        await storage.write("samples/bar/analysis/foo/results.json", _data())

    result = await load_results(
        storage,
        {
            "_id": "foo",
            "results": "file" if loadable else {"baz": "foo"},
            "sample": {"id": "bar"},
        },
    )

    if loadable:
        assert result == {"_id": "foo", "results": results, "sample": {"id": "bar"}}
    else:
        assert result == {
            "_id": "foo",
            "results": {"baz": "foo"},
            "sample": {"id": "bar"},
        }


@pytest.mark.parametrize(
    "coverage",
    [
        [0, 0, 1, 1, 2, 3, 3, 3, 4, 4, 3, 2],
        [0, 0, 1, 1, 2, 3, 3, 3, 4, 4, 3, 2, 1, 1],
        [
            0,
            0,
            0,
            1,
            1,
            1,
            0,
            0,
            1,
            1,
            1,
            2,
            2,
            2,
            2,
            2,
            3,
            3,
            3,
            2,
            2,
            2,
            5,
            5,
            4,
            4,
            3,
            3,
            2,
            2,
            1,
            1,
            5,
            5,
            5,
            6,
            6,
            6,
            7,
            8,
            7,
            6,
            5,
            5,
            5,
            5,
            4,
            3,
            2,
            6,
            7,
            9,
            0,
            0,
            0,
            0,
            0,
            1,
            1,
            2,
            2,
            3,
            3,
            4,
            4,
            5,
            5,
            5,
            6,
            6,
            6,
            7,
            7,
            8,
            7,
            7,
            6,
            6,
            5,
            5,
            5,
            5,
            5,
            5,
            5,
            5,
            4,
            4,
            4,
            4,
            4,
            4,
            3,
            3,
            3,
            3,
            4,
            3,
            2,
            2,
            2,
            2,
            2,
            2,
            2,
            2,
            1,
            1,
            2,
            3,
            2,
            3,
        ],
    ],
)
def test_transform_coverage_to_coordinates(
    coverage: list[int], snapshot: SnapshotAssertion
):
    """Test that two sample coverage datasets are correctly converted to coordinates."""
    assert transform_coverage_to_coordinates(coverage) == snapshot


@pytest.mark.parametrize("workflow", [None, "foobar", "nuvs", "pathoscope"])
async def test_format_analysis(
    workflow: str | None, mocker: MockerFixture, mongo: Mongo
):
    """Ensure that:
    * the correct formatting function is called based on the workflow field.
    * an exception is raised if the workflow field cannot be processed.

    """
    m_format_nuvs = mocker.patch(
        "virtool.analyses.format.format_nuvs",
        return_value={"is_nuvs": True, "is_pathoscope": False},
    )

    m_format_pathoscope = mocker.patch(
        "virtool.analyses.format.format_pathoscope",
        return_value={"is_nuvs": False, "is_pathoscope": True},
    )

    storage = MemoryStorageProvider()
    document = {}

    if workflow:
        document["workflow"] = workflow

    coroutine = virtool.analyses.format.format_analysis(storage, mongo, document)

    if workflow is None or workflow == "foobar":
        with pytest.raises(ValueError) as err:
            await coroutine

        if workflow is None:
            assert "Analysis has no workflow field" in str(err)
        else:
            assert "Unknown workflow: foobar" in str(err)

    else:
        assert await coroutine == {
            "is_nuvs": workflow == "nuvs",
            "is_pathoscope": workflow == "pathoscope",
        }

        if workflow == "nuvs":
            m_format_nuvs.assert_called_with(storage, mongo, document)
            assert not m_format_pathoscope.called

        elif workflow == "pathoscope":
            m_format_pathoscope.assert_called_with(storage, mongo, document)
            assert not m_format_nuvs.called
