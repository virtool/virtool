from datetime import datetime

from syrupy.matchers import path_type


async def test_fake(fake2, snapshot):
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

    assert job == snapshot(name="job")
