import aiohttp.test_utils
import pymongo
import pytest

import virtool.db.migrate
import virtool.db.utils


async def test_delete_unready(dbi):
    await dbi.analyses.insert_many([
        {
            "_id": 1,
            "ready": True
        },
        {
            "_id": 2,
            "ready": False
        }
    ])

    await virtool.db.utils.delete_unready(dbi.analyses)

    assert await dbi.analyses.find().to_list(None) == [
        {
            "_id": 1,
            "ready": True
        }
    ]


async def test_migrate_files(dbi):
    documents = [
        {"_id": 1},
        {"_id": 2},
        {"_id": 3, "reserved": False},
        {"_id": 4, "reserved": True}
    ]

    await dbi.files.insert_many(documents)

    await virtool.db.migrate.migrate_files(dbi)

    async for document in dbi.files.find():
        assert document["reserved"] is False


async def test_migrate_groups(dbi):
    await dbi.groups.insert_many([
        {
            "_id": "foobar",
            "permissions": {
                "hello_world": True,
                "create_sample": True
            },
            "_version": 3
        }
    ])

    await virtool.db.migrate.migrate_groups(dbi)

    documents = await dbi.groups.find().to_list(None)

    assert documents == [{
        "_id": "foobar",
        "permissions": {
            "cancel_job": False,
            "create_ref": False,
            "create_sample": True,
            "modify_hmm": False,
            "modify_subtraction": False,
            "remove_file": False,
            "remove_job": False,
            "upload_file": False
        }
    }]


@pytest.mark.parametrize("has_software", [True, False])
@pytest.mark.parametrize("has_software_update", [True, False])
@pytest.mark.parametrize("has_version", [True, False])
async def test_migrate_status(has_software, has_software_update, has_version, mocker, snapshot, dbi):
    if has_software:
        await dbi.status.insert_one({
            "_id": "software",
            "version": "v2.2.2"
        })

    if has_software_update:
        await dbi.status.insert_one({"_id": "software_update"})

    if has_version:
        await dbi.status.insert_one({"_id": "version"})

    mocker.patch("virtool.db.utils.determine_mongo_version", aiohttp.test_utils.make_mocked_coro("3.6.3"))

    await virtool.db.migrate.migrate_status(dbi, "v3.0.0")

    status = await dbi.status.find({}, sort=[("_id", pymongo.ASCENDING)]).to_list(None)

    snapshot.assert_match(status)
