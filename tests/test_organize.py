import pymongo
import pytest
import aiohttp.test_utils

import virtool.organize

ORIGINAL_REF = {
    "id": "original"
}


async def test_add_original_ref(test_motor):
    await test_motor.foobar.insert_many([
        {
            "_id": "baz"
        },
        {
            "_id": "hello_world"
        }
    ])

    await virtool.organize.add_original_ref(test_motor.foobar)

    assert await test_motor.foobar.find().to_list(None) == [
        {
            "_id": "baz",
            "ref": ORIGINAL_REF
        },
        {
            "_id": "hello_world",
            "ref": ORIGINAL_REF
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
            "ref": {
                "id": "original"
            }
        },
        {
            "_id": 3,
            "ready": True,
            "ref": {
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
            "create_sample": True,
            "manage_users": False,
            "modify_hmm": False,
            "modify_settings": False,
            "modify_subtraction": False,
            "modify_virus": False,
            "build_index": False,
            "remove_file": False,
            "remove_job": False,
            "remove_virus": False,
            "upload_file": False
        }
    }]


@pytest.mark.parametrize("collection_name,func", [
    ("history", virtool.organize.organize_history),
    ("indexes", virtool.organize.organize_indexes)
], ids=["history", "indexes"])
async def test_organize_history_and_indexes(collection_name, func, mocker):
    m_add_original_ref = mocker.patch("virtool.organize.add_original_ref", new=aiohttp.test_utils.make_mocked_coro())

    m_db = mocker.Mock()

    await func(m_db)

    m_add_original_ref.assert_called_with(getattr(m_db, collection_name))


@pytest.mark.parametrize("has_species", [True, False])
@pytest.mark.parametrize("has_references", [True, False])
async def test_organize_references(has_references, has_species, mocker, test_motor):
    if has_species:
        await test_motor.species.insert_one({
            "_id": "foobar"
        })

    if has_references:
        await test_motor.references.insert_one({
            "_id": "baz"
        })

    m = mocker.patch("virtool.db.refs.create_original", new=aiohttp.test_utils.make_mocked_coro())

    await virtool.organize.organize_references(test_motor)

    document = await test_motor.references.find_one()

    if has_species and not has_references:
        assert document is None
        m.assert_called_with(test_motor,)

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
            "ref": ORIGINAL_REF
        },
        {
            "_id": test_random_alphanumeric.history[1],
            "accession": "bar",
            "ref": ORIGINAL_REF
        },
        {
            "_id": test_random_alphanumeric.history[2],
            "accession": "baz",
            "ref": ORIGINAL_REF
        }
    ]


async def test_organize_species(test_motor):
    await test_motor.viruses.insert_many([
        {
            "_id": 1
        },
        {
            "_id": 2
        }
    ])

    await virtool.organize.organize_species(test_motor)

    assert await test_motor.species.find().to_list(None) == [
        {
            "_id": 1,
            "ref": ORIGINAL_REF
        },
        {
            "_id": 2,
            "ref": ORIGINAL_REF
        }
    ]

    assert "viruses" not in await test_motor.collection_names()


@pytest.mark.parametrize("has_update", [True, False])
@pytest.mark.parametrize("has_version", [True, False])
async def test_organize_status(has_update, has_version, test_motor):
    if has_update:
        await test_motor.status.insert_one({
            "_id": "software_update",
            "process": {
                "foobar": True
            }
        })

    if has_version:
        await test_motor.status.insert_one({
            "_id": "version",
            "version": "v2.28"
        })

    await virtool.organize.organize_status(test_motor, "v3.0.0")

    assert await test_motor.status.find({}, sort=[("_id", pymongo.ASCENDING)]).to_list(None) == [
        {
            "_id": "software_update",
            "process": None
        },
        {
            "_id": "version",
            "version": "v3.0.0"
        }
    ]


async def test_organize_subtraction(mocker):
    m_delete_unready = mocker.patch("virtool.organize.delete_unready", new=aiohttp.test_utils.make_mocked_coro())

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
