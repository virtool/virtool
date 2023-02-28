import pytest
from aiohttp.test_utils import make_mocked_coro

import virtool.analyses.db
import virtool.analyses.format


@pytest.mark.parametrize("workflow", [None, "foobar", "nuvs", "pathoscope"])
async def test_format_analysis(workflow, config, mongo, mocker):
    """
    Ensure that:
    * the correct formatting function is called based on the workflow field.
    * an exception is raised if the workflow field cannot be processed.

    """
    m_format_nuvs = make_mocked_coro({"is_nuvs": True, "is_pathoscope": False})

    m_format_pathoscope = make_mocked_coro({"is_nuvs": False, "is_pathoscope": True})

    mocker.patch("virtool.analyses.format.format_nuvs", new=m_format_nuvs)
    mocker.patch("virtool.analyses.format.format_pathoscope", new=m_format_pathoscope)

    document = {}

    if workflow:
        document["workflow"] = workflow

    coroutine = virtool.analyses.format.format_analysis(config, mongo, document)

    if workflow is None or workflow == "foobar":
        with pytest.raises(ValueError) as excinfo:
            await coroutine

        assert "Could not determine analysis workflow" in str(excinfo.value)

        return

    assert await coroutine == {
        "is_nuvs": workflow == "nuvs",
        "is_pathoscope": workflow == "pathoscope",
    }

    if workflow == "nuvs":
        m_format_nuvs.assert_called_with(config, mongo, document)
        assert not m_format_pathoscope.called

    elif workflow == "pathoscope":
        m_format_pathoscope.assert_called_with(config, mongo, document)
        assert not m_format_nuvs.called


@pytest.mark.parametrize("analysis_id", [None, "test_analysis"])
async def test_create(
    analysis_id, snapshot, mongo, static_time, test_random_alphanumeric
):
    subtractions = ["subtraction_1", "subtraction_2"]

    await mongo.indexes.insert_one(
        {
            "_id": "test_index",
            "version": 11,
            "ready": True,
            "reference": {"id": "test_ref"},
        }
    )

    document = await virtool.analyses.db.create(
        mongo,
        "test_sample",
        "test_ref",
        subtractions,
        "test_user",
        "nuvs",
        "test_job",
        0,
        analysis_id=analysis_id,
    )

    assert document == snapshot
    assert await mongo.analyses.find_one() == snapshot
