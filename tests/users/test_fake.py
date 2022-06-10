from virtool.users.fake import create_fake_bob_user


async def test_create_fake_bob_user(snapshot, app, dbi, static_time, mocker):
    mocker.patch("virtool.mongo.utils.get_new_id", return_value="abc123")
    await create_fake_bob_user(app)
    assert await dbi.users.find_one({}, {"password": False}) == snapshot
