import json
import os

import pytest
from aiohttp.test_utils import make_mocked_coro

import virtool.analyses.db
import virtool.analyses.format
from virtool.analyses.db import BLAST
from virtool.analyses.utils import join_analysis_json_path, join_analysis_path


@pytest.fixture
async def blast(dbi, static_time, tmpdir):
    await dbi.samples.insert_one({
        "_id": "sample"
    })

    await dbi.analyses.insert_many([
        {
            "_id": "foo",
            "results": [
                {"index": 2, "blast": "bar"},
                {"index": 5, "blast": "baz"},
                {"index": 12, "blast": "baz"},
            ],
            "sample": {
                "id": "sample"
            },
            "updated_at": static_time.datetime
        },
        {

            "_id": "bar",
            "results": [
                {"index": 3, "blast": "bar"},
                {"index": 9, "blast": "baz"},
            ],
            "sample": {
                "id": "sample"
            },
            "updated_at": static_time.datetime
        }
    ])

    settings = {
        "data_path": str(tmpdir)
    }

    return virtool.analyses.db.BLAST(
        dbi,
        settings,
        "foo",
        5,
        "ABC123"
    )


async def test_blast_sleep(mocker, dbi, blast: BLAST):
    """
    Test that calling the `sleep()` method calls `asyncio.sleep` and increments the `interval` attribute by 5.

    """
    m_sleep = mocker.patch("asyncio.sleep", make_mocked_coro())

    await blast.sleep()
    m_sleep.assert_called_with(3)
    assert blast.interval == 8

    await blast.sleep()
    m_sleep.assert_called_with(8)
    assert blast.interval == 13


@pytest.mark.parametrize("check", [True, False])
@pytest.mark.parametrize("error", [None, "Error"])
@pytest.mark.parametrize("ready", [None, True, False])
@pytest.mark.parametrize("result", [None, {"foo": "bar"}])
async def test_update(
        snapshot,
        check,
        ready,
        result,
        error,
        mocker,
        dbi,
        blast: BLAST,
        static_time
):
    m_check_rid = mocker.patch("virtool.bio.check_rid", make_mocked_coro(check))

    await blast.update(ready, result, error)

    if ready is None:
        m_check_rid.assert_called_with(blast.settings, blast.rid)
    else:
        assert not m_check_rid.called

    snapshot.assert_match(await dbi.analyses.find_one())


@pytest.mark.parametrize("workflow", [None, "foobar", "nuvs", "pathoscope"])
async def test_format_analysis(workflow, mocker):
    """
    Test that the correct formatting function is called based on the workflow field. Test that an exception is raised
    if the workflow field cannot be processed.

    """
    m_format_nuvs = make_mocked_coro({
        "is_nuvs": True,
        "is_pathoscope": False
    })

    m_format_pathoscope = make_mocked_coro({
        "is_nuvs": False,
        "is_pathoscope": True
    })

    mocker.patch("virtool.analyses.format.format_nuvs", new=m_format_nuvs)
    mocker.patch("virtool.analyses.format.format_pathoscope", new=m_format_pathoscope)

    document = dict()

    if workflow:
        document["workflow"] = workflow

    app = {
        "db": "db",
        "settings": "settings"
    }

    coroutine = virtool.analyses.format.format_analysis(app, document)

    if workflow is None or workflow == "foobar":
        with pytest.raises(ValueError) as excinfo:
            await coroutine

        assert "Could not determine analysis workflow" in str(excinfo.value)

        return

    assert await coroutine == {
        "is_nuvs": workflow == "nuvs",
        "is_pathoscope": workflow == "pathoscope"
    }

    if workflow == "nuvs":
        m_format_nuvs.assert_called_with(app, document)
        assert not m_format_pathoscope.called

    elif workflow == "pathoscope":
        m_format_pathoscope.assert_called_with(app, document)
        assert not m_format_nuvs.called


@pytest.mark.parametrize("has_file", [True, False])
async def test_update_nuvs_blast(blast: BLAST, has_file, snapshot, dbi, tmpdir):
    """
    Test that the correct BLAST result is updated.

    """
    if has_file:
        await dbi.analyses.update_one({"_id": "foo"}, {
            "$set": {
                "results": "file"
            }
        })

    analysis_path = join_analysis_path(str(tmpdir), "foo", "sample")
    os.makedirs(analysis_path, exist_ok=True)

    json_path = join_analysis_json_path(str(tmpdir), "foo", "sample")

    with open(json_path, "w") as f:
        json.dump([
            {"index": 2, "blast": "bar"},
            {"index": 5, "blast": "baz"},
            {"index": 12, "blast": "baz"},
        ], f)

    await virtool.analyses.db.update_nuvs_blast(
        dbi,
        blast.settings,
        blast.analysis_id,
        blast.sequence_index,
        blast.rid,
        None,
        blast.interval,
        True,
        {
            "updated": True
        }
    )

    snapshot.assert_match(await dbi.analyses.find().to_list(None))

    if has_file:
        with open(json_path, "r") as f:
            data = json.load(f)

        snapshot.assert_match(data)




@pytest.mark.parametrize("has_file", [True, False])
async def test_blast_remove(has_file, snapshot, blast, dbi, tmpdir):
    """
    Test that the correct BLAST result is removed.

    """
    if has_file:
        await dbi.analyses.update_one({"_id": "foo"}, {
            "$set": {
                "results": "file"
            }
        })

    analysis_path = join_analysis_path(str(tmpdir), "foo", "sample")
    os.makedirs(analysis_path, exist_ok=True)

    json_path = join_analysis_json_path(str(tmpdir), "foo", "sample")

    with open(json_path, "w") as f:
        json.dump([
            {"index": 2, "blast": "bar"},
            {"index": 5, "blast": "baz"},
            {"index": 12, "blast": "baz"},
        ], f)

    await blast.remove()

    snapshot.assert_match(await dbi.analyses.find().to_list(None))

    if has_file:
        with open(json_path, "r") as f:
            data = json.load(f)

        snapshot.assert_match(data)
