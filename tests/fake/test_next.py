from datetime import datetime

from syrupy.matchers import path_type

from virtool.fake.next import DataFaker
from virtool.uploads.sql import UploadType


async def test_groups_and_users(fake: DataFaker, snapshot):
    group = await fake.groups.create()

    user_1 = await fake.users.create()
    user_2 = await fake.users.create(groups=[group])

    matcher = path_type(
        {
            "last_password_change": (datetime,),
        },
    )

    assert group.dict() == snapshot(matcher=matcher)
    assert user_1 == snapshot(matcher=matcher)
    assert user_2 == snapshot(matcher=matcher)

    job = await fake.jobs.create(user_1)

    assert job == snapshot(
        name="job",
        matcher=path_type(
            {
                "created_at": (datetime,),
                ".*pinged_at": (datetime,),
                ".*timestamp": (datetime,),
            },
            regex=True,
        ),
    )


async def test_jobs(fake: DataFaker, snapshot):
    user = await fake.users.create()

    assert await fake.jobs.create(user) == snapshot(
        name="job",
        matcher=path_type(
            {
                "created_at": (datetime,),
                ".*pinged_at": (datetime,),
                ".*timestamp": (datetime,),
            },
            regex=True,
        ),
    )


async def test_uploads(fake: DataFaker, snapshot):
    matcher = path_type(
        {
            "created_at": (datetime,),
            "name_on_disk": (str,),
            "uploaded_at": (datetime,),
            ".*timestamp": (datetime,),
        },
        regex=True,
    )

    user = await fake.users.create()

    assert await fake.uploads.create(user=user) == snapshot(
        name="upload",
        matcher=matcher,
    )

    assert await fake.uploads.create(
        user=user,
        upload_type=UploadType.subtraction,
    ) == snapshot(name="upload[subtraction]", matcher=matcher)

    assert await fake.uploads.create(user=user, reserved=True) == snapshot(
        name="upload[reserved]",
        matcher=matcher,
    )


async def test_subtractions(fake: DataFaker, snapshot_recent):
    user = await fake.users.create()
    upload = await fake.uploads.create(
        user=user,
        upload_type=UploadType.subtraction,
        name="foobar.fq.gz",
    )
    subtraction = await fake.subtractions.create(user=user, upload=upload)

    assert subtraction == snapshot_recent
