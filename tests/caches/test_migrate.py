from aiohttp.test_utils import make_mocked_coro

from virtool.caches.migrate import migrate_caches, add_missing_field, rename_hash_field


async def test_migrate_caches(mocker, dbi):
    m_add_missing_field = mocker.patch("virtool.caches.migrate.add_missing_field", make_mocked_coro())
    m_rename_hash_field = mocker.patch("virtool.caches.migrate.rename_hash_field", make_mocked_coro())

    app = {
        "db": dbi,
        "settings": {
            "foo": "bar"
        }
    }

    await migrate_caches(app)

    m_add_missing_field.assert_called_with(app)
    m_rename_hash_field.assert_called_with(app)


async def test_add_missing_field(snapshot, tmp_path, dbi, config):
    app = {
        "db": dbi,
        "config": config
    }

    caches_dir = tmp_path / "caches"

    caches_dir.mkdir()
    caches_dir.joinpath("foo").mkdir()
    caches_dir.joinpath("baz").mkdir()

    await dbi.caches.insert_many([
        {
            "_id": "foo",
            "key": "1",
            "sample": {
                "id": "abc"
            }
        },
        {
            "_id": "bar",
            "key": "2",
            "sample": {
                "id": "dfg"
            }
        },
        {
            "_id": "baz",
            "key": "3",
            "sample": {
                "id": "zxc"
            }
        }
    ])

    await add_missing_field(app)

    snapshot.assert_match(await dbi.caches.find().to_list(None))


async def test_rename_hash_field(snapshot, dbi):
    app = {
        "db": dbi
    }

    await dbi.caches.insert_many([
        {
            "_id": "foo",
            "hash": "a97439e170adc4365c5b92bd2c148ed57d75e566",
            "sample": {
                "id": "abc"
            }
        },
        {
            "_id": "bar",
            "hash": "d7fh3ee170adc4365c5b92bd2c1f3fd5745te566",
            "sample": {
                "id": "dfg"
            }
        }
    ])

    await rename_hash_field(app)

    snapshot.assert_match(await dbi.caches.find().to_list(None))
