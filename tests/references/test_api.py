import asyncio
from asyncio import gather
from pathlib import Path

import pytest
from aiohttp.test_utils import make_mocked_coro
from syrupy.matchers import path_type
from virtool_core.models.enums import Permission
from virtool_core.models.task import Task

import virtool.utils
from virtool.data.utils import get_data_from_app
from virtool.pg.utils import get_row_by_id
from virtool.references.tasks import UpdateRemoteReferenceTask
from virtool.settings.oas import UpdateSettingsSchema
from virtool.tasks.models import Task as SQLTask


@pytest.mark.parametrize("error", [None, "400", "404"])
async def test_get_release(error, mocker, spawn_client, resp_is, snapshot):
    client = await spawn_client(authorize=True)

    if error != "404":
        document = {
            "_id": "foo",
            "release": {
                "id": 11449913,
                "name": "v0.1.2",
                "body": "#### Changed\r\n- add new isolates to Cucurbit chlorotic yellows virus",
                "etag": 'W/"b7e8a7fb0fbe0cade0d6a86c9e0d4549"',
                "filename": "reference.json.gz",
                "size": 3699729,
                "html_url": "https://github.com/virtool/ref-plant-viruses/releases/tag/v0.1.2",
                "download_url": "https://github.com/virtool/ref-plant-viruses/releases/download/v0.1.2/reference.json.gz",
                "published_at": "2018-06-12T21:52:33Z",
                "content_type": "application/gzip",
                "retrieved_at": "2018-06-14T19:52:17.465000Z",
                "newer": True,
            },
            "remotes_from": {"slug": "virtool/virtool"},
        }

        if error == "400":
            del document["remotes_from"]

        await client.db.references.insert_one(document)

    m_fetch_and_update_release = mocker.patch(
        "virtool.references.db.fetch_and_update_release",
        make_mocked_coro(
            {
                "id": 11449913,
                "name": "v0.1.2",
                "body": "#### Changed\r\n- add new isolates to Cucurbit chlorotic yellows virus",
                "etag": 'W/"b7e8a7fb0fbe0cade0d6a86c9e0d4549"',
                "filename": "reference.json.gz",
                "size": 3699729,
                "html_url": "https://github.com/virtool/ref-plant-viruses/releases/tag/v0.1.2",
                "download_url": "https://github.com/virtool/ref-plant-viruses/releases/download/v0.1.2/reference.json.gz",
                "published_at": "2018-06-12T21:52:33Z",
                "content_type": "application/gzip",
                "retrieved_at": "2018-06-14T19:52:17.465000Z",
                "newer": True,
            }
        ),
    )

    resp = await client.get("/refs/foo/release")

    if error == "400":
        await resp_is.bad_request(resp, "Not a remote reference")
        return

    if error == "404":
        await resp_is.not_found(resp)
        return

    assert resp.status == 200

    assert await resp.json() == snapshot

    m_fetch_and_update_release.assert_called_with(client.app, "foo")


@pytest.mark.parametrize("empty", [True, False])
async def test_list_updates(empty, mocker, spawn_client, id_exists, resp_is, snapshot):
    client = await spawn_client(authorize=True)

    m_get_one_field = mocker.patch(
        "virtool.mongo.utils.get_one_field",
        make_mocked_coro(
            None
            if empty
            else [
                {
                    "id": 11447367,
                    "name": "v0.1.1",
                    "body": "#### Fixed\r\n- fixed uploading to GitHub releases in `.travis.yml`",
                    "filename": "reference.json.gz",
                    "size": 3695872,
                    "html_url": "https://github.com/virtool/ref-plant-viruses/releases/tag/v0.1.1",
                    "published_at": "2018-06-12T19:20:57Z",
                    "created_at": "2018-06-14T18:37:54.242000Z",
                    "user": {
                        "id": "igboyes",
                        "handle": "igboyes",
                        "administrator": True,
                    },
                    "ready": True,
                    "newer": True,
                }
            ]
        ),
    )

    resp = await client.get("/refs/foo/updates")

    id_exists.assert_called_with(client.db.references, "foo")

    if not id_exists:
        await resp_is.not_found(resp)
        return

    assert resp.status == 200
    assert await resp.json() == snapshot

    m_get_one_field.assert_called_with(client.db.references, "updates", "foo")


@pytest.mark.parametrize("error", [None, "400"])
async def test_update(
    error,
    mocker,
    spawn_client,
    check_ref_right,
    id_exists,
    resp_is,
    static_time,
    snapshot,
):
    client = await spawn_client(authorize=True)

    if error != "400":
        await client.db.references.insert_one({"_id": "foo", "release": {"id": "bar"}})

    mocker.patch("virtool.references.tasks.UpdateRemoteReferenceTask")

    task = Task(
        id=10921,
        complete=False,
        context={},
        count=0,
        created_at=static_time.datetime,
        error=None,
        file_size=None,
        progress=22,
        step="test",
        type="update_remote_reference",
    )

    m_add_task = mocker.patch(
        "virtool.tasks.data.TasksData.create",
        make_mocked_coro(task),
    )

    mocker.patch("aiojobs.aiohttp.spawn", make_mocked_coro())

    m_update = mocker.patch(
        "virtool.references.db.update",
        make_mocked_coro(
            (
                {"id": "bar"},
                {
                    "id": 10742520,
                    "name": "v0.3.0",
                    "body": "The release consists of a gzipped JSON file containing:\r\n\r\n- a `data_type` field with value _genome_\r\n- an `organism` field with value _virus_\r\n- the `version` name (eg. *v0.2.0*)\r\n- a timestamp with the key `created_at`\r\n- virus data compatible for import into Virtool v2.0.0+\r\n\r\nScripts have been updated to follow upcoming convention changes in Virtool v3.0.0.",
                    "etag": 'W/"ef123d746a33f88ee44203d3ca6bc2f7"',
                    "filename": "reference.json.gz",
                    "size": 3709091,
                    "html_url": "https://api.github.com/repos/virtool/virtool-database/releases/10742520",
                    "download_url": "https://github.com/virtool/virtool-database/releases/download/v0.3.0/reference.json.gz",
                    "published_at": "2018-04-26T19:35:33Z",
                    "content_type": "application/gzip",
                    "newer": True,
                    "retrieved_at": "2018-04-14T19:52:17.465000Z",
                },
            )
        ),
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

    assert resp.status == 201
    assert await resp.json() == snapshot(name="json")
    assert m_update.call_args[0] == snapshot(name="call")


async def test_find_indexes(mocker, spawn_client, id_exists, md_proxy, resp_is):
    client = await spawn_client(authorize=True)

    body = {
        "documents": [
            {
                "version": 1,
                "created_at": "2015-10-06T20:00:00Z",
                "ready": False,
                "has_files": True,
                "job": {"id": "bar"},
                "reference": {"id": "bar"},
                "user": {
                    "id": "bf1b993c",
                    "handle": "leeashley",
                    "administrator": False,
                },
                "id": "bar",
                "change_count": 4,
                "modified_otu_count": 3,
            },
            {
                "version": 0,
                "created_at": "2015-10-06T20:00:00Z",
                "ready": False,
                "has_files": True,
                "job": {"id": "foo"},
                "reference": {"id": "foo"},
                "user": {
                    "id": "bf1b993c",
                    "handle": "leeashley",
                    "administrator": False,
                },
                "id": "foo",
                "change_count": 2,
                "modified_otu_count": 2,
            },
        ],
        "total_count": 2,
        "found_count": 2,
        "page_count": 1,
        "per_page": 25,
        "page": 1,
        "total_otu_count": 123,
        "change_count": 12,
        "modified_otu_count": 3,
    }

    m_find = mocker.patch("virtool.indexes.db.find", make_mocked_coro(body))

    resp = await client.get("/refs/foo/indexes")

    if not id_exists:
        await resp_is.not_found(resp)
        return

    assert resp.status == 200

    assert await resp.json() == body

    m_find.assert_called_with(client.db, md_proxy(), ref_id="foo")


@pytest.mark.parametrize("data_type", ["barcode"])
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
            "/uploads?upload_type=reference&name=reference.json.gz&type=reference",
            data={"file": f},
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

        task: SQLTask = await get_row_by_id(pg, SQLTask, task_id)

        if task.complete:
            assert await gather(
                client.db.otus.count_documents({}),
                client.db.sequences.count_documents({}),
                client.db.history.count_documents({}),
            ) == [20, 26, 20]

            break


@pytest.mark.parametrize("data_type", ["genome", "barcode"])
@pytest.mark.parametrize(
    "error", [None, "403", "404", "400_invalid_input", "400_duplicates"]
)
async def test_edit(
    data_type, error, mocker, snapshot, fake2, spawn_client, resp_is, static_time
):
    client = await spawn_client(authorize=True)

    user_1 = await fake2.users.create()
    user_2 = await fake2.users.create()
    user_3 = await fake2.users.create()

    if error != "404":
        await client.db.references.insert_one(
            {
                "_id": "foo",
                "created_at": virtool.utils.timestamp(),
                "data_type": data_type,
                "name": "Foo",
                "organism": "virus",
                "internal_control": None,
                "restrict_source_types": False,
                "source_types": ["isolate", "strain"],
                "user": {"id": user_1.id},
                "groups": [],
                "users": [
                    {
                        "id": user_2.id,
                        "build": True,
                        "created_at": static_time.datetime,
                        "modify": True,
                        "modify_otu": True,
                        "remove": True,
                    },
                    {
                        "id": user_3.id,
                        "created_at": static_time.datetime,
                        "build": True,
                        "modify": True,
                        "modify_otu": True,
                        "remove": True,
                    },
                ],
            }
        )

    data = {
        "name": "Bar",
        "description": "This is a test reference.",
        "targets": [{"name": "CPN60", "description": "", "required": True}],
    }

    if error == "400_invalid_input":
        data["targets"] = [{"description": True}]

    if error == "400_duplicates":
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

    if error == "400_duplicates":
        await resp_is.bad_request(
            resp, "The targets field may not contain duplicate names"
        )
        return

    if error == "400_invalid_input":
        assert resp.status == 400
        assert await resp.json() == [
            {
                "loc": ["targets", 0, "name"],
                "msg": "field required",
                "type": "value_error.missing",
                "in": "body",
            }
        ]
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
    error, field, snapshot, spawn_client, check_ref_right, resp_is, static_time, fake2
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

    user = await fake2.users.create()

    # Add group and user subdocuments to make sure a 400 is returned complaining about the user or group already
    # existing in the ref.
    if error == "400_exists":
        document["groups"].append({"id": "tech"})

        document["users"].append({"id": user.id})

    # Add group and user document to their collections unless we want to trigger a 400 complaining about the user or
    # group already not existing.
    if error != "400_dne":
        await client.db.groups.insert_one({"_id": "tech"})

    # Don't insert the ref document if we want to trigger a 404.
    if error != "404":
        await client.db.references.insert_one(document)

    url = f"/refs/foo/{field}s"

    if field == "group":
        resp = await client.post(url, {"group_id": "tech", "modify": True})
    if field == "user":
        resp = await client.post(
            url, {"user_id": user.id if error != "400_dne" else "fred", "modify": True}
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
    error, field, snapshot, spawn_client, check_ref_right, resp_is, fake2, static_time
):
    client = await spawn_client(authorize=True)

    document = {"_id": "foo", "groups": [], "users": []}

    user = await fake2.users.create()

    if error != "404_field":
        document["groups"].append(
            {
                "id": "tech",
                "build": False,
                "modify": False,
                "modify_otu": False,
                "remove": False,
                "created_at": static_time.datetime,
            }
        )

        document["users"].append(
            {
                "id": user.id,
                "build": False,
                "modify": False,
                "modify_otu": False,
                "remove": False,
                "created_at": static_time.datetime,
            }
        )

    if error != "404_ref":
        await client.db.references.insert_one(document)

    if field == "group":
        subdocument_id = "tech"
    else:
        subdocument_id = user.id if error != "404_field" else "fred"

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
