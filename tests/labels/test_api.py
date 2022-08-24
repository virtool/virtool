import asyncio
from typing import List

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.labels.models import Label


class TestFind:
    async def test_find(self, snapshot, spawn_client, pg: AsyncEngine):
        """
        Test that a ``GET /labels`` return a complete list of labels.

        """
        client = await spawn_client(authorize=True, administrator=True)

        label_1 = Label(id=1, name="Bug", color="#A83432", description="This is a bug")

        label_2 = Label(
            id=2, name="Question", color="#03FC20", description="This is a question"
        )

        await client.db.samples.insert_many(
            [
                {"_id": "foo", "name": "Foo", "labels": [2]},
                {"_id": "bar", "name": "Bar", "labels": [1]},
                {"_id": "baz", "name": "Baz", "labels": [2]},
            ]
        )

        async with AsyncSession(pg) as session:
            session.add_all([label_1, label_2])
            await session.commit()

        resp = await client.get("/labels")

        assert resp.status == 200
        assert await resp.json() == snapshot

    async def test_find_by_name(self, snapshot, spawn_client, pg: AsyncEngine):
        """
        Test that a ``GET /labels`` with a `find` query returns a particular label. Also test for partial matches.

        """
        client = await spawn_client(authorize=True, administrator=True)

        label = Label(id=1, name="Bug", color="#A83432", description="This is a bug")

        async with AsyncSession(pg) as session:
            session.add(label)
            await session.commit()

        resp = await client.get("/labels?find=b")

        assert resp.status == 200
        assert await resp.json() == snapshot

        resp = await client.get("/labels?find=Question")

        assert resp.status == 200
        assert await resp.json() == snapshot


@pytest.mark.parametrize("error", [None, "404"])
async def test_get(error, spawn_client, all_permissions, pg: AsyncEngine, resp_is):
    """
    Test that a ``GET /labels/:label_id`` return the correct label document.

    """
    client = await spawn_client(authorize=True, administrator=True)

    await client.db.samples.insert_many(
        [
            {"_id": "foo", "name": "Foo", "labels": [2]},
            {"_id": "bar", "name": "Bar", "labels": [1]},
            {"_id": "baz", "name": "Baz", "labels": [2]},
        ]
    )

    if not error:
        async with AsyncSession(pg) as session:
            session.add(
                Label(id=1, name="Bug", color="#A83432", description="This is a test")
            )
            await session.commit()

    resp = await client.get("/labels/1")

    if error:
        await resp_is.not_found(resp)
        return

    assert resp.status == 200
    assert await resp.json() == {
        "id": 1,
        "name": "Bug",
        "color": "#A83432",
        "description": "This is a test",
        "count": 1,
    }


@pytest.mark.parametrize("error", [None, "400_exists", "422_color"])
async def test_create(
    error, spawn_client, test_random_alphanumeric, pg: AsyncEngine, resp_is
):
    """
    Test that a label can be added to the database at ``POST /labels``.

    """
    client = await spawn_client(authorize=True, administrator=True)

    await client.db.samples.insert_many(
        [
            {"_id": "foo", "name": "Foo", "labels": [2]},
            {"_id": "bar", "name": "Bar", "labels": [1]},
            {"_id": "baz", "name": "Baz", "labels": [2]},
        ]
    )

    if error == "400_exists":
        async with AsyncSession(pg) as session:
            session.add(Label(id=1, name="Bug"))
            await session.commit()

    data = {"name": "Bug", "color": "#a83432", "description": "This is a bug"}

    if error == "422_color":
        data["color"] = "#1234567"

    resp = await client.post("/labels", data)

    if error == "400_exists":
        await resp_is.bad_request(resp, "Label name already exists")
        return

    if error == "422_color":
        assert resp.status == 400
        return

    assert resp.status == 201

    assert await resp.json() == {
        "id": 1,
        "name": "Bug",
        "color": "#A83432",
        "description": "This is a bug",
        "count": 1,
    }


@pytest.mark.parametrize("error", [None, "404", "400_exists", "422_color", "422_data"])
async def test_edit(error, spawn_client, pg: AsyncEngine, resp_is):
    """
    Test that a label can be edited to the database at ``PATCH /labels/:label_id``.

    """
    client = await spawn_client(authorize=True, administrator=True)

    await client.db.samples.insert_many(
        [
            {"_id": "foo", "name": "Foo", "labels": [2]},
            {"_id": "bar", "name": "Bar", "labels": [1]},
            {"_id": "baz", "name": "Baz", "labels": [2]},
        ]
    )

    if error != "404":
        label_1 = Label(id=1, name="Bug", color="#a83432", description="This is a bug")

        label_2 = Label(
            id=2, name="Question", color="#03fc20", description="Question from a user"
        )

        async with AsyncSession(pg) as session:
            session.add_all([label_1, label_2])
            await session.commit()

    data = {}

    if error != "422_data":
        data = {"name": "Bug", "color": "#fc5203", "description": "Need to be fixed"}

    if error == "400_exists":
        data["name"] = "Question"

    if error == "422_color":
        data["color"] = "#123bzp"

    resp = await client.patch("/labels/1", data=data)

    if error == "404":
        await resp_is.not_found(resp)
        return

    if error == "400_exists":
        await resp_is.bad_request(resp, "Label name already exists")
        return

    if error == "422_color" or error == "422_data":
        assert resp.status == 400
        return

    assert resp.status == 200
    assert await resp.json() == {
        "id": 1,
        "name": "Bug",
        "color": "#FC5203",
        "description": "Need to be fixed",
        "count": 1,
    }


@pytest.mark.parametrize("error", [None, "400"])
async def test_remove(
    error, spawn_client, pg: AsyncEngine, resp_is, fake, mock_samples: List[dict]
):
    """
    Test that a label can be deleted to the database at ``DELETE /labels/:label_id``.

    Test that samples are updated when a label is deleted.
    """
    client = await spawn_client(authorize=True, administrator=True)

    if not error:
        async with AsyncSession(pg) as session:
            session.add_all(
                [
                    Label(
                        id=1, name="Bug", color="#a83432", description="This is a bug"
                    ),
                    Label(
                        id=4, name="Info", color="#03fc20", description="This is a info"
                    ),
                    Label(
                        id=9, name="que", color="#03fc20", description="This is a que"
                    ),
                ]
            )
            await session.commit()

        await client.db.subtraction.insert_many(
            [{"_id": "foo", "name": "Foo"}, {"_id": "bar", "name": "Bar"}]
        )

        mock_samples[0].update({"labels": [1, 4]})
        mock_samples[1].update({"labels": [1, 9]}),
        mock_samples[2].update({"labels": [1, 4, 9]})

        await client.db.samples.insert_many(mock_samples)

    resp = await client.delete("/labels/1")

    if error:
        await resp_is.not_found(resp)
        return

    await resp_is.no_content(resp)

    label_ids_in_samples = await client.db.samples.distinct("labels")

    assert 4 in label_ids_in_samples
    assert 9 in label_ids_in_samples
    assert 1 not in label_ids_in_samples


@pytest.mark.parametrize("value", ["valid_hex_color", "invalid_hex_color"])
async def test_is_valid_hex_color(value, spawn_client, resp_is):
    """
    Tests that when an invalid hex color is used, validators.is_valid_hex_color raises a 422 error.
    """
    client = await spawn_client(authorize=True)

    data = {
        "name": "test",
        "color": "#fc5203" if value == "valid_hex_color" else "foo",
        "description": "test",
    }

    resp = await client.patch("/labels/00", data=data)
    if value == "valid_hex_color":
        await resp_is.not_found(resp)
    else:
        assert resp.status == 400
        assert await resp.json() == [
            {
                "loc": ["color"],
                "msg": "The format of the color code is invalid",
                "type": "value_error",
                "in": "body",
            }
        ]
