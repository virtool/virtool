from datetime import datetime

from syrupy.matchers import path_type

from virtool.fake.next import DataFaker
from virtool.uploads.models import UploadType


async def test_groups_and_users(fake2, snapshot):
    group = await fake2.groups.create()

    user_1 = await fake2.users.create()
    user_2 = await fake2.users.create(groups=[group])

    matcher = path_type(
        {
            "last_password_change": (datetime,),
        }
    )

    assert group.dict() == snapshot(matcher=matcher)
    assert user_1 == snapshot(matcher=matcher)
    assert user_2 == snapshot(matcher=matcher)

    job = await fake2.jobs.create(user_1)

    assert job == snapshot(
        name="job",
        matcher=path_type(
            {
                "created_at": (datetime,),
                ".*timestamp": (datetime,),
            },
            regex=True,
        ),
    )


async def test_jobs(fake2: DataFaker, snapshot):
    user = await fake2.users.create()

    assert await fake2.jobs.create(user) == snapshot(
        name="job",
        matcher=path_type(
            {
                "created_at": (datetime,),
                ".*timestamp": (datetime,),
            },
            regex=True,
        ),
    )


async def test_uploads(fake2: DataFaker, snapshot):
    matcher = path_type(
        {
            "created_at": (datetime,),
            "uploaded_at": (datetime,),
            ".*timestamp": (datetime,),
        },
        regex=True,
    )

    user = await fake2.users.create()

    assert await fake2.uploads.create(user=user) == snapshot(
        name="upload", matcher=matcher
    )

    assert await fake2.uploads.create(
        user=user, upload_type=UploadType.subtraction
    ) == snapshot(name="upload[subtraction]", matcher=matcher)

    assert await fake2.uploads.create(user=user, reserved=True) == snapshot(
        name="upload[reserved]", matcher=matcher
    )
