from virtool.users.data import UsersData
from virtool.users.fake import create_fake_bob_user


async def test_create_fake_bob_user(authorization_client, snapshot, mongo, pg, static_time, mocker):
    mocker.patch("virtool.mongo.utils.get_new_id", return_value="abc123")
    await create_fake_bob_user(UsersData(authorization_client, mongo, pg))
    assert await mongo.users.find_one({}, {"password": False}) == snapshot
