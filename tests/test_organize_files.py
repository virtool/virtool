import pytest

import virtool.organize


@pytest.fixture
def file_documents():
    return [

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
