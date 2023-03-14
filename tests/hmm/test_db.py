import json
import shutil
from pathlib import Path

from aiohttp.test_utils import make_mocked_coro

from virtool.hmm.db import (
    generate_annotations_json_file,
    get_hmms_referenced_in_db,
    get_hmms_referenced_in_files,
    get_referenced_hmm_ids,
)

JSON_RESULT_PATH = Path.cwd() / "tests" / "test_files" / "nuvs" / "results.json"


async def test_get_hmms_referenced_in_files(mongo, tmp_path, config):
    path = tmp_path / "samples" / "foo" / "analysis" / "bar"
    path.mkdir(parents=True)

    shutil.copy(JSON_RESULT_PATH, path / "results.json")

    await mongo.analyses.insert_one(
        {"_id": "bar", "workflow": "nuvs", "sample": {"id": "foo"}, "results": "file"}
    )

    result = await get_hmms_referenced_in_files(mongo, config.data_path)

    assert result == {
        "rejiddnd",
        "dltwctfw",
        "wotaqhkz",
        "sjzcfozl",
        "dxzlorzz",
        "duofttge",
    }


async def test_get_hmms_referenced_in_db(mongo):
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
                        ]
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

    results = await get_hmms_referenced_in_db(mongo)

    assert results == {"a", "b", "y", "z", "w", "d", "e"}


async def test_get_referenced_hmm_ids(mocker, mongo, tmp_path, config):
    mocker.patch(
        "virtool.hmm.db.get_hmms_referenced_in_db",
        make_mocked_coro({"a", "b", "d", "f"}),
    )

    mocker.patch(
        "virtool.hmm.db.get_hmms_referenced_in_files", make_mocked_coro({"a", "e", "f"})
    )

    assert await get_referenced_hmm_ids(mongo, config.data_path) == [
        "a",
        "b",
        "d",
        "e",
        "f",
    ]


async def test_generate_annotations_json_file(mongo, tmp_path, config):
    await mongo.hmm.insert_one({"_id": "foo"})
    await mongo.hmm.insert_one({"_id": "bar"})

    path = await generate_annotations_json_file(config.data_path, mongo)

    assert path.exists()

    hmms = json.loads(path.read_text())

    ids = [document["id"] for document in hmms]

    assert "foo" in ids
    assert "bar" in ids
