from os.path import isdir

from virtool.dev.fake import create_fake_analysis, create_fake_data_path, create_fake_references


def test_create_fake_data_path():
    path = create_fake_data_path()
    assert "virtool_fake_" in str(path)
    assert isdir(path)


async def test_create_fake_analysis(snapshot, app, dbi, static_time):
    await create_fake_analysis(app)
    snapshot.assert_match(await dbi.analyses.find().to_list(None))


async def test_create_fake_references(snapshot, app, dbi, static_time):
    await create_fake_references(app)

    snapshot.assert_match(await dbi.references.find().to_list(None))
