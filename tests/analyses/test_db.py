import pytest
from aiohttp.test_utils import make_mocked_coro

import virtool.analyses.db
import virtool.analyses.format


@pytest.mark.parametrize("workflow", [None, "foobar", "nuvs", "pathoscope"])
async def test_format_analysis(workflow, mocker):
    """
    Ensure that:
    * the correct formatting function is called based on the workflow field.
    * an exception is raised if the workflow field cannot be processed.

    """
    m_format_nuvs = make_mocked_coro({"is_nuvs": True, "is_pathoscope": False})

    m_format_pathoscope = make_mocked_coro({"is_nuvs": False, "is_pathoscope": True})

    mocker.patch("virtool.analyses.format.format_nuvs", new=m_format_nuvs)
    mocker.patch("virtool.analyses.format.format_pathoscope", new=m_format_pathoscope)

    document = dict()

    if workflow:
        document["workflow"] = workflow

    app = {"db": "db", "settings": "settings"}

    coroutine = virtool.analyses.format.format_analysis(app, document)

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
        m_format_nuvs.assert_called_with(app, document)
        assert not m_format_pathoscope.called

    elif workflow == "pathoscope":
        m_format_pathoscope.assert_called_with(app, document)
        assert not m_format_nuvs.called


@pytest.mark.parametrize("analysis_id", [None, "test_analysis"])
async def test_create(
    analysis_id, snapshot, dbi, static_time, test_random_alphanumeric
):
    subtractions = ["subtraction_1", "subtraction_2"]

    await dbi.indexes.insert_one(
        {
            "_id": "test_index",
            "version": 11,
            "ready": True,
            "reference": {"id": "test_ref"},
        }
    )

    document = await virtool.analyses.db.create(
        dbi,
        "test_sample",
        "test_ref",
        subtractions,
        "test_user",
        "nuvs",
        "test_job",
        analysis_id=analysis_id,
    )

    assert document == snapshot
    assert await dbi.analyses.find_one() == snapshot
