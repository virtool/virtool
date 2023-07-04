import asyncio
from pathlib import Path

import pytest
from aiohttp.test_utils import make_mocked_coro
from sqlalchemy.ext.asyncio import AsyncSession
from syrupy.matchers import path_type
from virtool_core.models.enums import Permission
from virtool_core.models.task import Task

import virtool.utils
from virtool.data.utils import get_data_from_app
from virtool.references.tasks import UpdateRemoteReferenceTask
from virtool.settings.oas import UpdateSettingsRequest
from virtool.tasks.models import SQLTask


@pytest.mark.apitest
async def test_find(spawn_client, pg, snapshot, fake2, static_time):
    client = await spawn_client(authorize=True, administrator=True)

    user_1 = await fake2.users.create()

    await client.db.references.insert_many(
        [
            {
                "_id": "foo",
                "created_at": static_time.datetime,
                "data_type": "genome",
                "name": "Foo",
                "organism": "virus",
                "internal_control": None,
                "restrict_source_types": False,
                "task": {"id": 1},
                "user": {"id": user_1.id},
                "groups": [],
            },
            {
                "_id": "baz",
                "created_at": static_time.datetime,
                "data_type": "barcode",
                "name": "Baz",
                "organism": "virus",
                "internal_control": None,
                "restrict_source_types": True,
                "task": {"id": 2},
                "user": {"id": user_1.id},
                "groups": [],
            },
        ],
        session=None,
    )

    task_1 = SQLTask(
        id=1,
        complete=True,
        context={"user_id": "test_1"},
        count=40,
        created_at=static_time.datetime,
        file_size=1024,
        progress=100,
        step="download",
        type="clone_reference",
    )

    task_2 = SQLTask(
        id=2,
        complete=False,
        context={"user_id": "test_2"},
        count=30,
        created_at=static_time.datetime,
        file_size=14754,
        progress=80,
        step="download",
        type="import_reference",
    )

    async with AsyncSession(pg) as session:
        session.add_all([task_1, task_2])
        await session.commit()

    resp = await client.get("/refs")

    assert resp.status == 200
    assert await resp.json() == snapshot


@pytest.mark.apitest
@pytest.mark.parametrize("error", [404, None])
async def test_get(error, spawn_client, pg, snapshot, fake2, static_time):
    client = await spawn_client(authorize=True, administrator=True)

    user_1 = await fake2.users.create()

    user_2 = await fake2.users.create()

    if error is None:
        await client.db.references.insert_one(
            {
                "_id": "bar",
                "created_at": virtool.utils.timestamp(),
                "data_type": "genome",
                "description": "plant pathogen",
                "name": "Bar",
                "organism": "virus",
                "internal_control": None,
                "restrict_source_types": False,
                "source_types": ["isolate", "strain"],
                "task": {"id": 1},
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
                ],
            }
        )

    task_1 = SQLTask(
        id=1,
        complete=True,
        context={"user_id": "test_1"},
        count=40,
        created_at=static_time.datetime,
        file_size=1024,
        progress=100,
        step="download",
        type="clone_reference",
    )

    async with AsyncSession(pg) as session:
        session.add_all([task_1])
        await session.commit()

    resp = await client.get("/refs/bar")

    if error:
        assert resp.status == 404
        return

    assert resp.status == 200
    assert await resp.json() == snapshot


@pytest.mark.apitest
class TestCreate:
    @pytest.mark.parametrize("data_type", ["genome", "barcode"])
    async def test_create(self, data_type, snapshot, spawn_client, static_time):
        client = await spawn_client(
            authorize=True,
            base_url="https://virtool.example.com",
            permissions=[Permission.create_ref],
        )

        default_source_type = ["strain", "isolate"]

        await get_data_from_app(client.app).settings.update(
            UpdateSettingsRequest(default_source_types=default_source_type)
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
    async def test_import_reference(
        self, pg, snapshot, spawn_client, test_files_path, tmpdir
    ):
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
            "/refs",
            {"name": "Test Viruses", "import_from": str(upload["name_on_disk"])},
        )

        reference = await resp.json()

        assert reference == snapshot(
            matcher=path_type({"id": (str,)}),
        )

    async def test_clone_reference(
        self, pg, snapshot, spawn_client, test_files_path, tmpdir, fake2, static_time
    ):
        client = await spawn_client(authorize=True, permissions=Permission.create_ref)

        user_1 = await fake2.users.create()
        user_2 = await fake2.users.create()

        await client.db.references.insert_one(
            {
                "_id": "foo",
                "created_at": virtool.utils.timestamp(),
                "data_type": "genome",
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
                ],
            }
        )

        data = {
            "name": "Test 1",
            "organism": "viruses",
            "data_type": "genome",
            "clone_from": "foo",
        }

        resp = await client.post("/refs", data)

        assert resp.status == 201
        assert resp.headers["Location"] == snapshot
        assert await resp.json() == snapshot

    async def test_remote_reference(
        self, pg, snapshot, spawn_client, test_files_path, tmpdir, fake2, static_time
    ):
        client = await spawn_client(authorize=True, permissions=Permission.create_ref)

        data = {
            "name": "Test Remote",
            "organism": "viruses",
            "data_type": "genome",
            "remote_from": "virtool/ref-plant-viruses",
        }

        resp = await client.post("/refs", data)

        assert resp.status == 201
        assert resp.headers["Location"] == snapshot
        assert await resp.json() == snapshot(
            matcher=path_type({".*etag": (str,)}, regex=True)
        )


@pytest.mark.apitest
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
        "virtool.references.api.check_right", make_mocked_coro(return_value=can_modify)
    )

    resp = await client.patch("/refs/foo", data)

    if error == "400_duplicates":
        assert await resp.json() == snapshot
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


@pytest.mark.apitest
async def test_delete_ref(mocker, snapshot, fake2, spawn_client, resp_is, static_time):
    client = await spawn_client(authorize=True)

    user_1 = await fake2.users.create()
    user_2 = await fake2.users.create()

    await client.db.references.insert_one(
        {
            "_id": "foo",
            "created_at": virtool.utils.timestamp(),
            "data_type": "genome",
            "description": "This is a test reference.",
            "groups": [],
            "internal_control": None,
            "name": "Foo",
            "organism": "virus",
            "restrict_source_types": False,
            "source_types": ["isolate", "strain"],
            "user": {"id": user_1.id},
            "users": [
                {
                    "id": user_2.id,
                    "build": True,
                    "created_at": static_time.datetime,
                    "modify": True,
                    "modify_otu": True,
                    "remove": True,
                },
            ],
        }
    )

    mocker.patch(
        "virtool.references.db.check_right", make_mocked_coro(return_value=True)
    )

    resp = await client.delete("/refs/foo")

    assert await client.db.references.count_documents({}) == 0
    assert await resp.text() == ""
    assert resp.status == 204


@pytest.mark.apitest
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

    assert await resp.json() == snapshot(
        matcher=path_type({".*etag": (str,)}, regex=True)
    )

    m_fetch_and_update_release.assert_called_with(
        client.app["db"], client.app["client"], "foo"
    )


@pytest.mark.apitest
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


@pytest.mark.apitest
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
    assert await resp.json() == snapshot(
        name="json", matcher=path_type({".*etag": (str,)}, regex=True)
    )
    assert m_update.call_args[0] == snapshot(name="call")


@pytest.mark.apitest
class TestCreateOTU:
    @pytest.mark.parametrize("exists", [True, False])
    @pytest.mark.parametrize("abbreviation", [None, "", "TMV"])
    async def test(
        self,
        exists,
        abbreviation,
        mocker,
        snapshot,
        spawn_client,
        check_ref_right,
        resp_is,
        static_time,
        test_random_alphanumeric,
    ):
        """
        Test that a valid request results in the creation of a otu document and a ``201`` response.

        """
        client = await spawn_client(
            authorize=True, base_url="https://virtool.example.com"
        )

        if exists:
            await client.db.references.insert_one(
                {"_id": "foo", "name": "Foo", "data_type": "genome"}
            )

        # Pass ref exists check.
        mocker.patch("virtool.mongo.utils.id_exists", make_mocked_coro(False))

        data = {"name": "Tobacco mosaic virus"}

        if abbreviation is not None:
            data["abbreviation"] = abbreviation

        resp = await client.post("/refs/foo/otus", data)

        if not exists:
            await resp_is.not_found(resp)
            return

        if not check_ref_right:
            await resp_is.insufficient_rights(resp)
            return

        assert resp.status == 201
        assert resp.headers["Location"] == snapshot(name="location")
        assert await resp.json() == snapshot(name="json")

        assert await asyncio.gather(
            client.db.otus.find_one(), client.db.history.find_one()
        ) == snapshot(name="db")

    @pytest.mark.parametrize(
        "error,message",
        [
            (None, None),
            ("400_name_exists", "Name already exists"),
            ("400_abbr_exists", "Abbreviation already exists"),
            ("400_both_exist", "Name and abbreviation already exist"),
            ("404", None),
        ],
    )
    async def test_field_exists(
        self, error, message, mocker, spawn_client, check_ref_right, resp_is
    ):
        """
        Test that the request fails with ``409 Conflict`` if the requested otu name already exists.

        """
        # Pass ref exists check.
        mocker.patch("virtool.mongo.utils.id_exists", make_mocked_coro(True))

        # Pass name and abbreviation check.
        m_check_name_and_abbreviation = mocker.patch(
            "virtool.otus.db.check_name_and_abbreviation", make_mocked_coro(message)
        )

        client = await spawn_client(authorize=True)

        if error != "404":
            await client.db.references.insert_one(
                {"_id": "foo", "name": "Foo", "data_type": "genome"}
            )

        data = {"name": "Tobacco mosaic virus", "abbreviation": "TMV"}

        resp = await client.post("/refs/foo/otus", data)

        if error == "404":
            await resp_is.not_found(resp)
            return

        if not check_ref_right:
            await resp_is.insufficient_rights(resp)
            return

        # Abbreviation defaults to empty string for OTU creation.
        m_check_name_and_abbreviation.assert_called_with(
            client.db, "foo", "Tobacco mosaic virus", "TMV"
        )

        if error:
            await resp_is.bad_request(resp, message)
            return

        assert resp.status == 201


@pytest.mark.apitest
async def test_create_index(
    fake2, mocker, snapshot, spawn_client, check_ref_right, resp_is
):
    """
    Test that a valid request results in the creation of a otu document and a ``201`` response.

    """
    client = await spawn_client(authorize=True, base_url="https://virtool.example.com")

    user = await fake2.users.create()

    await asyncio.gather(
        client.db.references.insert_one(
            {"_id": "foo", "name": "Foo", "data_type": "genome"}
        ),
        # Insert unbuilt changes to prevent initial check failure.
        client.db.history.insert_one(
            {
                "_id": "history_1",
                "index": {"id": "unbuilt", "version": "unbuilt"},
                "reference": {"id": "foo"},
                "user": {"id": user.id},
            }
        ),
    )

    m_create_manifest = mocker.patch(
        "virtool.references.db.get_manifest", new=make_mocked_coro({"foo": 2, "bar": 5})
    )

    # Pass ref exists check.
    mocker.patch("virtool.mongo.utils.id_exists", make_mocked_coro(False))

    resp = await client.post("/refs/foo/indexes")

    if not check_ref_right:
        await resp_is.insufficient_rights(resp)
        return

    assert resp.status == 201
    assert await resp.json() == snapshot
    assert await client.db.indexes.find_one() == snapshot

    m_create_manifest.assert_called_with(client.db, "foo")


@pytest.mark.apitest
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

    user_1 = await fake2.users.create()
    user_2 = await fake2.users.create()

    document = {
        "_id": "foo",
        "created_at": static_time.datetime,
        "data_type": "genome",
        "description": "This is a test reference.",
        "groups": [],
        "name": "Test",
        "organism": "virus",
        "restrict_source_types": False,
        "source_types": [],
        "user": {"id": user_2.id},
        "users": [],
    }

    # Add group and user subdocuments to make sure a 400 is returned complaining about the user or group already
    # existing in the ref.
    if error == "400_exists":
        document["groups"].append({"id": "tech"})
        document["users"].append({"id": user_1.id})

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
    else:
        resp = await client.post(
            url,
            {"user_id": "fred" if error == "400_dne" else user_1.id, "modify": True},
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


@pytest.mark.apitest
@pytest.mark.parametrize("error", [None, "404_field", "404_ref"])
@pytest.mark.parametrize("field", ["group", "user"])
async def test_edit_group_or_user(
    error, field, snapshot, spawn_client, check_ref_right, resp_is, fake2, static_time
):
    client = await spawn_client(authorize=True)

    user_1 = await fake2.users.create()
    user_2 = await fake2.users.create()

    document = {
        "_id": "foo",
        "created_at": static_time.datetime,
        "data_type": "genome",
        "description": "This is a test reference.",
        "groups": [],
        "name": "Test",
        "organism": "virus",
        "restrict_source_types": False,
        "source_types": [],
        "user": {"id": user_2.id},
        "users": [],
    }

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
                "id": user_1.id,
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
        subdocument_id = user_1.id if error != "404_field" else user_1.id

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


@pytest.mark.apitest
@pytest.mark.parametrize("error", [None, "404_field", "404_ref"])
@pytest.mark.parametrize("field", ["group", "user"])
async def test_delete_group_or_user(
    error, field, check_ref_right, fake2, resp_is, spawn_client, snapshot, static_time
):
    client = await spawn_client(authorize=True)

    user_1 = await fake2.users.create()
    user_2 = await fake2.users.create()

    document = {
        "_id": "foo",
        "created_at": static_time.datetime,
        "data_type": "genome",
        "description": "This is a test reference.",
        "groups": [],
        "name": "Test",
        "organism": "virus",
        "restrict_source_types": False,
        "source_types": [],
        "user": {"id": user_1.id},
        "users": [],
    }

    if error != "404_field":
        document["groups"].append(
            {
                "id": "tech",
                "build": False,
                "created_at": static_time.datetime,
                "modify": False,
                "modify_otu": False,
                "remove": False,
            }
        )

        document["users"].append(
            {
                "id": user_2.id,
                "build": False,
                "created_at": static_time.datetime,
                "modify": False,
                "modify_otu": False,
                "remove": False,
            }
        )

    if error != "404_ref":
        await client.db.references.insert_one(document)

    subdocument_id = "tech" if field == "group" else user_2.id

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


@pytest.mark.apitest
@pytest.mark.parametrize("find", [None, "Prunus", "virus", "PVF", "VF"])
@pytest.mark.parametrize("verified", [None, True, False])
async def test_find_otus(find, verified, spawn_client, snapshot):
    """Test to check that the api returns the correct OTUs based on how the results are filtered"""

    client = await spawn_client(authorize=True)

    await client.db.references.insert_one(
        {"_id": "foo", "name": "Foo", "data_type": "genome"}
    )

    await client.db.otus.insert_many(
        [
            {
                "_id": "6116cba1",
                "name": "Prunus virus F",
                "abbreviation": "PVF",
                "last_indexed_version": None,
                "verified": True,
                "lower_name": "prunus virus f",
                "isolates": [],
                "version": 0,
                "reference": {"id": "foo"},
                "schema": [],
            },
            {
                "_id": "5316cbz2",
                "name": "Papaya virus q",
                "abbreviation": "P",
                "last_indexed_version": None,
                "verified": False,
                "lower_name": "papaya virus q",
                "isolates": [],
                "version": 0,
                "reference": {"id": "foo"},
                "schema": [],
            },
        ],
        session=None,
    )

    path = "/refs/foo/otus"
    query = []

    if find is not None:
        query.append(f"find={find}")

    if verified is not None:
        query.append(f"verified={verified}")

    if query:
        path += f"?{'&'.join(query)}"

    resp = await client.get(path)
    assert resp.status == 200
    assert await resp.json() == snapshot
