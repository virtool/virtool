import virtool.references.migrate
from aiohttp.test_utils import make_mocked_coro


async def test_migrate_references(mocker, dbi):
    app = {
        "db": dbi
    }

    m_add_targets_field = mocker.patch("virtool.references.migrate.add_targets_field", make_mocked_coro())

    await virtool.references.migrate.migrate_references(app)

    m_add_targets_field.assert_called_with(dbi.motor_client)


async def test_add_targets_field(snapshot, dbi):
    await dbi.references.insert_many([
        {
            "_id": "foo",
            "data_type": "genome"
        },
        {
            "_id": "bar",
            "data_type": "barcode"
        }
    ])

    await virtool.references.migrate.add_targets_field(dbi.motor_client)

    snapshot.assert_match(await dbi.references.find().to_list(None))
