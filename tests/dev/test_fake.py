from os.path import isdir

from virtool.dev.fake import create_fake_analysis, create_fake_data_path, create_fake_jobs, \
    create_fake_references


def test_create_fake_data_path():
    path = create_fake_data_path()
    assert "virtool_fake_" in path
    assert isdir(path)


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

    snapshot.assert_match(await dbi.references.find().to_list(None))
