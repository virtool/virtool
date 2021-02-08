from virtool.labels.db import attach_sample_count


async def test_attach_sample_count(spawn_client, pg_session):
    client = await spawn_client(authorize=True)

    await client.db.samples.insert_many([
        {
            "_id": "foo",
            "name": "Foo",
            "labels": [1, 2, 4]
        },
        {
            "_id": "bar",
            "name": "Bar",
            "labels": []
        },
        {
            "_id": "baz",
            "name": "Baz",
            "labels": [2]
        }
    ])

    document_1 = {
        "id": 1,
        "name": "Bug",
        "color": "#a83432",
        "description": "This is a bug"
    }

    document_2 = {
        "id": 2,
        "name": "Question",
        "color": "#03fc20",
        "description": "This is a question"
    }

    document_3 = {
        "id": 3,
        "name": "Info",
        "color": "#02db21",
        "description": "This is a info"
    }
    result_1 = await attach_sample_count(client.app["db"], document_1)
    result_2 = await attach_sample_count(client.app["db"], document_2)
    result_3 = await attach_sample_count(client.app["db"], document_3)

    assert result_1 == {
        "id": 1,
        "name": "Bug",
        "color": "#a83432",
        "description": "This is a bug",
        "count": 1
    }

    assert result_2 == {
        "id": 2,
        "name": "Question",
        "color": "#03fc20",
        "description": "This is a question",
        "count": 2
    }

    assert result_3 == {
        "id": 3,
        "name": "Info",
        "color": "#02db21",
        "description": "This is a info",
        "count": 0
    }
