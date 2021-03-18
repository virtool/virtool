import pytest
from aiohttp.test_utils import make_mocked_coro

import virtool.caches.db
import virtool.utils


@pytest.fixture
def trim_parameters():
    return {
        "end_quality": "20",
        "mode": "pe",
        "max_error_rate": "0.1",
        "max_indel_rate": "0.03",
        "max_length": None,
        "mean_quality": "25",
        "min_length": "20"
    }


def test_calculate_cache_key(trim_parameters):
    hashed = virtool.caches.db.calculate_cache_key(trim_parameters)
    assert hashed == "68b60be51a667882d3aaa02a93259dd526e9c990"


@pytest.mark.parametrize("exists", [True, False])
@pytest.mark.parametrize("missing", [True, False])
@pytest.mark.parametrize("returned_hash", ["abc123", "foobar"])
async def test_find(exists, missing, returned_hash, mocker, dbi):
    parameters = {
        "a": 1,
        "b": "hello",
        "c": "world"
    }

    if exists:
        await dbi.caches.insert_one({
            "_id": "bar",
            "program": "skewer-0.2.2",
            "key": "abc123",
            "missing": missing,
            "sample": {
                "id": "foo"
            }
        })

    m_calculate_cache_key = mocker.patch("virtool.caches.db.calculate_cache_key", return_value=returned_hash)

    result = await virtool.caches.db.find(dbi, "foo", "skewer-0.2.2", parameters)

    m_calculate_cache_key.assert_called_with(parameters)

    if missing or not exists or returned_hash == "foobar":
        assert result is None
        return

    assert result == {
        "id": "bar",
        "program": "skewer-0.2.2",
        "key": "abc123",
        "missing": False,
        "sample": {
            "id": "foo"
        }
    }


@pytest.mark.parametrize("paired", [True, False], ids=["paired", "unpaired"])
async def test_create(paired, snapshot, dbi, static_time, test_random_alphanumeric, trim_parameters):
    """
    Test that the function works with default keyword arguments and when `paired` is either `True` or `False`.

    """
    cache = await virtool.caches.db.create(dbi, "foo", "aodp-abcdefgh", paired)

    snapshot.assert_match(cache, "return")
    snapshot.assert_match(await dbi.caches.find_one(), "db")


async def test_create_duplicate(snapshot, dbi, static_time, test_random_alphanumeric, trim_parameters):
    """
    Test that the function handles duplicate document ids smoothly. The function should retry with a new id.

    """
    await dbi.caches.insert_one({"_id": test_random_alphanumeric.next_choice[:8].lower()})

    cache = await virtool.caches.db.create(dbi, "foo", "aodp-abcdefgh", False)

    snapshot.assert_match(cache, "return")
    snapshot.assert_match(await dbi.caches.find_one({"_id": test_random_alphanumeric.last_choice}), "db")


@pytest.mark.parametrize("exists", [True, False])
async def test_get(exists, dbi):
    """
    Test that the function returns a cache document when it exists and returns `None` when it does not.

    """
    if exists:
        await dbi.caches.insert_one({"_id": "foo"})

    result = await virtool.caches.db.get(dbi, "foo")

    if exists:
        assert result == {"id": "foo"}
        return

    assert result is None


@pytest.mark.parametrize("exception", [False, True])
async def test_remove(exception, dbi):
    app = {
        "db": dbi,
        "run_in_thread": make_mocked_coro(raise_exception=FileNotFoundError) if exception else make_mocked_coro(),
        "settings": {
            "data_path": "/foo"
        }
    }

    await dbi.caches.insert_one({"_id": "baz"})

    await virtool.caches.db.remove(app, "baz")

    assert await dbi.caches.count_documents({}) == 0

    app["run_in_thread"].assert_called_with(
        virtool.utils.rm,
        "/foo/caches/baz",
        True
    )
