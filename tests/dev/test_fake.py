from os.path import isdir

import pytest

from virtool.dev.fake import create_fake_data_path, create_fake_user, create_fake_jobs, create_fake_analysis, \
    create_fake_references


@pytest.fixture
def app(dbi, pg):
    return {
        "db": dbi,
        "pg": pg,
        "settings": {
            "default_source_types": [
                "isolate",
                "strain"
            ]
        }
    }


def test_create_fake_data_path():
    path = create_fake_data_path()
    assert "virtool_fake_" in path
    assert isdir(path)


async def test_create_fake_user(snapshot, app, dbi, static_time):
    await create_fake_user(app)
    snapshot.assert_match(await dbi.users.find_one({}, {"password": False}))


async def test_create_fake_analysis(snapshot, app, dbi, static_time):
    await create_fake_analysis(app)
    snapshot.assert_match(await dbi.analyses.find().to_list(None))


async def test_create_fake_job(snapshot, app, dbi):
    await create_fake_jobs(app)
    document = await dbi.jobs.find_one({"task": "integration_test_workflow"})
    document["status"][0]["timestamp"] = None
    snapshot.assert_match(document)


async def test_create_fake_references(snapshot, app, dbi, static_time):
    await create_fake_references(app)

    document = await dbi.references.find_one({"_id": "reference_1"})
    document["created_at"] = static_time.datetime

    snapshot.assert_match(document)
