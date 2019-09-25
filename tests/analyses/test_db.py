import pytest
from aiohttp.test_utils import make_mocked_coro

import virtool.analyses.db
import virtool.analyses.format


@pytest.fixture
def test_blast_obj(dbi):
    settings = {
        "data_path": "/mnt/data"
    }

    return virtool.analyses.db.BLAST(
        dbi,
        settings,
        "foo",
        5,
        "ABC123"
    )


class TestBLAST:

    def test_init(self, dbi, test_blast_obj):
        assert test_blast_obj.db == dbi
        assert test_blast_obj.settings == {"data_path": "/mnt/data"}
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
    async def test_update(self, check, ready, result, error, mocker, dbi, test_blast_obj, static_time):
        m_check_rid = mocker.patch("virtool.bio.check_rid", make_mocked_coro(check))

        document = {
            "_id": "foo",
            "results": [
                {"index": 2, "blast": "bar"},
                {"index": 5, "blast": "baz"},
                {"index": 12, "blast": "baz"}
            ]
        }

        await dbi.analyses.insert_one(document)
        await test_blast_obj.update(ready, result, error)

        if ready is None:
            m_check_rid.assert_called_with(test_blast_obj.settings, test_blast_obj.rid)
        else:
            assert not m_check_rid.called

        import pprint
        pprint.pprint(await dbi.analyses.find_one())

        document["results"][1]["blast"] = {
            "error": error,
            "interval": 3,
            "last_checked_at": static_time.datetime,
            "ready": ready,
            "result": result,
            "rid": "ABC123"
        }

        assert await dbi.analyses.find_one() == document


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

    mocker.patch("virtool.analyses.format.format_nuvs", new=m_format_nuvs)
    mocker.patch("virtool.analyses.format.format_pathoscope", new=m_format_pathoscope)

    document = dict()

    if algorithm:
        document["algorithm"] = algorithm

    coroutine = virtool.analyses.format.format_analysis("db", "settings", document)

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

    async def test_remove_nuvs_blast(dbi):
        """
        Test that the correct BLAST result is removed.

        """
        documents = [
            {
                "_id": "foo",
                "results": [
                    {"index": 2, "blast": "bar"},
                    {"index": 5, "blast": "baz"},
                ]
            },
            {

                "_id": "bar",
                "results": [
                    {"index": 3, "blast": "bar"},
                    {"index": 9, "blast": "baz"},
                ]
            }
        ]

        await dbi.analyses.insert_many(documents)

        await virtool.analyses.db.remove_nuvs_blast(
            dbi,
            "foo",
            5
        )

        documents[0]["results"][1]["blast"] = None

        assert await dbi.analyses.find().to_list(None) == documents
