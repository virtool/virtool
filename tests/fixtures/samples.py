import arrow
import pytest

from virtool.fake.next import DataFaker


@pytest.fixture()
def mock_sample(static_time):
    return {
        "_id": "test",
        "name": "Test",
        "created_at": static_time.datetime,
        "ready": False,
        "files": [
            {
                "id": "foo",
                "name": "Bar.fq.gz",
                "download_url": "/download/samples/files/file_1.fq.gz",
            },
        ],
        "labels": [],
        "subtractions": ["foo", "bar"],
        "user": {"id": ""},
    }


@pytest.fixture()
async def mock_samples(fake: DataFaker, mock_sample, static_time):
    user_1 = await fake.users.create()
    user_2 = await fake.users.create()
    user_3 = await fake.users.create()

    return [
        {
            **mock_sample,
            "user": {"id": user_1.id},
        },
        {
            **mock_sample,
            "user": {"id": user_2.id},
            "_id": "foo",
            "created_at": arrow.get(static_time.datetime).shift(hours=1).datetime,
        },
        {
            **mock_sample,
            "user": {"id": user_3.id},
            "_id": "bar",
            "created_at": arrow.get(static_time.datetime).shift(hours=2).datetime,
        },
    ]
