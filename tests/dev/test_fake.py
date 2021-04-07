from os.path import isdir

import pytest

from virtool.dev.fake import create_fake_data_path, create_fake_user, create_fake_jobs


@pytest.fixture
def app(dbi):
    return {"db": dbi}


def test_create_fake_data_path():
    path = create_fake_data_path()
    assert "virtool_fake_" in path
    assert isdir(path)


async def test_create_fake_user(snapshot, app, dbi, static_time):
    await create_fake_user(app)
    snapshot.assert_match(await dbi.users.find_one({}, {"password": False}))


async def test_create_fake_job(snapshot, app, dbi):
    await create_fake_jobs(app)
    document = await dbi.jobs.find_one({"task": "integration_test_workflow"})
    document["status"][0]["timestamp"] = None
    snapshot.assert_match(document)
