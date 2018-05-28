import pymongo
import pytest
from aiohttp.test_utils import make_mocked_coro

import virtool.organize

ORIGINAL_REFERENCE = {
    "id": "original"
}


async def test_add_original_reference(test_motor):
    await test_motor.foobar.insert_many([
        {
            "_id": "baz"
        },
        {
            "_id": "hello_world"
        }
    ])

    await virtool.organize.add_original_reference(test_motor.foobar)

    assert await test_motor.foobar.find().to_list(None) == [
        {
            "_id": "baz",
            "reference": ORIGINAL_REFERENCE
        },
        {
            "_id": "hello_world",
            "reference": ORIGINAL_REFERENCE
        }
    ]


async def test_delete_unready(test_motor):
    await test_motor.test.insert_many([
        {
            "_id": 1,
            "ready": True
        },
        {
            "_id": 2,
            "ready": False
        }
    ])

    await virtool.organize.delete_unready(test_motor.test)

    assert await test_motor.test.find().to_list(None) == [
        {
            "_id": 1,
            "ready": True
        }
    ]


async def test_organize_analyses(test_motor):
    """
    Test that documents with the ``ready`` field set to ``False`` are deleted from the collection. These documents
    are assumed to be associated with defunct analysis jobs.

    """
    await test_motor.analyses.insert_many([
        {
            "_id": 1,
            "ready": True
        },
        {
            "_id": 2,
            "ready": False
        },
        {
            "_id": 3,
            "ready": True
        },
        {
            "_id": 4,
            "ready": False
        }
    ])

    await virtool.organize.organize_analyses(test_motor)

    assert await test_motor.analyses.find().to_list(None) == [
        {
            "_id": 1,
            "ready": True,
            "reference": {
                "id": "original"
            }
        },
        {
            "_id": 3,
            "ready": True,
            "reference": {
                "id": "original"
            }
        }
    ]


async def test_organize_files(test_motor):
    documents = [
        {"_id": 1},
        {"_id": 2},
        {"_id": 3, "reserved": False},
        {"_id": 4, "reserved": True}
    ]

    await test_motor.files.insert_many(documents)

    await virtool.organize.organize_files(test_motor)

    async for document in test_motor.files.find():
        assert document["reserved"] is False


async def test_organize_groups(test_motor):

    await test_motor.groups.insert_many([
        {
            "_id": "administrator"
        },
        {
            "_id": "foobar",
            "permissions": {
                "hello_world": True,
                "create_sample": True
            }
        }
    ])

    await virtool.organize.organize_groups(test_motor)

    documents = await test_motor.groups.find().to_list(None)

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


async def test_organize_indexes(mocker):
    m_add_original_reference = mocker.patch("virtool.organize.add_original_reference", new=make_mocked_coro())
    m_db = mocker.Mock()

    await virtool.organize.organize_indexes(m_db)

    m_add_original_reference.assert_called_with(m_db.indexes)


@pytest.mark.parametrize("has_otu", [True, False])
@pytest.mark.parametrize("has_references", [True, False])
async def test_organize_references(has_references, has_otu, mocker, test_motor):
    if has_otu:
        await test_motor.otus.insert_one({
            "_id": "foobar"
        })

    if has_references:
        await test_motor.references.insert_one({
            "_id": "baz"
        })

    m = mocker.patch("virtool.db.references.create_original", new=make_mocked_coro())

    settings = {
        "default_source_types": [
            "culture",
            "strain"
        ]
    }

    await virtool.organize.organize_references(test_motor, settings)

    document = await test_motor.references.find_one()

    if has_otu and not has_references:
        assert document is None
        m.assert_called_with(test_motor, settings)

    else:
        assert not m.called

    if has_references:
        assert await test_motor.references.find_one() == {
            "_id": "baz"
        }


async def test_organize_sequences(test_motor, test_random_alphanumeric):

    await test_motor.sequences.insert_many([
        {
            "_id": "foo"
        },
        {
            "_id": "bar"
        },
        {
            "_id": "baz"
        }
    ])

    await virtool.organize.organize_sequences(test_motor)

    assert await test_motor.sequences.find().to_list(None) == [
        {
            "_id": test_random_alphanumeric.history[0],
            "accession": "foo",
            "reference": ORIGINAL_REFERENCE
        },
        {
            "_id": test_random_alphanumeric.history[1],
            "accession": "bar",
            "reference": ORIGINAL_REFERENCE
        },
        {
            "_id": test_random_alphanumeric.history[2],
            "accession": "baz",
            "reference": ORIGINAL_REFERENCE
        }
    ]


@pytest.mark.parametrize("collection_name", [None, "viruses", "kinds"])
async def test_organize_otus(collection_name, test_motor):
    if collection_name is not None:
        await test_motor[collection_name].insert_many([
            {
                "_id": 1
            },
            {
                "_id": 2
            }
        ])

    await virtool.organize.organize_otus(test_motor)

    results = await test_motor.otus.find().to_list(None)

    if collection_name:
        assert results == [
            {
                "_id": 1,
                "reference": ORIGINAL_REFERENCE
            },
            {
                "_id": 2,
                "reference": ORIGINAL_REFERENCE
            }
        ]
    else:
        assert results == []

    assert "viruses" not in await test_motor.collection_names()


@pytest.mark.parametrize("has_software", [True, False])
@pytest.mark.parametrize("has_software_update", [True, False])
@pytest.mark.parametrize("has_version", [True, False])
async def test_organize_status(has_software, has_software_update, has_version, test_motor):
    if has_software:
        await test_motor.status.insert_one({
            "_id": "software",
            "version": "v2.2.2"
        })

    if has_software_update:
        await test_motor.status.insert_one({"_id": "software_update"})

    if has_version:
        await test_motor.status.insert_one({"_id": "version"})

    await virtool.organize.organize_status(test_motor, "v3.0.0")

    assert await test_motor.status.find({}, sort=[("_id", pymongo.ASCENDING)]).to_list(None) == [
        {
            "_id": "hmm",
            "installed": False,
            "latest_release": None,
            "version": None
        },
        {
            "_id": "software",
            "process": None,
            "version": "v3.0.0"
        }
    ]


async def test_organize_subtraction(mocker):
    m_delete_unready = mocker.patch("virtool.organize.delete_unready", new=make_mocked_coro())

    m_db = mocker.Mock()

    await virtool.organize.organize_subtraction(m_db)

    assert m_delete_unready.call_args[0][0] == m_db.subtraction


async def test_organize_users(test_motor):
    documents = [
        {
            "_id": "foo",
            "groups": [
                "test"
            ]
        },
        {
            "_id": "bar",
            "groups": [
                "test",
                "administrator"
            ]
        }
    ]

    await test_motor.users.insert_many(documents)

    await virtool.organize.organize_users(test_motor)

    documents[1].update({
        "groups": ["test"],
        "administrator": True
    })

    assert await test_motor.users.find().to_list(None) == documents
