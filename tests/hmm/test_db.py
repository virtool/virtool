import json
import shutil
from pathlib import Path

import pymongo.results
import pytest
from aiohttp.test_utils import make_mocked_coro

import virtool.hmm.db
import virtool.utils

JSON_RESULT_PATH = Path.cwd() / "tests" / "test_files" / "nuvs" / "results.json"


async def test_get_hmms_referenced_in_files(dbi, mocker, tmp_path):
    path = tmp_path / "samples" / "foo" / "analysis" / "bar"
    path.mkdir(parents=True)

    path = path / "results.json"
    shutil.copy(JSON_RESULT_PATH, path)

    m_join = mocker.patch("virtool.analyses.utils.join_analysis_json_path", return_value=path)

    settings = {
        "data_path": tmp_path
    }

    await dbi.analyses.insert_one({
        "_id": "bar",
        "workflow": "nuvs",
        "sample": {
            "id": "foo"
        },
        "results": "file"
    })

    result = await virtool.hmm.db.get_hmms_referenced_in_files(dbi, settings)

    m_join.assert_called_with(
        settings["data_path"],
        "bar",
        "foo"
    )

    assert result == {"rejiddnd", "dltwctfw", "wotaqhkz", "sjzcfozl", "dxzlorzz", "duofttge"}


async def test_get_hmms_referenced_in_db(dbi):
    results = await virtool.hmm.db.get_hmms_referenced_in_db(dbi)

    await dbi.analyses.insert_many([
        {
            "_id": "foo",
            "workflow": "nuvs",
            "results": [
                {
                    "orfs": [
                        {
                            "hits": [
                                {"hit": "a"},
                                {"hit": "b"}
                            ]
                        }
                    ]
                },
                {
                    "orfs": [
                        {
                            "hits": [
                                {"hit": "y"},
                                {"hit": "z"}
                            ]
                        },
                        {
                            "hits": [
                                {"hit": "w"}
                            ]
                        }
                    ]
                }
            ]
        },
        {
            "_id": "bar",
            "workflow": "nuvs",
            "results": [
                {
                    "orfs": [
                        {
                            "hits": [
                                {"hit": "d"}
                            ]
                        }
                    ]
                },
                {
                    "orfs": [
                        {
                            "hits": [
                                {"hit": "y"},
                                {"hit": "e"}
                            ]
                        }
                    ]
                }
            ]
        }
    ])

    results = await virtool.hmm.db.get_hmms_referenced_in_db(dbi)

    assert results == {"a", "b", "y", "z", "w", "d", "e"}


async def test_delete_unreferenced_hmms(mocker, dbi, tmp_path):
    mocker.patch(
        "virtool.hmm.db.get_hmms_referenced_in_db",
        make_mocked_coro({"a", "b", "d", "f"})
    )

    mocker.patch(
        "virtool.hmm.db.get_hmms_referenced_in_files",
        make_mocked_coro({"a", "e", "f"})
    )

    await dbi.hmm.insert_many([{"_id": hmm_id} for hmm_id in ["a", "b", "c", "d", "e", "f", "g"]])

    settings = {
        "data_path": tmp_path
    }

    result = await virtool.hmm.db.delete_unreferenced_hmms(dbi, settings)

    assert isinstance(result, pymongo.results.DeleteResult)
    assert result.deleted_count == 2

    assert await dbi.hmm.find().sort("_id").to_list(None) == [
        {"_id": "a"},
        {"_id": "b"},
        {"_id": "d"},
        {"_id": "e"},
        {"_id": "f"}
    ]


@pytest.mark.parametrize("updating", [True, False])
async def test_get_status(updating, dbi):
    """
    Test that function works when the HMM data are being updated and when they are not.

    """
    await dbi.status.insert_one({
        "_id": "hmm",
        "updates": [
            {"name": 2, "ready": False},
            {"name": 1, "ready": updating}
        ]
    })

    result = await virtool.hmm.db.get_status(dbi)

    assert result == {
        "id": "hmm",
        "updating": updating
    }


async def test_purge(mocker, dbi, tmp_path):
    """
    Test that the function calls `delete_unreferenced_hmms()` and hides all remaining HMM documents.

    """
    m_delete_unreferenced_hmms = mocker.patch("virtool.hmm.db.delete_unreferenced_hmms", make_mocked_coro())

    settings = {
        "data_path": tmp_path
    }

    await dbi.hmm.insert_many([
        {"_id": "foo"},
        {"_id": "bar"},
        {"_id": "baz"}
    ])

    await virtool.hmm.db.purge(dbi, settings)

    assert await dbi.hmm.find().sort("_id").to_list(None) == [
        {"_id": "bar", "hidden": True},
        {"_id": "baz", "hidden": True},
        {"_id": "foo", "hidden": True}
    ]


async def test_get_hmm_documents(dbi):
    await dbi.hmm.insert_one({"_id": "foo"})
    await dbi.hmm.insert_one({"_id": "bar"})

    documents = await virtool.hmm.db.get_hmm_documents(dbi)

    ids = [document["id"] for document in documents]

    assert "foo" in ids
    assert "bar" in ids


async def test_generate_annotations_json_file(dbi, tmp_path):
    await dbi.hmm.insert_one({"_id": "foo"})
    await dbi.hmm.insert_one({"_id": "bar"})

    path = await virtool.hmm.db.generate_annotations_json_file({
        "db": dbi,
        "settings": {"data_path": tmp_path},
    })

    assert path.exists()

    hmms = json.loads(path.read_text())

    ids = [document["id"] for document in hmms]

    assert "foo" in ids
    assert "bar" in ids
