import pytest

from tests.fixtures.client import ClientSpawner
from virtool.fake.next import DataFaker


@pytest.mark.apitest
class TestFind:
    async def test_find(self, fake2: DataFaker, snapshot, spawn_client: ClientSpawner):
        """
        Test that a ``GET /labels`` return a complete list of labels.

        """
        client = await spawn_client(authenticated=True)

        label_1 = await fake2.labels.create()
        label_2 = await fake2.labels.create()

        await client.mongo.samples.insert_many(
            [
                {
                    "_id": "foo",
                    "name": "Foo",
                    "labels": [
                        label_1.id,
                    ],
                },
                {"_id": "bar", "name": "Bar", "labels": [label_1.id, label_2.id]},
                {"_id": "baz", "name": "Baz", "labels": [label_2.id]},
            ],
            session=None,
        )

        resp = await client.get("/labels")

        assert resp.status == 200
        assert await resp.json() == snapshot

    async def test_find_by_name(
        self, fake2: DataFaker, snapshot, spawn_client: ClientSpawner
    ):
        """
        Test that a ``GET /labels`` with a `find` query returns a particular label. Also test for partial matches.

        """
        client = await spawn_client(authenticated=True)

        label = await fake2.labels.create()

        term = label.name[:2].lower()

        resp = await client.get(f"/labels?find={term}")

        assert resp.status == 200
        assert await resp.json() == snapshot

        resp = await client.get("/labels?find=Question")

        assert resp.status == 200
        assert await resp.json() == snapshot


@pytest.mark.apitest
@pytest.mark.parametrize("status", [200, 404])
async def test_get(
    status: int, fake2: DataFaker, snapshot, spawn_client: ClientSpawner
):
    """
    Test that a ``GET /labels/:label_id`` return the correct label document.

    """
    client = await spawn_client(authenticated=True)

    label_1 = await fake2.labels.create()
    label_2 = await fake2.labels.create()

    await client.mongo.samples.insert_many(
        [
            {"_id": "foo", "name": "Foo", "labels": [label_1.id]},
            {"_id": "bar", "name": "Bar", "labels": [label_2.id]},
            {"_id": "baz", "name": "Baz", "labels": [label_1.id]},
        ],
        session=None,
    )

    resp = await client.get(f"/labels/{22 if status == 404 else label_1.id}")

    assert resp.status == status
    assert await resp.json() == snapshot


@pytest.mark.apitest
@pytest.mark.parametrize("error", [None, "400_exists", "400_color"])
async def test_create(
    error: str | None,
    fake2: DataFaker,
    resp_is,
    spawn_client: ClientSpawner,
):
    """
    Test that a label can be added to the database at ``POST /labels``.

    """
    client = await spawn_client(authenticated=True)

    label = await fake2.labels.create()

    data = {"name": "Bug", "color": "#a83432", "description": "This is a bug"}

    if error == "400_exists":
        data["name"] = label.name

    if error == "400_color":
        data["color"] = "#1234567"

    resp = await client.post("/labels", data)

    if error is None:
        assert resp.status == 201
        assert await resp.json() == {
            "id": 2,
            "name": "Bug",
            "color": "#A83432",
            "description": "This is a bug",
            "count": 0,
        }

    elif error == "400_exists":
        await resp_is.bad_request(resp, "Label name already exists")
    elif error == "400_color":
        assert resp.status == 400


@pytest.mark.apitest
@pytest.mark.parametrize("error", [None, "404", "400_name", "400_color", "400_null"])
async def test_edit(
    error: str | None,
    fake2: DataFaker,
    resp_is,
    snapshot,
    spawn_client: ClientSpawner,
):
    """
    Test that a label can be updated at ``PATCH /labels/:label_id``.

    """
    client = await spawn_client(authenticated=True)

    label_1 = await fake2.labels.create()
    label_2 = await fake2.labels.create()

    await client.mongo.samples.insert_many(
        [
            {"_id": "foo", "name": "Foo", "labels": [label_1.id]},
            {"_id": "bar", "name": "Bar", "labels": [label_2.id]},
            {"_id": "baz", "name": "Baz", "labels": [label_1.id]},
        ],
        session=None,
    )

    data = {}

    if error is None:
        data["name"] = "Summer"

    if error == "400_color":
        data["color"] = "#123bzp1"

    if error == "400_name":
        # Name already exists.
        data["name"] = label_2.name

    if error == "400_null":
        data["name"] = None

    resp = await client.patch(
        f"/labels/{5 if error == '404' else label_1.id}", data=data
    )

    match error:
        case None:
            assert resp.status == 200
            assert await resp.json() == snapshot
        case "404":
            await resp_is.not_found(resp)
        case "400_color":
            assert resp.status == 400
        case "400_name":
            await resp_is.bad_request(resp, "Label name already exists")
        case "400_null":
            assert resp.status == 400


@pytest.mark.apitest
@pytest.mark.parametrize("status", [204, 404])
async def test_remove(
    status: int,
    fake2: DataFaker,
    mock_samples: list[dict],
    snapshot,
    spawn_client: ClientSpawner,
):
    """
    Test that a label can be deleted to the database at ``DELETE /labels/:label_id``.

    Test that samples are updated when a label is deleted.
    """

    client = await spawn_client(authenticated=True)

    label_1 = await fake2.labels.create()
    label_2 = await fake2.labels.create()
    label_3 = await fake2.labels.create()

    await client.mongo.subtraction.insert_many(
        [{"_id": "foo", "name": "Foo"}, {"_id": "bar", "name": "Bar"}], session=None
    )

    mock_samples[0].update({"labels": [label_1.id, label_3.id]})
    mock_samples[1].update({"labels": [label_2.id, label_3.id]})
    mock_samples[2].update({"labels": [label_1.id]})

    await client.mongo.samples.insert_many(mock_samples, session=None)

    resp = await client.delete(f"/labels/{22 if status == 404 else label_1.id}")

    assert resp.status == status
    assert await resp.json() == snapshot

    if status == 204:
        label_ids_in_samples = await client.mongo.samples.distinct("labels")

        assert label_1.id not in label_ids_in_samples
        assert label_2.id in label_ids_in_samples
        assert label_3.id in label_ids_in_samples


@pytest.mark.apitest
@pytest.mark.parametrize("value", ["valid_hex_color", "invalid_hex_color"])
async def test_is_valid_hex_color(value: str, resp_is, spawn_client: ClientSpawner):
    """
    Tests that when an invalid hex color is used, validators.is_valid_hex_color raises a 422 error.
    """
    client = await spawn_client(authenticated=True)

    resp = await client.patch(
        "/labels/00",
        data={
            "name": "test",
            "color": "#fc5203" if value == "valid_hex_color" else "foo",
            "description": "test",
        },
    )

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
