from os.path import isdir

from virtool.dev.fake import create_fake_data_path, create_fake_user, create_fake_analysis


def test_create_fake_data_path():
    path = create_fake_data_path()
    assert "virtool_fake_" in path
    assert isdir(path)


async def test_create_fake_user(snapshot, dbi, static_time):
    app = {
        "db": dbi
    }
    await create_fake_user(app)
    snapshot.assert_match(await dbi.users.find_one({}, {"password": False}))


async def test_create_fake_analysis(snapshot, dbi, pg, static_time):
    app = {
        "db": dbi,
        "pg": pg
    }

    await create_fake_analysis(app)
    snapshot.assert_match(await dbi.analyses.find().to_list(None))
