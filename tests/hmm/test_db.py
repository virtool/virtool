import json
from pathlib import Path

from aiohttp.test_utils import make_mocked_coro
from pytest_mock import MockerFixture

from virtool.hmm.db import (
    generate_annotations,
    get_hmms_referenced_in_db,
    get_hmms_referenced_in_files,
    get_referenced_hmm_ids,
)
from virtool.mongo.core import Mongo
from virtool.storage.memory import MemoryStorageProvider


async def test_get_hmms_referenced_in_files(example_path: Path, mongo: Mongo):
    storage = MemoryStorageProvider()

    data = (example_path / "nuvs_results.json").read_bytes()

    async def _data():
        yield data

    await storage.write("samples/foo/analysis/bar/results.json", _data())

    await mongo.analyses.insert_one(
        {"_id": "bar", "workflow": "nuvs", "sample": {"id": "foo"}, "results": "file"},
    )

    assert await get_hmms_referenced_in_files(mongo, storage) == {
        "rejiddnd",
        "dltwctfw",
        "wotaqhkz",
        "sjzcfozl",
        "dxzlorzz",
        "duofttge",
    }


async def test_get_hmms_referenced_in_db(mongo: Mongo):
    await mongo.analyses.insert_many(
        [
            {
                "_id": "foo",
                "workflow": "nuvs",
                "results": [
                    {"orfs": [{"hits": [{"hit": "a"}, {"hit": "b"}]}]},
                    {
                        "orfs": [
                            {"hits": [{"hit": "y"}, {"hit": "z"}]},
                            {"hits": [{"hit": "w"}]},
                        ],
                    },
                ],
            },
            {
                "_id": "bar",
                "workflow": "nuvs",
                "results": [
                    {"orfs": [{"hits": [{"hit": "d"}]}]},
                    {"orfs": [{"hits": [{"hit": "y"}, {"hit": "e"}]}]},
                ],
            },
        ],
        session=None,
    )

    assert await get_hmms_referenced_in_db(mongo) == {"a", "b", "y", "z", "w", "d", "e"}


async def test_get_referenced_hmm_ids(
    mocker: MockerFixture,
    mongo: Mongo,
):
    storage = MemoryStorageProvider()

    mocker.patch(
        "virtool.hmm.db.get_hmms_referenced_in_db",
        make_mocked_coro({"a", "b", "d", "f"}),
    )

    mocker.patch(
        "virtool.hmm.db.get_hmms_referenced_in_files",
        make_mocked_coro({"a", "e", "f"}),
    )

    assert await get_referenced_hmm_ids(mongo, storage) == [
        "a",
        "b",
        "d",
        "e",
        "f",
    ]


async def test_generate_annotations(mongo: Mongo):
    await mongo.hmm.insert_one({"_id": "foo"})
    await mongo.hmm.insert_one({"_id": "bar"})

    result = await generate_annotations(mongo)

    hmms = json.loads(result)

    ids = [document["id"] for document in hmms]

    assert "foo" in ids
    assert "bar" in ids
