import pytest
from virtool.models import Label


async def test_find(spawn_client, dbsession):
    """
    Test that a ``GET /api/labels`` return a complete list of labels.

    """
    client = await spawn_client(authorize=True, administrator=True)

    label1 = Label(id="test_1", name="Bug", color="#a83432", description="This is a bug")
    label2 = Label(id="test_2", name="Question", color="#03fc20", description="This is a question")

    async with dbsession as session:
        session.add(label1)
        session.add(label2)
        await session.commit()

    resp = await client.get("/api/labels")
    assert resp.status == 200

    assert await resp.json() == [
        {
            "id": "test_1",
            "name": "Bug",
            "color": "#a83432",
            "description": "This is a bug"
        },
        {
            "id": "test_2",
            "name": "Question",
            "color": "#03fc20",
            "description": "This is a question"
        }
    ]


@pytest.mark.parametrize("error", [None, "404"])
async def test_get(error, spawn_client, all_permissions, resp_is, dbsession):
    """
    Test that a ``GET /api/labels/:label_id`` return the correct label document.

    """
    client = await spawn_client(authorize=True, administrator=True)

    if not error:
        label = Label(id="test", name="Bug", color="#a83432", description="This is a test")
        async with dbsession as session:
            session.add(label)
            await session.commit()

    resp = await client.get("/api/labels/test")

    if error:
        assert await resp_is.not_found(resp)
        return

    assert resp.status == 200

    assert await resp.json() == {
        "id": "test",
        "name": "Bug",
        "color": "#a83432",
        "description": "This is a test"
    }


@pytest.mark.parametrize("error", [None, "400_exists", "422_color"])
async def test_create(error, spawn_client, dbsession, test_random_alphanumeric, resp_is):
    """
    Test that a label can be added to the database at ``POST /api/labels``.

    """
    client = await spawn_client(authorize=True, administrator=True)

    if error == "400_exists":
        label = Label(id="test", name="Bug")
        async with dbsession as session:
            session.add(label)
            await session.commit()

    data = {
        "name": "Bug",
        "color": "#a83432",
        "description": "This is a bug"
    }

    if error == "422_color":
        data["color"] = "#1234567"

    resp = await client.post("/api/labels", data)

    if error == "400_exists":
        assert await resp_is.bad_request(resp, "Label name already exists")
        return

    if error == "422_color":
        assert resp.status == 422
        return

    assert resp.status == 201

    expected_id = test_random_alphanumeric.history[0]
    assert resp.headers["Location"] == "/api/labels/" + expected_id

    assert await resp.json() == {
        "id": expected_id,
        "name": "Bug",
        "color": "#a83432",
        "description": "This is a bug"
    }


@pytest.mark.parametrize("error", [None, "404", "400_exists", "422_color", "422_data"])
async def test_edit(error, spawn_client, dbsession, resp_is):
    """
        Test that a label can be edited to the database at ``PATCH /api/labels/:label_id``.

    """
    client = await spawn_client(authorize=True, administrator=True)

    if error != "404":
        label1 = Label(id="test_1", name="Bug", color="#a83432", description="This is a bug")
        label2 = Label(id="test_2", name="Question", color="#03fc20", description="Question from a user")
        async with dbsession as session:
            session.add(label1)
            session.add(label2)
            await session.commit()

    data = dict()

    if error != "422_data":
        data = {
            "name": "Bug",
            "color": "#fc5203",
            "description": "Need to be fixed"
        }

    if error == "400_exists":
        data["name"] = "Question"

    if error == "422_color":
        data["color"] = "#123bzp"

    resp = await client.patch("/api/labels/test_1", data=data)

    if error == "404":
        assert await resp_is.not_found(resp)
        return

    if error == "400_exists":
        assert await resp_is.bad_request(resp, "Label name already exists")
        return

    if error == "422_color" or error == "422_data":
        assert resp.status == 422
        return

    assert resp.status == 200
    assert await resp.json() == {
        "id": "test_1",
        "name": "Bug",
        "color": "#fc5203",
        "description": "Need to be fixed"
    }


@pytest.mark.parametrize("error", [None, "400"])
async def test_remove(error, spawn_client, dbsession, resp_is):
    """
        Test that a label can be deleted to the database at ``DELETE /api/labels/:label_id``.

    """
    client = await spawn_client(authorize=True, administrator=True)

    if not error:
        label = Label(id="test", name="Bug", color="#a83432", description="This is a bug")
        async with dbsession as session:
            session.add(label)
            await session.commit()

    resp = await client.delete("/api/labels/test")

    if error:
        assert await resp_is.not_found(resp)
        return

    assert await resp_is.no_content(resp)
