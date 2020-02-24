import virtool.caches.migrate
from aiohttp.test_utils import make_mocked_coro


async def test_migrate_caches(mocker, dbi):
    m_add_missing_field = mocker.patch("virtool.caches.migrate.add_missing_field", make_mocked_coro())

    app = {
        "db": dbi,
        "settings": {
            "foo": "bar"
        }
    }

    await virtool.caches.migrate.migrate_caches(app)

    m_add_missing_field.assert_called_with(app)


async def test_add_missing_field(snapshot, tmpdir, dbi):
    app = {
        "db": dbi,
        "settings": {
            "data_path": str(tmpdir)
        }
    }

    caches_dir = tmpdir.mkdir("caches")

    caches_dir.mkdir("foo")
    caches_dir.mkdir("baz")

    await dbi.caches.insert_many([
        {
            "_id": "foo"
        },
        {
            "_id": "bar"
        },
        {
            "_id": "baz"
        }
    ])

    await virtool.caches.migrate.add_missing_field(app)

    snapshot.assert_match(await dbi.caches.find().to_list(None))
