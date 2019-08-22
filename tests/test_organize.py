import pymongo
import pytest
from aiohttp.test_utils import make_mocked_coro

import virtool.db.migrate


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

    await virtool.db.migrate.delete_unready(dbi.analyses)

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
async def test_migrate_status(has_software, has_software_update, has_version, dbi):
    if has_software:
        await dbi.status.insert_one({
            "_id": "software",
            "version": "v2.2.2"
        })

    if has_software_update:
        await dbi.status.insert_one({"_id": "software_update"})

    if has_version:
        await dbi.status.insert_one({"_id": "version"})

    await virtool.db.migrate.migrate_status(dbi, "v3.0.0")

    expected_software = {
        "_id": "software",
        "process": None,
        "updating": False,
        "version": "v3.0.0"
    }

    if not has_software:
        expected_software.update({
            "installed": None,
            "releases": list()
        })

    assert await dbi.status.find({}, sort=[("_id", pymongo.ASCENDING)]).to_list(None) == [
        {
            "_id": "hmm",
            "installed": None,
            "process": None,
            "release": None,
            "updates": list()
        },
        expected_software
    ]


async def test_migrate_subtraction(mocker):
    m_delete_unready = mocker.patch("virtool.db.migrate.delete_unready", new=make_mocked_coro())

    m_db = mocker.Mock()

    await virtool.db.migrate.migrate_subtraction(m_db)

    assert m_delete_unready.call_args[0][0] == m_db.subtraction
