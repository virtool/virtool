import pymongo
import pytest
from aiohttp.test_utils import make_mocked_coro

import virtool.db.migrate
import virtool.db.utils
import virtool.groups.migrate


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

    mocker.patch("virtool.db.mongo.get_mongo_version", make_mocked_coro("3.6.3"))

    app = {
        "db": dbi,
        "version": "v3.0.0"
    }

    await virtool.db.migrate.migrate_status(app)

    status = await dbi.status.find({}, sort=[("_id", pymongo.ASCENDING)]).to_list(None)

    snapshot.assert_match(status)


async def test_migrate_subtractions_list(dbi):
    await dbi.samples.insert_many([
        {
            "_id": "foo",
            "subtraction": {
                "id": "prunus"
            }
        },
        {
            "_id": "bar",
            "subtraction": {
                "id": "malus"
            }
        },
        {
            "_id": "baz",
            "subtraction": None
        }
    ])

    await virtool.db.migrate.migrate_subtractions_list(dbi.samples)

    assert await dbi.samples.find().to_list(None) == [
        {
            "_id": "foo",
            "subtractions": ["prunus"]
        },
        {
            "_id": "bar",
            "subtractions": ["malus"]
        },
        {
            "_id": "baz",
            "subtractions": []
        }
    ]
