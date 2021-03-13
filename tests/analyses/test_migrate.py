import datetime
import os
import pytest
import json
import virtool.analyses.migrate
from aiohttp.test_utils import make_mocked_coro


async def test_add_updated_at(snapshot, dbi, static_time):
    """
    Ensure that the `updated_at` field is only added if it doesn't exist. Ensure that multiple update operation succeed.

    """
    await dbi.analyses.insert_many([
        {
            "_id": "foo",
            "created_at": static_time.datetime
        },
        {
            "_id": "bar",
            "created_at": static_time.datetime,
            "updated_at": static_time.datetime + datetime.timedelta(hours=9)
        },
        {
            "_id": "baz",
            "created_at": static_time.datetime
        },
        {
            "_id": "bad",
            "created_at": static_time.datetime,
            "updated_at": static_time.datetime + datetime.timedelta(hours=2, minutes=32)
        }
    ])

    await virtool.analyses.migrate.add_updated_at(dbi)

    snapshot.assert_match(await dbi.analyses.find().to_list(None))


async def test_migrate_analyses(mocker, dbi):
    """
    Make sure all of the migration functions compose together correctly.

    """
    settings = {
        "foo": "bar"
    }

    app = {
        "db": dbi,
        "settings": settings
    }

    m_rename_algorithm_field = mocker.patch(
        "virtool.analyses.migrate.rename_algorithm_field",
        make_mocked_coro()
    )

    m_delete_unready = mocker.patch(
        "virtool.db.migrate.delete_unready",
        make_mocked_coro()
    )

    await virtool.analyses.migrate.migrate_analyses(app)

    m_rename_algorithm_field.assert_called_with(dbi)
    m_delete_unready.assert_called_with(dbi.analyses)


async def test_rename_algorithm_field(dbi):
    """
    Test that only the `diagnosis` field is renamed to `results`.

    Don't bother testing effects on `nuvs` documents. They already use the results field name and will be ignored by the
    `{"workflow": "pathoscope_bowtie"}` query.

    """
    await dbi.analyses.insert_many([
        {"_id": "foo", "algorithm": "pathoscope_bowtie", "hello": "world"},
        {"_id": "bar", "workflow": "pathoscope_bowtie", "hello": "world"},
        {"_id": "baz", "algorithm": "pathoscope_bowtie", "hello": "world"},
        {"_id": "cod", "workflow": "pathoscope_bowtie", "hello": "world"}
    ])

    await virtool.analyses.migrate.rename_algorithm_field(dbi)

    assert await dbi.analyses.find({}).sort("_id").to_list(None) == [
        {"_id": "bar", "workflow": "pathoscope_bowtie", "hello": "world"},
        {"_id": "baz", "workflow": "pathoscope_bowtie", "hello": "world"},
        {"_id": "cod", "workflow": "pathoscope_bowtie", "hello": "world"},
        {"_id": "foo", "workflow": "pathoscope_bowtie", "hello": "world"}
    ]
