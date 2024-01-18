import asyncio
from pathlib import Path
from unittest.mock import call

import pytest
from aiohttp.test_utils import make_mocked_coro
from sqlalchemy.ext.asyncio import AsyncSession, AsyncEngine
from syrupy import SnapshotAssertion
from syrupy.matchers import path_type
from virtool_core.models.enums import Permission

import virtool.utils
from tests.fixtures.client import ClientSpawner
from virtool.config import get_config_from_app
from virtool.data.layer import DataLayer
from virtool.data.utils import get_data_from_app
from virtool.fake.next import DataFaker
from virtool.mongo.utils import get_one_field
from virtool.settings.oas import UpdateSettingsRequest
from virtool.tasks.models import SQLTask
from virtool.users.oas import UpdateUserRequest


@pytest.mark.apitest
async def test_find(
    data_layer: DataLayer,
    fake2: DataFaker,
    pg: AsyncEngine,
    snapshot,
    spawn_client: ClientSpawner,
    static_time,
):
    client = await spawn_client(authenticated=True)

    group = await fake2.groups.create()
    user = await fake2.users.create()
    await data_layer.users.update(client.user.id, UpdateUserRequest(groups=[group.id]))

    await client.mongo.references.insert_many(
        [
            {
                "_id": "foo",
                "created_at": static_time.datetime,
                "data_type": "genome",
                "groups": [],
                "internal_control": None,
                "name": "Foo",
                "organism": "virus",
                "restrict_source_types": False,
                "task": {"id": 1},
                "user": {"id": client.user.id},
            },
            {
                "_id": "baz",
                "created_at": static_time.datetime,
                "data_type": "barcode",
                "groups": [],
                "internal_control": None,
                "name": "Baz",
                "organism": "virus",
                "restrict_source_types": True,
                "task": {"id": 2},
                "user": {"id": user.id},
            },
            {
                "_id": "bar",
                "created_at": static_time.datetime,
                "data_type": "barcode",
                "groups": [],
                "internal_control": None,
                "name": "Baz",
                "organism": "virus",
                "restrict_source_types": True,
                "task": {"id": 2},
                "user": {"id": user.id},
                "users": [{"id": client.user.id}],
            },
            {
                "_id": "goo",
                "created_at": static_time.datetime,
                "data_type": "barcode",
                "groups": [{"id": group.id}],
                "internal_control": None,
                "name": "Baz",
                "organism": "virus",
                "restrict_source_types": True,
                "task": {"id": 2},
                "user": {"id": user.id},
                "users": [],
            },
        ],
        session=None,
    )

    async with AsyncSession(pg) as session:
        session.add_all(
            [
                SQLTask(
                    id=1,
                    complete=True,
                    context={"user_id": "test_1"},
                    count=40,
                    created_at=static_time.datetime,
                    file_size=1024,
                    progress=100,
                    step="download",
                    type="clone_reference",
                ),
                SQLTask(
                    id=2,
                    complete=False,
                    context={"user_id": "test_2"},
                    count=30,
                    created_at=static_time.datetime,
                    file_size=14754,
                    progress=80,
                    step="download",
                    type="import_reference",
                ),
            ]
        )
        await session.commit()

    resp = await client.get("/refs")
    body = await resp.json()

    assert resp.status == 200
    assert body == snapshot

    # Make sure the user does not have access to the reference "baz" where they are not
    # the owner, in ``users`` or a member of a group in ``groups``.
    assert {d["id"] for d in body["documents"]} == {"foo", "bar", "goo"}


@pytest.mark.apitest
@pytest.mark.parametrize("error", [404, None])
async def test_get(error, spawn_client, pg, snapshot, fake2, static_time):
    client = await spawn_client(authenticated=True, administrator=True)

    user_1 = await fake2.users.create()
    user_2 = await fake2.users.create()

    if error is None:
        await client.mongo.references.insert_one(
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

    async with AsyncSession(pg) as session:
        session.add(
            SQLTask(
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
        )

        await session.commit()

    resp = await client.get("/refs/bar")

    if error is None:
        assert resp.status == 200
        assert await resp.json() == snapshot
    else:
        assert resp.status == 404


@pytest.mark.apitest
class TestCreate:
    @pytest.mark.parametrize("data_type", ["genome", "barcode"])
    async def test_ok(
        self,
        data_type,
        data_layer: DataLayer,
        snapshot,
        spawn_client: ClientSpawner,
        static_time,
    ):
        client = await spawn_client(
            authenticated=True,
            base_url="https://virtool.example.com",
            permissions=[Permission.create_ref],
        )

        default_source_type = ["strain", "isolate"]

        await data_layer.settings.update(
            UpdateSettingsRequest(default_source_types=default_source_type)
        )

        resp = await client.post(
            "/refs",
            {
                "name": "Test Viruses",
                "description": "A bunch of viruses used for testing",
                "data_type": data_type,
                "organism": "virus",
            },
        )

        assert resp.status == 201
        assert resp.headers["Location"] == snapshot(name="location")
        assert await resp.json() == snapshot(name="resp")

    @pytest.mark.flaky(reruns=2)
    async def test_import(
        self,
        snapshot,
        spawn_client: ClientSpawner,
        static_time,
        test_files_path,
        tmpdir,
    ):
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_ref, Permission.upload_file],
        )

        get_config_from_app(client.app).data_path = Path(tmpdir)

        resp = await client.post_form(
            "/uploads?upload_type=reference&name=reference.json.gz&type=reference",
            data={"file": open(test_files_path / "reference.json.gz", "rb")},
        )

        upload = await resp.json()

        resp = await client.post(
            "/refs",
            {"name": "Test Viruses", "import_from": str(upload["name_on_disk"])},
        )

        body = await resp.json()

        assert resp.status == 201
        assert body == snapshot(
            matcher=path_type({"id": (str,)}),
        )

    async def test_clone(
        self,
        fake2: DataFaker,
        snapshot,
        spawn_client: ClientSpawner,
        static_time,
        tmpdir,
    ):
        client = await spawn_client(
            authenticated=True, permissions=[Permission.create_ref]
        )

        user_1 = await fake2.users.create()
        user_2 = await fake2.users.create()

        await client.mongo.references.insert_one(
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

        resp = await client.post(
            "/refs",
            {
                "name": "Test 1",
                "organism": "viruses",
                "data_type": "genome",
                "clone_from": "foo",
            },
        )

        assert resp.status == 201
        assert resp.headers["Location"] == snapshot(name="location")
        assert await resp.json() == snapshot(name="resp")

    async def test_remote(
        self, snapshot, spawn_client: ClientSpawner, static_time, tmpdir
    ):
        client = await spawn_client(
            authenticated=True, permissions=[Permission.create_ref]
        )

        resp = await client.post(
            "/refs",
            {
                "name": "Test Remote",
                "organism": "viruses",
                "data_type": "genome",
                "remote_from": "virtool/ref-plant-viruses",
            },
        )

        assert resp.status == 201
        assert resp.headers["Location"] == snapshot(name="location")
        assert await resp.json() == snapshot(
            matcher=path_type({".*etag": (str,)}, regex=True), name="resp"
        )


@pytest.mark.apitest
@pytest.mark.parametrize("data_type", ["genome", "barcode"])
@pytest.mark.parametrize(
    "error", [None, "403", "404", "400_invalid_input", "400_duplicates"]
)
async def test_edit(
    data_type: str,
    error: str | None,
    fake2: DataFaker,
    mocker,
    resp_is,
    snapshot,
    spawn_client: ClientSpawner,
    static_time,
):
    client = await spawn_client(authenticated=True)

    user_1 = await fake2.users.create()
    user_2 = await fake2.users.create()
    user_3 = await fake2.users.create()

    if error != "404":
        await client.mongo.references.insert_one(
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

    match error:
        case None:
            assert await resp.json() == snapshot(name="resp")
            assert await client.mongo.references.find_one() == snapshot(name="db")

        case "400_invalid_input":
            assert resp.status == 400
            assert await resp.json() == [
                {
                    "loc": ["targets", 0, "name"],
                    "msg": "field required",
                    "type": "value_error.missing",
                    "in": "body",
                }
            ]

        case "400_duplicates":
            assert await resp.json() == snapshot

        case "403":
            await resp_is.insufficient_rights(resp)

        case "404":
            await resp_is.not_found(resp)


@pytest.mark.apitest
async def test_delete(fake2: DataFaker, spawn_client: ClientSpawner, static_time):
    client = await spawn_client(authenticated=True)

    user_1 = await fake2.users.create()
    user_2 = await fake2.users.create()

    await client.mongo.references.insert_one(
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
                    "id": client.user.id,
                    "build": True,
                    "created_at": static_time.datetime,
                    "modify": True,
                    "modify_otu": True,
                    "remove": True,
                },
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

    resp = await client.delete("/refs/foo")

    assert await client.mongo.references.count_documents({}) == 0
    assert await resp.text() == ""
    assert resp.status == 204


@pytest.mark.apitest
@pytest.mark.parametrize("error", [None, "400", "404"])
async def test_get_release(error, mocker, spawn_client, resp_is, snapshot):
    client = await spawn_client(authenticated=True)

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

        await client.mongo.references.insert_one(document)

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
    client = await spawn_client(authenticated=True)

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

    id_exists.assert_called_with(client.mongo.references, "foo")

    if not id_exists:
        await resp_is.not_found(resp)
        return

    assert resp.status == 200
    assert await resp.json() == snapshot

    m_get_one_field.assert_called_with(client.mongo.references, "updates", "foo")


@pytest.mark.apitest
@pytest.mark.parametrize("error", [None, "400", "404"])
async def test_update(
    error: str | None,
    check_ref_right,
    mocker,
    resp_is,
    snapshot,
    spawn_client: ClientSpawner,
    static_time,
):
    client = await spawn_client(authenticated=True)

    if error != "404":
        reference = {
            "_id": "foo",
            "release": None,
        }

        if error != "400":
            reference["release"] = {
                "id": 10742520,
                "name": "v0.3.0",
                "body": "Lorem ipsum",
                "etag": 'W/"ef123d746a33f88ee44203d3ca6bc2f7"',
                "filename": "reference.json.gz",
                "size": 3709091,
                "html_url": "https://api.github.com/repos/virtool/virtool-database/releases/10742520",
                "download_url": "https://github.com/virtool/virtool-database/releases/download/v0.3.0/reference.json.gz",
                "published_at": "2018-04-26T19:35:33Z",
                "content_type": "application/gzip",
                "newer": True,
                "retrieved_at": "2018-04-14T19:52:17.465000Z",
            }

        await client.mongo.references.insert_one(reference)

        m_enqueue = mocker.patch.object(
        get_data_from_app(client.app).tasks._tasks_client, "enqueue")

    resp = await client.post("/refs/foo/updates", {})

    if not check_ref_right:
        await resp_is.insufficient_rights(resp)
    elif error == "400":
        await resp_is.bad_request(resp, "No release available")
    elif error == "404":
        await resp_is.not_found(resp)
    else:
        assert resp.status == 201
        assert await resp.json() == snapshot(
            name="json", matcher=path_type({".*etag": (str,)}, regex=True)
        )
        assert m_enqueue.call_args == call('update_remote_reference', 1)
        assert await get_one_field(client.mongo.references, "task", "foo") == {"id": 1}


@pytest.mark.apitest
class TestCreateOTU:
    @pytest.mark.parametrize("abbreviation", [None, "TMV", ""])
    @pytest.mark.parametrize("error", [None, "403", "404"])
    async def test(
        self,
        abbreviation: str | None,
        error: str | None,
        resp_is,
        snapshot,
        spawn_client,
        static_time,
    ):
        """
        Test that a valid request results in the creation of a otu document and a
        ``201`` response.
        """
        client = await spawn_client(
            authenticated=True, base_url="https://virtool.example.com"
        )

        if error != "404":
            await client.mongo.references.insert_one(
                {
                    "_id": "foo",
                    "name": "Foo",
                    "data_type": "genome",
                    "groups": [],
                    "user": {"id": client.user.id},
                    "users": [
                        {
                            "id": "bob" if error == "403" else client.user.id,
                            "build": True,
                            "created_at": static_time.datetime,
                            "modify": True,
                            "modify_otu": True,
                            "remove": True,
                        }
                    ],
                }
            )

        data = {"name": "Tobacco mosaic virus"}

        if abbreviation is not None:
            data["abbreviation"] = abbreviation

        resp = await client.post("/refs/foo/otus", data)

        match error:
            case None:
                assert resp.status == 201
                assert (
                    resp.headers["Location"]
                    == "https://virtool.example.com/otus/bf1b993c"
                )
                assert await resp.json() == snapshot(name="json")
                assert await asyncio.gather(
                    client.mongo.otus.find_one(), client.mongo.history.find_one()
                ) == snapshot(name="db")
            case "403":
                await resp_is.insufficient_rights(resp)
            case "404":
                await resp_is.not_found(resp)

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
        self,
        error: str | None,
        message: str | None,
        mocker,
        resp_is,
        spawn_client: ClientSpawner,
        static_time,
    ):
        """
        Test that the request fails with ``409 Conflict`` if the requested otu name
        already exists.
        """

        # Pass name and abbreviation check.
        m_check_name_and_abbreviation = mocker.patch(
            "virtool.otus.db.check_name_and_abbreviation", make_mocked_coro(message)
        )

        client = await spawn_client(authenticated=True)

        if error != "404":
            await client.mongo.references.insert_one(
                {
                    "_id": "foo",
                    "name": "Foo",
                    "data_type": "genome",
                    "groups": [],
                    "users": [
                        {
                            "id": client.user.id,
                            "build": True,
                            "created_at": static_time.datetime,
                            "modify": True,
                            "modify_otu": True,
                            "remove": True,
                        }
                    ],
                }
            )

        resp = await client.post(
            "/refs/foo/otus", {"name": "Tobacco mosaic virus", "abbreviation": "TMV"}
        )

        if error is None:
            assert resp.status == 201
            # Abbreviation defaults to empty string for OTU creation.
            m_check_name_and_abbreviation.assert_called_with(
                client.mongo, "foo", "Tobacco mosaic virus", "TMV"
            )
        elif error == "404":
            await resp_is.not_found(resp)
        else:
            await resp_is.bad_request(resp, message)


@pytest.mark.apitest
async def test_create_index(
    check_ref_right,
    fake2: DataFaker,
    mocker,
    resp_is,
    snapshot: SnapshotAssertion,
    spawn_client: ClientSpawner,
    static_time,
):
    """
    Test that a valid request results in the creation of a otu document and a ``201`` response.

    """
    client = await spawn_client(
        authenticated=True, base_url="https://virtool.example.com"
    )

    user = await fake2.users.create()

    await asyncio.gather(
        client.mongo.references.insert_one(
            {"_id": "foo", "name": "Foo", "data_type": "genome"}
        ),
        # Insert unbuilt changes to prevent initial check failure.
        client.mongo.history.insert_one(
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

    resp = await client.post("/refs/foo/indexes", {})

    if not check_ref_right:
        await resp_is.insufficient_rights(resp)
        return

    assert resp.status == 201
    assert await resp.json() == snapshot
    assert await client.mongo.indexes.find_one() == snapshot

    m_create_manifest.assert_called_with(client.mongo, "foo")


@pytest.mark.apitest
@pytest.mark.parametrize("error", [None, "400_dne", "400_exists", "404"])
async def test_create_user(
    error: str | None,
    fake2: DataFaker,
    resp_is,
    snapshot: SnapshotAssertion,
    spawn_client: ClientSpawner,
    static_time,
):
    """
    Test that the group or user is added to the reference when no error condition
    exists.

    Test for the following error conditions:
    * 404: ref does not exist
    * 400_exists: group or user already exists in ref
    * 400_dne: group or user does not exist

    """
    client = await spawn_client(authenticated=True)

    user = await fake2.users.create()

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
        "user": {"id": client.user.id},
        "users": [
            {
                "id": client.user.id,
                "build": True,
                "created_at": static_time.datetime,
                "modify": True,
                "modify_otu": True,
                "remove": True,
            }
        ],
    }

    # Add group and user subdocuments to make sure a 400 is returned complaining about
    # the user or group already existing in the ref.
    if error == "400_exists":
        document["users"].append(
            {
                "id": user.id,
                "build": True,
                "created_at": static_time.datetime,
                "modify": True,
                "modify_otu": True,
                "remove": True,
            }
        )

    # Don't insert the ref document if we want to trigger a 404.
    if error != "404":
        await client.mongo.references.insert_one(document)

    resp = await client.post(
        "/refs/foo/users",
        {"user_id": "fred" if error == "400_dne" else user.id, "modify": True},
    )

    match error:
        case None:
            assert resp.status == 201
            assert await resp.json() == snapshot(name="resp")
            assert await client.mongo.references.find_one() == snapshot(name="mongo")
        case "404":
            await resp_is.not_found(resp)
        case "400_dne":
            await resp_is.bad_request(resp, "User does not exist")
        case "400_exists":
            await resp_is.bad_request(resp, "User already exists")


@pytest.mark.apitest
@pytest.mark.parametrize("error", [None, "400_dne", "400_exists", "404"])
async def test_create_group(
    error: str | None,
    fake2: DataFaker,
    resp_is,
    snapshot: SnapshotAssertion,
    spawn_client: ClientSpawner,
    static_time,
):
    """
    Test that a group is added to the reference when no error condition exists.

    * 400_dne: user group does not exist
    * 400_exists: group already a member of ref
    * 404_ref: ref does not exist

    """
    client = await spawn_client(authenticated=True)

    group_1 = await fake2.groups.create()
    group_2 = await fake2.groups.create()

    if error != "404":
        await client.mongo.references.insert_one(
            {
                "_id": "foo",
                "created_at": static_time.datetime,
                "data_type": "genome",
                "description": "This is a test reference.",
                "groups": [
                    {
                        "id": group_2.id if error == "400_exists" else group_1.id,
                        "build": True,
                        "created_at": static_time.datetime,
                        "modify": True,
                        "modify_otu": True,
                        "remove": True,
                    }
                ],
                "name": "Test",
                "organism": "virus",
                "restrict_source_types": False,
                "source_types": [],
                "user": {"id": client.user.id},
                "users": [],
            }
        )

    resp = await client.post(
        "/refs/foo/groups",
        {"group_id": 21 if error == "400_dne" else group_2.id, "modify": True},
    )

    match error:
        case None:
            assert resp.status == 201
            assert await resp.json() == snapshot
            assert await client.mongo.references.find_one() == snapshot
        case "404":
            await resp_is.not_found(resp)
        case "400_dne":
            await resp_is.bad_request(resp, "Group does not exist")
        case "400_exists":
            await resp_is.bad_request(resp, "Group already exists")


@pytest.mark.parametrize("error", [None, "404_ref", "404_user"])
async def test_update_user(
    error: str | None,
    fake2: DataFaker,
    resp_is,
    snapshot: SnapshotAssertion,
    spawn_client: ClientSpawner,
    static_time,
):
    client = await spawn_client(authenticated=True)

    user = await fake2.users.create()

    if error != "404_ref":
        await client.mongo.references.insert_one(
            {
                "_id": "foo",
                "created_at": static_time.datetime,
                "data_type": "genome",
                "description": "This is a test reference.",
                "groups": [],
                "name": "Test",
                "organism": "virus",
                "restrict_source_types": False,
                "source_types": [],
                "user": {"id": client.user.id},
                "users": [
                    {
                        "id": client.user.id,
                        "build": True,
                        "created_at": static_time.datetime,
                        "modify": True,
                        "modify_otu": True,
                        "remove": True,
                    },
                    {
                        "id": user.id,
                        "build": False,
                        "created_at": static_time.datetime,
                        "modify": False,
                        "modify_otu": True,
                        "remove": False,
                    },
                ],
            }
        )

    resp = await client.patch(
        f"/refs/foo/users/{'non_existent' if error == '404_user' else user.id}",
        {"modify": True},
    )

    match error:
        case None:
            assert resp.status == 200
            assert await resp.json() == snapshot
            assert await client.mongo.references.find_one() == snapshot
        case ("404_field", "404_ref"):
            await resp_is.not_found(resp)


@pytest.mark.apitest
@pytest.mark.parametrize(
    "error",
    [None, "404_group", "404_ref"],
)
async def test_update_group(
    error: str | None,
    fake2: DataFaker,
    resp_is,
    snapshot,
    spawn_client: ClientSpawner,
    static_time,
):
    client = await spawn_client(authenticated=True)

    group = await fake2.groups.create()

    if error != "404_ref":
        await client.mongo.references.insert_one(
            {
                "_id": "foo",
                "created_at": static_time.datetime,
                "data_type": "genome",
                "description": "This is a test reference.",
                "groups": [
                    {
                        "id": group.id,
                        "build": False,
                        "created_at": static_time.datetime,
                        "modify": False,
                        "modify_otu": False,
                        "remove": False,
                    },
                ],
                "name": "Test",
                "organism": "virus",
                "restrict_source_types": False,
                "source_types": [],
                "user": {"id": client.user.id},
                "users": [
                    {
                        "id": client.user.id,
                        "build": True,
                        "created_at": static_time.datetime,
                        "modify": True,
                        "modify_otu": True,
                        "remove": True,
                    },
                ],
            }
        )

    resp = await client.patch(
        f"/refs/foo/groups/{21 if error == '404_group' else group.id}",
        {"modify_otu": True},
    )

    match error:
        case None:
            assert resp.status == 200
            assert await resp.json() == snapshot(name="resp")
            assert await client.mongo.references.find_one() == snapshot(name="mongo")
        case ("404_group", "404_ref"):
            await resp_is.not_found(resp)


@pytest.mark.apitest
@pytest.mark.parametrize(
    "error",
    [None, "404_ref", "404_user"],
)
async def test_delete_user(
    error: str | None,
    fake2: DataFaker,
    resp_is,
    snapshot: SnapshotAssertion,
    spawn_client: ClientSpawner,
    static_time,
):
    client = await spawn_client(authenticated=True)

    user = await fake2.users.create()

    if error != "404_ref":
        await client.mongo.references.insert_one(
            {
                "_id": "foo",
                "created_at": static_time.datetime,
                "data_type": "genome",
                "description": "This is a test reference.",
                "groups": [],
                "name": "Test",
                "organism": "virus",
                "restrict_source_types": False,
                "source_types": [],
                "user": {"id": client.user.id},
                "users": [
                    {
                        "id": client.user.id,
                        "build": True,
                        "created_at": static_time.datetime,
                        "modify": True,
                        "modify_otu": True,
                        "remove": True,
                    },
                    {
                        "id": user.id,
                        "build": False,
                        "created_at": static_time.datetime,
                        "modify": False,
                        "modify_otu": False,
                        "remove": False,
                    },
                ],
            }
        )

    resp = await client.delete(
        f"/refs/foo/users/{21 if error == '404_user' else user.id}"
    )

    if error:
        await resp_is.not_found(resp)
    else:
        assert resp.status == 204
        assert await client.mongo.references.find_one() == snapshot(name="mongo")


@pytest.mark.apitest
@pytest.mark.parametrize("error", [None, "404_group", "404_ref"])
async def test_delete_group(
    error: str | None,
    fake2: DataFaker,
    resp_is,
    snapshot: SnapshotAssertion,
    spawn_client: ClientSpawner,
    static_time,
):
    client = await spawn_client(authenticated=True)

    group = await fake2.groups.create()

    if error != "404_ref":
        await client.mongo.references.insert_one(
            {
                "_id": "foo",
                "created_at": static_time.datetime,
                "data_type": "genome",
                "description": "This is a test reference.",
                "groups": [
                    {
                        "id": group.id,
                        "build": False,
                        "created_at": static_time.datetime,
                        "modify": False,
                        "modify_otu": False,
                        "remove": False,
                    }
                ],
                "name": "Test",
                "organism": "virus",
                "restrict_source_types": False,
                "source_types": [],
                "user": {"id": client.user.id},
                "users": [
                    {
                        "id": client.user.id,
                        "build": True,
                        "created_at": static_time.datetime,
                        "modify": True,
                        "modify_otu": True,
                        "remove": True,
                    }
                ],
            }
        )

    resp = await client.delete(
        f"/refs/foo/groups/{21 if error == '404_group' else group.id}"
    )

    if error:
        await resp_is.not_found(resp)
    else:
        assert resp.status == 204
        assert await client.mongo.references.find_one() == snapshot


@pytest.mark.apitest
@pytest.mark.parametrize("find", [None, "Prunus", "virus", "PVF", "VF"])
@pytest.mark.parametrize("verified", [None, True, False])
async def test_find_otus(
    find: str | None,
    verified: bool | None,
    snapshot: SnapshotAssertion,
    spawn_client: ClientSpawner,
):
    """
    Test to check that the api returns the correct OTUs based on how the results are
    filtered.
    """

    client = await spawn_client(authenticated=True)

    await asyncio.gather(
        client.mongo.references.insert_one(
            {"_id": "foo", "name": "Foo", "data_type": "genome"}
        ),
        client.mongo.otus.insert_many(
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
        ),
    )

    query = []

    if find is not None:
        query.append(f"find={find}")

    if verified is not None:
        query.append(f"verified={verified}")

    path = "/refs/foo/otus"

    if query:
        path = f"{path}?{'&'.join(query)}"

    resp = await client.get(path)

    assert resp.status == 200
    assert await resp.json() == snapshot
