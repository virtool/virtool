import asyncio
from asyncio import gather
from pathlib import Path

import pytest
from aiohttp.test_utils import make_mocked_coro
from aiohttp.web import Request
from syrupy.matchers import path_type

from virtool.data.utils import get_data_from_app
from virtool.pg.utils import get_row_by_id
from virtool.references.tasks import UpdateRemoteReferenceTask
from virtool.settings.oas import UpdateSettingsSchema
from virtool.tasks.models import Task
from virtool_core.models.enums import Permission


@pytest.mark.parametrize("error", [None, "400", "404"])
async def test_get_release(error, mocker, spawn_client, resp_is):
    client = await spawn_client(authorize=True)

    if error != "404":
        document = {
            "_id": "foo",
            "release": {"id": "foo_release"},
            "remotes_from": {"slug": "virtool/virtool"},
        }

        if error == "400":
            del document["remotes_from"]

        await client.db.references.insert_one(document)

    m_fetch_and_update_release = mocker.patch(
        "virtool.references.db.fetch_and_update_release",
        make_mocked_coro({"_id": "release"}),
    )

    resp = await client.get("/refs/foo/release")

    if error == "400":
        await resp_is.bad_request(resp, "Not a remote reference")
        return

    if error == "404":
        await resp_is.not_found(resp)
        return

    assert resp.status == 200

    assert await resp.json() == {"_id": "release"}

    m_fetch_and_update_release.assert_called_with(client.app, "foo")


@pytest.mark.parametrize("empty", [True, False])
async def test_list_updates(empty, mocker, spawn_client, id_exists, resp_is):
    client = await spawn_client(authorize=True)

    m_get_one_field = mocker.patch(
        "virtool.mongo.utils.get_one_field",
        make_mocked_coro(None if empty else ["a", "b", "c"]),
    )

    resp = await client.get("/refs/foo/updates")

    id_exists.assert_called_with(client.db.references, "foo")

    if not id_exists:
        await resp_is.not_found(resp)
        return

    assert resp.status == 200
    assert await resp.json() == [] if None else ["c", "b", "a"]

    m_get_one_field.assert_called_with(client.db.references, "updates", "foo")


@pytest.mark.parametrize("error", [None, "400"])
async def test_update(
    error, mocker, spawn_client, check_ref_right, id_exists, resp_is, static_time
):
    client = await spawn_client(authorize=True)

    if error != "400":
        await client.db.references.insert_one({"_id": "foo", "release": {"id": "bar"}})

    mocker.patch("virtool.references.tasks.UpdateRemoteReferenceTask")

    m_add_task = mocker.patch(
        "virtool.tasks.client.TasksClient.add", make_mocked_coro({"id": "task"})
    )

    mocker.patch("aiojobs.aiohttp.spawn", make_mocked_coro())

    m_update = mocker.patch(
        "virtool.references.db.update",
        make_mocked_coro(({"id": "bar"}, {"id": "update", "created_at": "time"})),
    )

    resp = await client.post("/refs/foo/updates")

    id_exists.assert_called_with(client.db.references, "foo")

    if not id_exists:
        await resp_is.not_found(resp)
        return

    if not check_ref_right:
        await resp_is.insufficient_rights(resp)
        return

    if error == "400":
        await resp_is.bad_request(resp, "Target release does not exist")
        return

    m_add_task.assert_called_with(
        UpdateRemoteReferenceTask,
        context={
            "created_at": static_time.datetime,
            "ref_id": "foo",
            "release": {"id": "bar"},
            "user_id": "test",
        },
    )

    m_update.assert_called_with(
        mocker.ANY, static_time.datetime, "task", "foo", {"id": "bar"}, "test"
    )

    assert isinstance(m_update.call_args[0][0], Request)

    assert resp.status == 201

    assert await resp.json() == {"id": "update", "created_at": "time"}


async def test_find_indexes(mocker, spawn_client, id_exists, md_proxy, resp_is):
    client = await spawn_client(authorize=True)

    body = {"documents": ["a", "b", "c"]}

    m_find = mocker.patch("virtool.indexes.db.find", make_mocked_coro(body))

    resp = await client.get("/refs/foo/indexes")

    if not id_exists:
        await resp_is.not_found(resp)
        return

    assert resp.status == 200

    assert await resp.json() == body

    m_find.assert_called_with(client.db, md_proxy(), ref_id="foo")


@pytest.mark.parametrize("data_type", ["genome", "barcode"])
async def test_create(data_type, snapshot, spawn_client, static_time):
    client = await spawn_client(
        authorize=True,
        base_url="https://virtool.example.com",
        permissions=[Permission.create_ref],
    )

    default_source_type = ["strain", "isolate"]

    await get_data_from_app(client.app).settings.update(
        UpdateSettingsSchema(default_source_types=default_source_type)
    )

    data = {
        "name": "Test Viruses",
        "description": "A bunch of viruses used for testing",
        "data_type": data_type,
        "organism": "virus",
    }

    resp = await client.post("/refs", data)

    assert resp.status == 201
    assert resp.headers["Location"] == snapshot
    assert await resp.json() == snapshot


@pytest.mark.flaky(reruns=2)
async def test_import_reference(pg, snapshot, spawn_client, test_files_path, tmpdir):
    client = await spawn_client(
        authorize=True,
        permissions=[Permission.create_ref, Permission.upload_file],
    )

    tmpdir.mkdir("files")

    client.app["config"].data_path = Path(tmpdir)

    with open(test_files_path / "reference.json.gz", "rb") as f:
        resp = await client.post_form(
            "/uploads?type=reference&name=reference.json.gz", data={"file": f}
        )

        upload = await resp.json()

    resp = await client.post(
        "/refs", {"name": "Test Viruses", "import_from": str(upload["name_on_disk"])}
    )

    reference = await resp.json()
    assert reference == snapshot(
        matcher=path_type({"id": (str,)}),
    )

    task_id = reference["task"]["id"]

    while True:
        await asyncio.sleep(1)

        task: Task = await get_row_by_id(pg, Task, task_id)
        complete = task.complete

        if complete:
            assert await gather(
                client.db.otus.count_documents({}),
                client.db.sequences.count_documents({}),
                client.db.history.count_documents({}),
            ) == [20, 26, 20]

            break


@pytest.mark.parametrize("data_type", ["genome", "barcode"])
@pytest.mark.parametrize("error", [None, "403", "404", "422", "400"])
async def test_edit(data_type, error, mocker, snapshot, fake2, spawn_client, resp_is):
    client = await spawn_client(authorize=True)

    user_1 = await fake2.users.create()
    user_2 = await fake2.users.create()
    user_3 = await fake2.users.create()

    if error != "404":
        await client.db.references.insert_one(
            {
                "_id": "foo",
                "data_type": data_type,
                "name": "Foo",
                "user": {"id": user_1.id},
                "users": [{"id": user_2.id}, {"id": user_3.id}],
            }
        )

    data = {
        "name": "Bar",
        "description": "This is a test reference.",
        "targets": [{"name": "CPN60", "description": "", "required": True}],
    }

    if error == "422":
        data["targets"] = [{"description": True}]

    if error == "400":
        data["targets"].append(
            {
                "name": "CPN60",
                "description": "This has a duplicate name",
                "required": False,
            }
        )

    can_modify = error != "403"

    mocker.patch(
        "virtool.references.db.check_right", make_mocked_coro(return_value=can_modify)
    )

    resp = await client.patch("/refs/foo", data)

    if error == "400":
        await resp_is.bad_request(
            resp, "The targets field may not contain duplicate names"
        )
        return

    if error == "422":
        await resp_is.invalid_input(
            resp,
            {
                "targets": [
                    {
                        "0": [
                            {
                                "description": ["must be of string type"],
                                "name": ["required field"],
                            }
                        ]
                    }
                ]
            },
        )
        return

    if error == "404":
        await resp_is.not_found(resp)
        return

    if error == "403":
        await resp_is.insufficient_rights(resp)
        return

    assert await resp.json() == snapshot(name="resp")
    assert await client.db.references.find_one() == snapshot(name="db")


@pytest.mark.parametrize("error", [None, "400_dne", "400_exists", "404"])
@pytest.mark.parametrize("field", ["group", "user"])
async def test_add_group_or_user(
    error, field, snapshot, spawn_client, check_ref_right, resp_is, static_time
):
    """
    Test that the group or user is added to the reference when no error condition exists.

    Test for the following error conditions:
    - 404: ref does not exist
    - 400_exists: group or user already exists in ref
    - 400_dne: group or user does not exist

    """
    client = await spawn_client(authorize=True)

    document = {"_id": "foo", "groups": [], "users": []}

    # Add group and user subdocuments to make sure a 400 is returned complaining about the user or group already
    # existing in the ref.
    if error == "400_exists":
        document["groups"].append({"id": "tech"})

        document["users"].append({"id": "fred"})

    # Add group and user document to their collections unless we want to trigger a 400 complaining about the user or
    # group already not existing.
    if error != "400_dne":
        await client.db.groups.insert_one({"_id": "tech"})

        await client.db.users.insert_one({"_id": "fred"})

    # Don't insert the ref document if we want to trigger a 404.
    if error != "404":
        await client.db.references.insert_one(document)

    url = f"/refs/foo/{field}s"

    resp = await client.post(
        url, {field + "_id": "tech" if field == "group" else "fred", "modify": True}
    )

    if error == "404":
        await resp_is.not_found(resp)
        return

    if not check_ref_right:
        await resp_is.insufficient_rights(resp)
        return

    if error == "400_dne":
        await resp_is.bad_request(resp, f"{field.capitalize()} does not exist")
        return

    if error == "400_exists":
        await resp_is.bad_request(resp, f"{field.capitalize()} already exists")
        return

    assert resp.status == 201
    assert await resp.json() == snapshot
    assert await client.db.references.find_one() == snapshot


@pytest.mark.parametrize("error", [None, "404_field", "404_ref"])
@pytest.mark.parametrize("field", ["group", "user"])
async def test_edit_group_or_user(
    error, field, snapshot, spawn_client, check_ref_right, resp_is
):
    client = await spawn_client(authorize=True)

    document = {"_id": "foo", "groups": [], "users": []}

    if error != "404_field":
        document["groups"].append(
            {
                "id": "tech",
                "build": False,
                "modify": False,
                "modify_otu": False,
                "remove": False,
            }
        )

        document["users"].append(
            {
                "id": "fred",
                "build": False,
                "modify": False,
                "modify_otu": False,
                "remove": False,
            }
        )

    if error != "404_ref":
        await client.db.references.insert_one(document)

    await client.db.users.insert_one({"_id": "fred"})

    subdocument_id = "tech" if field == "group" else "fred"

    url = f"/refs/foo/{field}s/{subdocument_id}"

    resp = await client.patch(url, {"remove": True})

    if error:
        await resp_is.not_found(resp)
        return

    if not check_ref_right:
        await resp_is.insufficient_rights(resp)
        return

    assert resp.status == 200
    assert await resp.json() == snapshot

    assert await client.db.references.find_one() == snapshot


@pytest.mark.parametrize("error", [None, "404_field", "404_ref"])
@pytest.mark.parametrize("field", ["group", "user"])
async def test_delete_group_or_user(
    error, field, snapshot, spawn_client, check_ref_right, resp_is
):
    client = await spawn_client(authorize=True)

    document = {"_id": "foo", "groups": [], "users": []}

    if error != "404_field":
        document["groups"].append(
            {
                "id": "tech",
                "build": False,
                "modify": False,
                "modify_otu": False,
                "remove": False,
            }
        )

        document["users"].append(
            {
                "id": "fred",
                "build": False,
                "modify": False,
                "modify_otu": False,
                "remove": False,
            }
        )

    if error != "404_ref":
        await client.db.references.insert_one(document)

    subdocument_id = "tech" if field == "group" else "fred"

    url = f"/refs/foo/{field}s/{subdocument_id}"

    resp = await client.delete(url)

    if error:
        await resp_is.not_found(resp)
        return

    if not check_ref_right:
        await resp_is.insufficient_rights(resp)
        return

    await resp_is.no_content(resp)

    assert await client.db.references.find_one() == snapshot
