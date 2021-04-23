import pytest
from aiohttp.test_utils import make_mocked_coro

import virtool.analyses.db
import virtool.analyses.format
import virtool.tasks.pg


@pytest.fixture
def test_blast_obj(dbi, tmp_path):
    settings = {
        "data_path": tmp_path
    }

    return virtool.analyses.db.BLAST(
        dbi,
        settings,
        "foo",
        5,
        "ABC123"
    )


class TestBLAST:

    def test_init(self, dbi, test_blast_obj, tmp_path):
        assert test_blast_obj.db == dbi
        assert test_blast_obj.settings == {"data_path": tmp_path}
        assert test_blast_obj.analysis_id == "foo"
        assert test_blast_obj.sequence_index == 5
        assert test_blast_obj.rid == "ABC123"
        assert test_blast_obj.error is None
        assert test_blast_obj.interval == 3
        assert test_blast_obj.ready is False
        assert test_blast_obj.result is None

    async def test_remove(self, mocker, dbi, test_blast_obj):
        """
        Test that the `remove()` method results in a call to `virtool.analyses.db.remove_nuvs_blast()` using the
        BLAST object attributes.

        """
        m_remove_nuvs_blast = mocker.patch("virtool.analyses.db.remove_nuvs_blast", make_mocked_coro())
        await test_blast_obj.remove()
        m_remove_nuvs_blast.assert_called_with(dbi, "foo", 5)

    async def test_sleep(self, mocker, dbi, test_blast_obj):
        """
        Test that calling the `sleep()` method calls `asyncio.sleep` and increments the `interval` attribute by 5.

        """
        m_sleep = mocker.patch("asyncio.sleep", make_mocked_coro())

        await test_blast_obj.sleep()
        m_sleep.assert_called_with(3)
        assert test_blast_obj.interval == 8

        await test_blast_obj.sleep()
        m_sleep.assert_called_with(8)
        assert test_blast_obj.interval == 13

    @pytest.mark.parametrize("check", [True, False])
    @pytest.mark.parametrize("error", [None, "Error"])
    @pytest.mark.parametrize("ready", [None, True, False])
    @pytest.mark.parametrize("result", [None, {"foo": "bar"}])
    async def test_update(self, snapshot, check, ready, result, error, mocker, dbi, test_blast_obj, static_time):
        m_check_rid = mocker.patch("virtool.bio.check_rid", make_mocked_coro(check))

        await dbi.analyses.insert_one({
            "_id": "foo",
            "results": [
                {"index": 2, "blast": "bar"},
                {"index": 5, "blast": "baz"},
                {"index": 12, "blast": "baz"}
            ],
            "updated_at": static_time.datetime
        })

        await test_blast_obj.update(ready, result, error)

        if ready is None:
            m_check_rid.assert_called_with(test_blast_obj.settings, test_blast_obj.rid)
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


async def test_remove_nuvs_blast(snapshot, dbi, static_time):
    """
    Test that the correct BLAST result is removed.

    """
    await dbi.analyses.insert_many([
        {
            "_id": "foo",
            "results": [
                {"index": 2, "blast": "bar"},
                {"index": 5, "blast": "baz"},
            ],
            "updated_at": static_time.datetime
        },
        {

            "_id": "bar",
            "results": [
                {"index": 3, "blast": "bar"},
                {"index": 9, "blast": "baz"},
            ],
            "updated_at": static_time.datetime
        }
    ])

    await virtool.analyses.db.remove_nuvs_blast(
        dbi,
        "foo",
        5
    )

    snapshot.assert_match(await dbi.analyses.find().to_list(None))


@pytest.mark.parametrize("analysis_id", [None, "test_analysis"])
async def test_create(analysis_id, dbi, static_time, test_random_alphanumeric):
    subtractions = ["subtraction_1", "subtraction_2"]

    await dbi.indexes.insert_one(
        {
            "_id": "test_index",
            "version": 11,
            "ready": True,
            "reference": {
                "id": "test_ref"
            }
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
        analysis_id=analysis_id
    )

    expected_analysis_id = test_random_alphanumeric.history[0] if analysis_id is None else "test_analysis"

    assert document == {
        "_id": expected_analysis_id,
        "ready": False,
        "created_at": static_time.datetime,
        "updated_at": static_time.datetime,
        "job": {
            "id": "test_job"
        },
        "files": [],
        "workflow": "nuvs",
        "sample": {
            "id": "test_sample"
        },
        "index": {
            "id": "test_index",
            "version": 11
        },
        "reference": {
            "id": "test_ref",
            "name": None
        },
        "subtractions": ["subtraction_1", "subtraction_2"],
        "user": {
            "id": "test_user"
        }
    }

