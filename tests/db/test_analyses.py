import pytest
from aiohttp.test_utils import make_mocked_coro

import virtool.db.analyses


@pytest.mark.parametrize("algorithm", [None, "foobar", "nuvs", "pathoscope"])
async def test_format_analysis(algorithm, mocker):
    """
    Test that the correct formatting function is called based on the algorithm field. Test that an exception is raised
    if the algorithm field cannot be processed.

    """
    m_format_nuvs = make_mocked_coro({
        "is_nuvs": True,
        "is_pathoscope": False
    })

    m_format_pathoscope = make_mocked_coro({
        "is_nuvs": False,
        "is_pathoscope": True
    })

    mocker.patch("virtool.db.analyses.format_nuvs", new=m_format_nuvs)
    mocker.patch("virtool.db.analyses.format_pathoscope", new=m_format_pathoscope)

    document = dict()

    if algorithm:
        document["algorithm"] = algorithm

    coroutine = virtool.db.analyses.format_analysis("db", "settings", document)

    if algorithm is None or algorithm == "foobar":
        with pytest.raises(ValueError) as excinfo:
            await coroutine

        assert "Could not determine analysis algorithm" in str(excinfo.value)

        return

    assert await coroutine == {
        "is_nuvs": algorithm == "nuvs",
        "is_pathoscope": algorithm == "pathoscope"
    }

    if algorithm == "nuvs":
        m_format_nuvs.assert_called_with("db", "settings", document)
        assert not m_format_pathoscope.called

    elif algorithm == "pathoscope":
        m_format_pathoscope.assert_called_with("db", "settings", document)
        assert not m_format_nuvs.called
