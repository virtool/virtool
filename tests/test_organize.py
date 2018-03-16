import pytest

import virtool.organize


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


async def test_delete_unready(test_motor):
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
        },
    ])

    await virtool.organize.organize_analyses(test_motor)

    assert await test_motor.analyses.find().to_list(None) == [
        {
            "_id": 1,
            "ready": True
        },
        {
            "_id": 3,
            "ready": True
        }
    ]
