from http import HTTPStatus
from pathlib import Path
from unittest.mock import ANY

import pytest
from aiohttp.test_utils import make_mocked_coro
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion
from syrupy.matchers import path_type

import virtool.utils
from tests.fixtures.client import ClientSpawner, VirtoolTestClient
from tests.fixtures.references import add_reference_user, create_reference
from tests.fixtures.response import RespIs
from virtool.data.layer import DataLayer
from virtool.data.topg import both_transactions
from virtool.fake.next import DataFaker
from virtool.history.sql import SQLLegacyHistory
from virtool.indexes.sql import SQLIndex
from virtool.jobs.pg import SQLJob
from virtool.models.enums import Permission
from virtool.mongo.core import Mongo
from virtool.otus.oas import (
    CreateOTURequest,
)
from virtool.references.db import write_legacy_reference
from virtool.references.models import ReferenceDataType
from virtool.references.oas import CreateReferenceRequest, CreateReferenceUserRequest
from virtool.references.sql import SQLReference, SQLReferenceGroup, SQLReferenceUser
from virtool.settings.oas import UpdateSettingsRequest
from virtool.tasks.sql import SQLTask
from virtool.users.oas import UpdateUserRequest
from virtool.workflow.pytest_plugin.utils import StaticTime

FULL_RIGHTS = {"build": True, "modify": True, "modify_otu": True}


async def seed_pg_reference(
    pg: AsyncEngine,
    legacy_id: str,
    user_id: int,
    created_at,
    *,
    name: str | None = None,
    users: list[tuple[int, dict]] | None = None,
    groups: list[tuple[int, dict]] | None = None,
) -> None:
    """Insert a ``legacy_references`` row plus optional user and group rights rows."""
    async with AsyncSession(pg) as session:
        reference = SQLReference(
            legacy_id=legacy_id,
            name=name or legacy_id,
            description="",
            created_at=created_at,
            source_types=[],
            user_id=user_id,
        )
        session.add(reference)
        await session.flush()

        reference_id = reference.id

        for member_id, rights in users or []:
            session.add(
                SQLReferenceUser(
                    reference_id=reference_id,
                    user_id=member_id,
                    **rights,
                ),
            )

        for group_id, rights in groups or []:
            session.add(
                SQLReferenceGroup(
                    reference_id=reference_id,
                    group_id=group_id,
                    **rights,
                ),
            )

        await session.commit()


async def insert_reference(mongo: Mongo, pg: AsyncEngine, document: dict) -> None:
    """Insert a reference into Mongo and mirror it (row and rights) into Postgres.

    Requires a full reference ``document`` (with ``created_at``, ``description`` and
    ``organism``) whose members are real integer user and group ids.
    """
    async with both_transactions(mongo, pg) as (mongo_session, pg_session):
        await mongo.references.insert_one(document, session=mongo_session)
        await write_legacy_reference(pg_session, document)


@pytest.mark.parametrize(
    ("archived", "expected_ids"),
    [
        (
            None,
            {
                "owned_active",
                "user_member_active",
                "group_member_active",
                "owned_archived",
            },
        ),
        (True, {"owned_archived"}),
        (
            False,
            {"owned_active", "user_member_active", "group_member_active"},
        ),
    ],
    ids=["default", "archived", "active"],
)
async def test_find(
    archived: bool | None,
    expected_ids: set[str],
    data_layer: DataLayer,
    fake: DataFaker,
    pg: AsyncEngine,
    snapshot,
    mongo: Mongo,
    spawn_client: ClientSpawner,
    static_time,
):
    """The ``archived`` query param toggles between both states (default),
    archived-only, and active-only references the user can read.

    The ``other_active`` and ``other_archived`` references are owned by a
    different user and never visible to the client, proving the rights filter
    still applies regardless of the lifecycle filter.
    """
    client = await spawn_client(authenticated=True)

    group = await fake.groups.create()
    user = await fake.users.create()
    await data_layer.users.update(client.user.id, UpdateUserRequest(groups=[group.id]))

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
            ],
        )
        await session.commit()

    for document in [
        {
            "_id": "owned_active",
            "archived": False,
            "created_at": static_time.datetime,
            "data_type": "genome",
            "description": "",
            "groups": [],
            "name": "Owned Active",
            "organism": "virus",
            "restrict_source_types": False,
            "task": {"id": 1},
            "user": {"id": client.user.id},
        },
        {
            "_id": "other_active",
            "archived": False,
            "created_at": static_time.datetime,
            "data_type": "genome",
            "description": "",
            "groups": [],
            "name": "Other Active",
            "organism": "virus",
            "restrict_source_types": True,
            "task": {"id": 2},
            "user": {"id": user.id},
        },
        {
            "_id": "user_member_active",
            "archived": False,
            "created_at": static_time.datetime,
            "data_type": "genome",
            "description": "",
            "groups": [],
            "name": "User Member Active",
            "organism": "virus",
            "restrict_source_types": True,
            "task": {"id": 2},
            "user": {"id": user.id},
            "users": [{"id": client.user.id}],
        },
        {
            "_id": "group_member_active",
            "archived": False,
            "created_at": static_time.datetime,
            "data_type": "genome",
            "description": "",
            "groups": [{"id": group.id}],
            "name": "Group Member Active",
            "organism": "virus",
            "restrict_source_types": True,
            "task": {"id": 2},
            "user": {"id": user.id},
            "users": [],
        },
        {
            "_id": "owned_archived",
            "archived": True,
            "created_at": static_time.datetime,
            "data_type": "genome",
            "description": "",
            "groups": [],
            "name": "Owned Archived",
            "organism": "virus",
            "restrict_source_types": False,
            "task": {"id": 1},
            "user": {"id": client.user.id},
        },
        {
            "_id": "other_archived",
            "archived": True,
            "created_at": static_time.datetime,
            "data_type": "genome",
            "description": "",
            "groups": [],
            "name": "Other Archived",
            "organism": "virus",
            "restrict_source_types": True,
            "task": {"id": 2},
            "user": {"id": user.id},
        },
    ]:
        await insert_reference(mongo, pg, document)

    url = "/references/v1"
    if archived is not None:
        url = f"{url}?archived={archived}"

    resp = await client.get(url)
    body = await resp.json()

    async with AsyncSession(pg) as session:
        reference_pks = dict(
            (
                await session.execute(
                    select(SQLReference.legacy_id, SQLReference.id),
                )
            ).all(),
        )

    assert resp.status == HTTPStatus.OK
    assert body == snapshot
    assert {d["id"] for d in body["documents"]} == {
        reference_pks[legacy_id] for legacy_id in expected_ids
    }


async def test_find_archived_invalid(spawn_client: ClientSpawner):
    """An invalid ``archived`` value yields a 400 with Pydantic detail."""
    client = await spawn_client(authenticated=True)

    resp = await client.get("/references/v1?archived=foo")

    assert resp.status == HTTPStatus.BAD_REQUEST


async def test_find_attaches_latest_build(
    fake: DataFaker,
    spawn_client: ClientSpawner,
):
    """Each reference in the list carries its own highest-versioned ready build,
    with the build user resolved.
    """
    client = await spawn_client(authenticated=True, administrator=True)

    user = await fake.users.create()

    expected_build_ids = {}
    for _ in range(3):
        reference = await fake.references.create(user=user)
        await fake.indexes.create(reference, user, version=0, ready=True)
        latest = await fake.indexes.create(reference, user, version=1, ready=True)
        expected_build_ids[reference.id] = latest.id

    resp = await client.get("/references/v1")

    assert resp.status == HTTPStatus.OK

    body = await resp.json()

    assert {
        document["id"]: document["latest_build"]["id"] for document in body["documents"]
    } == expected_build_ids

    for document in body["documents"]:
        assert document["latest_build"]["version"] == 1
        assert document["latest_build"]["user"] == {
            "id": user.id,
            "handle": user.handle,
        }


class TestGet:
    async def test_ok(
        self,
        data_layer: DataLayer,
        mongo: Mongo,
        spawn_client,
        pg,
        snapshot,
        fake: DataFaker,
        static_time,
    ):
        client = await spawn_client(authenticated=True, administrator=True)

        user_1 = await fake.users.create()
        user_2 = await fake.users.create()

        reference = await data_layer.references.create(
            CreateReferenceRequest(
                name="Bar",
                organism="virus",
                data_type=ReferenceDataType.genome,
            ),
            client.user.id,
        )

        await data_layer.references.create_user(
            reference.id, CreateReferenceUserRequest(user_id=user_1.id)
        )

        resp = await client.get(f"/references/v1/{reference.id}")

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot

    async def test_not_found(self, spawn_client: ClientSpawner):
        client = await spawn_client(authenticated=True, administrator=True)

        response = await client.get("/references/v1/bar")

        assert response.status == HTTPStatus.NOT_FOUND


class TestCreate:
    async def test_ok(
        self,
        data_layer: DataLayer,
        snapshot_recent,
        spawn_client: ClientSpawner,
    ):
        client = await spawn_client(
            authenticated=True,
            base_url="https://virtool.example.com",
            permissions=[Permission.create_ref],
        )

        default_source_type = ["strain", "isolate"]

        await data_layer.settings.update(
            UpdateSettingsRequest(default_source_types=default_source_type),
        )

        response = await client.post(
            "/references/v1",
            {
                "name": "Test Viruses",
                "description": "A bunch of viruses used for testing",
                "data_type": "genome",
                "organism": "virus",
            },
        )

        assert response.status == HTTPStatus.CREATED
        assert response.headers["Location"] == snapshot_recent(name="location")
        assert await response.json() == snapshot_recent(name="resp")

    @pytest.mark.flaky(reruns=2)
    async def test_import(
        self,
        example_path: Path,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
        static_time: StaticTime,
    ):
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_ref, Permission.upload_file],
        )

        with open(example_path / "indexes/reference.json.gz", "rb") as f:
            resp = await client.post_form(
                "/uploads?upload_type=reference&name=reference.json.gz&type=reference",
                data={"file": f},
            )

        upload = await resp.json()

        resp = await client.post(
            "/references/v1",
            {"name": "Test Viruses", "import_from": upload["id"]},
        )

        body = await resp.json()

        assert resp.status == 201
        assert body == snapshot(
            matcher=path_type({"id": (int,)}, regex=True),
        )

    async def test_clone(
        self,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        spawn_client: ClientSpawner,
        snapshot: SnapshotAssertion,
        static_time,
    ):
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_ref],
        )

        user_1 = await fake.users.create()
        user_2 = await fake.users.create()

        await insert_reference(
            mongo,
            pg,
            {
                "_id": "foo",
                "archived": False,
                "created_at": static_time.datetime,
                "data_type": "genome",
                "description": "",
                "name": "Foo",
                "organism": "virus",
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
                    },
                ],
            },
        )

        resp = await client.post(
            "/references/v1",
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


class TestEdit:
    @staticmethod
    async def _insert_reference(
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        static_time,
    ) -> None:
        user_1 = await fake.users.create()
        user_2 = await fake.users.create()
        user_3 = await fake.users.create()

        await insert_reference(
            mongo,
            pg,
            {
                "_id": "foo",
                "archived": False,
                "created_at": static_time.datetime,
                "data_type": "genome",
                "description": "",
                "name": "Foo",
                "organism": "virus",
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
                    },
                    {
                        "id": user_3.id,
                        "created_at": static_time.datetime,
                        "build": True,
                        "modify": True,
                        "modify_otu": True,
                    },
                ],
            },
        )

    async def test_ok(
        self,
        fake: DataFaker,
        snapshot,
        mongo: Mongo,
        pg: AsyncEngine,
        spawn_client: ClientSpawner,
        static_time,
    ):
        """An administrator edits a reference they do not own."""
        client = await spawn_client(authenticated=True, administrator=True)

        await self._insert_reference(fake, mongo, pg, static_time)

        resp = await client.patch(
            "/references/v1/foo",
            {"name": "Bar", "description": "This is a test reference."},
        )

        assert await resp.json() == snapshot(name="resp")

    async def test_insufficient_rights(
        self,
        fake: DataFaker,
        resp_is,
        mongo: Mongo,
        pg: AsyncEngine,
        spawn_client: ClientSpawner,
        static_time,
    ):
        """A user with no rights on the reference cannot edit it."""
        client = await spawn_client(authenticated=True)

        await self._insert_reference(fake, mongo, pg, static_time)

        resp = await client.patch(
            "/references/v1/foo",
            {"name": "Bar", "description": "This is a test reference."},
        )

        await resp_is.insufficient_rights(resp)

    async def test_not_found(
        self,
        resp_is,
        spawn_client: ClientSpawner,
    ):
        """Editing a reference that does not exist returns 404."""
        client = await spawn_client(authenticated=True)

        resp = await client.patch(
            "/references/v1/foo",
            {"name": "Bar", "description": "This is a test reference."},
        )

        await resp_is.not_found(resp)


class TestArchive:
    async def test_ok(
        self,
        snapshot_recent: SnapshotAssertion,
        spawn_client: ClientSpawner,
    ):
        """The reference owner archives their own reference."""
        owner = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_ref],
        )
        reference = await create_reference(owner)

        resp = await owner.post(f"/references/v1/{reference['id']}/archive", {})

        assert resp.status == 200
        body = await resp.json()
        assert body["archived"] is True
        assert body == snapshot_recent(name="resp")

    async def test_already_archived(self, spawn_client: ClientSpawner):
        """Archiving an already-archived reference leaves it archived."""
        owner = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_ref],
        )
        reference = await create_reference(owner)

        await owner.post(f"/references/v1/{reference['id']}/archive", {})
        resp = await owner.post(f"/references/v1/{reference['id']}/archive", {})

        assert resp.status == 200
        assert (await resp.json())["archived"] is True

    async def test_group_rights(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        spawn_client: ClientSpawner,
    ):
        """A member of a group granted modify rights can archive the reference."""
        owner = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_ref],
        )
        reference = await create_reference(owner)

        group = await fake.groups.create()
        member = await spawn_client(authenticated=True)
        await data_layer.users.update(
            member.user.id,
            UpdateUserRequest(groups=[group.id]),
        )

        await owner.post(
            f"/references/v1/{reference['id']}/groups",
            {"group_id": group.id, "modify": True},
        )

        resp = await member.post(f"/references/v1/{reference['id']}/archive", {})

        assert resp.status == 200
        assert (await resp.json())["archived"] is True

    async def test_administrator(self, spawn_client: ClientSpawner):
        """A full administrator can archive a reference it does not own."""
        owner = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_ref],
        )
        reference = await create_reference(owner)

        administrator = await spawn_client(authenticated=True, administrator=True)

        resp = await administrator.post(f"/references/v1/{reference['id']}/archive", {})

        assert resp.status == 200
        assert (await resp.json())["archived"] is True

    async def test_insufficient_rights(
        self,
        resp_is: RespIs,
        spawn_client: ClientSpawner,
    ):
        """A user with no rights on the reference cannot archive it, and the
        reference stays active.
        """
        owner = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_ref],
        )
        reference = await create_reference(owner)

        other = await spawn_client(authenticated=True)

        resp = await other.post(f"/references/v1/{reference['id']}/archive", {})

        await resp_is.insufficient_rights(resp)

        resp = await owner.get(f"/references/v1/{reference['id']}")
        assert (await resp.json())["archived"] is False

    async def test_not_found(self, resp_is: RespIs, spawn_client: ClientSpawner):
        """Archiving a nonexistent reference returns 404."""
        client = await spawn_client(authenticated=True)

        resp = await client.post("/references/v1/999999/archive", {})

        await resp_is.not_found(resp)


class TestUnarchive:
    async def test_ok(
        self,
        snapshot_recent: SnapshotAssertion,
        spawn_client: ClientSpawner,
    ):
        """The reference owner unarchives their own archived reference."""
        owner = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_ref],
        )
        reference = await create_reference(owner)
        await owner.post(f"/references/v1/{reference['id']}/archive", {})

        resp = await owner.post(f"/references/v1/{reference['id']}/unarchive", {})

        assert resp.status == 200
        body = await resp.json()
        assert body["archived"] is False
        assert body == snapshot_recent(name="resp")

    async def test_already_active(self, spawn_client: ClientSpawner):
        """Unarchiving a reference that is not archived leaves it active."""
        owner = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_ref],
        )
        reference = await create_reference(owner)

        resp = await owner.post(f"/references/v1/{reference['id']}/unarchive", {})

        assert resp.status == 200
        assert (await resp.json())["archived"] is False

    async def test_insufficient_rights(
        self,
        resp_is: RespIs,
        spawn_client: ClientSpawner,
    ):
        """A user with no rights on the reference cannot unarchive it, and the
        reference stays archived.
        """
        owner = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_ref],
        )
        reference = await create_reference(owner)
        await owner.post(f"/references/v1/{reference['id']}/archive", {})

        other = await spawn_client(authenticated=True)

        resp = await other.post(f"/references/v1/{reference['id']}/unarchive", {})

        await resp_is.insufficient_rights(resp)

        resp = await owner.get(f"/references/v1/{reference['id']}")
        assert (await resp.json())["archived"] is True

    async def test_not_found(self, resp_is: RespIs, spawn_client: ClientSpawner):
        """Unarchiving a nonexistent reference returns 404."""
        client = await spawn_client(authenticated=True)

        resp = await client.post("/references/v1/999999/unarchive", {})

        await resp_is.not_found(resp)


class TestCreateOTU:
    @pytest.mark.parametrize("abbreviation", [None, "TMV", ""])
    @pytest.mark.parametrize("error", [None, "403", "404"])
    async def test(
        self,
        abbreviation: str | None,
        error: str | None,
        data_layer: DataLayer,
        mongo: Mongo,
        pg: AsyncEngine,
        resp_is: RespIs,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
        static_time: StaticTime,
    ):
        """Test that a valid request results in the creation of a otu document and a
        ``201`` response.
        """
        client = await spawn_client(
            authenticated=True,
            base_url="https://virtool.example.com",
        )

        if error != "404":
            await seed_pg_reference(
                pg,
                "foo",
                client.user.id,
                static_time.datetime,
                name="Foo",
                users=[] if error == "403" else [(client.user.id, FULL_RIGHTS)],
            )
            await mongo.references.insert_one(
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
                        },
                    ],
                },
            )

        data = {"name": "Tobacco mosaic virus"}

        if abbreviation is not None:
            data["abbreviation"] = abbreviation

        resp = await client.post("/references/v1/foo/otus", data)

        match error:
            case None:
                assert resp.status == 201
                assert (
                    resp.headers["Location"]
                    == "https://virtool.example.com/otus/bf1b993c"
                )
                body = await resp.json()
                assert body == snapshot(name="resp")

                assert await data_layer.otus.get(body["id"]) == snapshot(name="otu")

                assert await data_layer.history.get(
                    body["most_recent_change"]["id"],
                ) == snapshot(
                    name="history",
                )

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
        mongo: Mongo,
        pg: AsyncEngine,
        spawn_client: ClientSpawner,
        static_time,
    ):
        """Test that the request fails with ``409 Conflict`` if the requested otu name
        already exists.
        """
        # Pass name and abbreviation check.
        m_check_name_and_abbreviation = mocker.patch(
            "virtool.otus.db.check_name_and_abbreviation",
            make_mocked_coro(message),
        )

        client = await spawn_client(authenticated=True)

        if error != "404":
            await seed_pg_reference(
                pg,
                "foo",
                client.user.id,
                static_time.datetime,
                users=[(client.user.id, FULL_RIGHTS)],
            )
            await mongo.references.insert_one(
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
                        },
                    ],
                },
            )

        resp = await client.post(
            "/references/v1/foo/otus",
            {"name": "Tobacco mosaic virus", "abbreviation": "TMV"},
        )

        if error is None:
            assert resp.status == 201
            # Abbreviation defaults to empty string for OTU creation.
            m_check_name_and_abbreviation.assert_called_with(
                ANY,
                "foo",
                "Tobacco mosaic virus",
                "TMV",
            )
        elif error == "404":
            await resp_is.not_found(resp)
        else:
            await resp_is.bad_request(resp, message)


class TestCreateIndex:
    async def test_ok(
        self,
        mocker,
        mongo: Mongo,
        pg: AsyncEngine,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
        static_time,
    ):
        """Test that the reference owner, who holds the ``build`` right, can build an
        index.
        """
        client = await spawn_client(
            authenticated=True,
            base_url="https://virtool.example.com",
            permissions=[Permission.create_ref],
        )

        reference = await create_reference(client, name="Foo")

        # Insert unbuilt changes to prevent initial check failure.
        await mongo.history.insert_one(
            {
                "_id": "history_1",
                "index": {"id": "unbuilt", "version": "unbuilt"},
                "reference": {"id": reference["id"]},
                "user": {"id": client.user.id},
            },
        )

        async with AsyncSession(pg) as session:
            session.add(
                SQLLegacyHistory(
                    legacy_id="history_1",
                    created_at=static_time.datetime,
                    description="Description",
                    method_name="create",
                    user_id=client.user.id,
                    otu="otu_1",
                    otu_name="Tobacco mosaic virus",
                    otu_version="0",
                    reference_id=reference["id"],
                    index=None,
                ),
            )
            await session.commit()

        m_create_manifest = mocker.patch(
            "virtool.references.db.get_manifest",
            new=make_mocked_coro({"foo": 2, "bar": 5}),
        )

        resp = await client.post(f"/references/v1/{reference['id']}/indexes", {})

        assert resp.status == 201
        assert await resp.json() == snapshot

        body = await resp.json()
        assert body["ready"] is False
        assert body["job"] is None
        assert "task" not in body

        async with AsyncSession(pg) as session:
            new_index = await session.scalar(
                select(SQLIndex).where(SQLIndex.id == int(body["id"])),
            )

            assert new_index is not None
            assert new_index.legacy_id is None
            assert new_index.job_id is None
            assert new_index.task_id is not None

            task = await session.scalar(
                select(SQLTask).where(SQLTask.id == new_index.task_id),
            )
            history = await session.scalar(
                select(SQLLegacyHistory).where(
                    SQLLegacyHistory.legacy_id == "history_1",
                ),
            )

            assert task is not None
            assert task.type == "create_index"
            assert task.context == {"index_id": str(new_index.id)}
            assert history is not None
            assert history.index_id == new_index.id
            assert await session.scalar(select(SQLJob.id)) is None

        m_create_manifest.assert_called_with(ANY, reference["id"])

    async def test_insufficient_rights(
        self,
        mongo: Mongo,
        resp_is,
        spawn_client: ClientSpawner,
    ):
        """Test that a reference member without the ``build`` right cannot build an
        index.
        """
        owner = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_ref],
        )

        reference = await create_reference(owner, name="Foo")

        client = await spawn_client(authenticated=True)

        await add_reference_user(owner, reference["id"], client.user.id)

        resp = await client.post(f"/references/v1/{reference['id']}/indexes", {})

        await resp_is.insufficient_rights(resp)


@pytest.mark.parametrize("error", [None, "400_dne", "400_exists", "404"])
async def test_create_user(
    error: str | None,
    fake: DataFaker,
    resp_is,
    snapshot: SnapshotAssertion,
    mongo: Mongo,
    pg: AsyncEngine,
    spawn_client: ClientSpawner,
    static_time,
):
    """Test that the group or user is added to the reference when no error condition
    exists.

    Test for the following error conditions:
    * 404: ref does not exist
    * 400_exists: group or user already exists in ref
    * 400_dne: group or user does not exist

    """
    client = await spawn_client(authenticated=True)

    user = await fake.users.create()

    document = {
        "_id": "foo",
        "archived": False,
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
            },
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
            },
        )

    # Don't insert the ref document if we want to trigger a 404.
    if error != "404":
        await insert_reference(mongo, pg, document)

    resp = await client.post(
        "/references/v1/foo/users",
        {"user_id": 99999 if error == "400_dne" else user.id, "modify": True},
    )

    match error:
        case None:
            assert resp.status == 201
            assert await resp.json() == snapshot(name="resp")
        case "404":
            await resp_is.not_found(resp)
        case "400_dne":
            await resp_is.bad_request(resp, "User does not exist")
        case "400_exists":
            await resp_is.bad_request(resp, "User already exists")


@pytest.mark.parametrize("error", [None, "400_dne", "400_exists", "404"])
async def test_create_group(
    error: str | None,
    fake: DataFaker,
    resp_is,
    snapshot: SnapshotAssertion,
    mongo: Mongo,
    pg: AsyncEngine,
    spawn_client: ClientSpawner,
    static_time,
):
    """Test that a group is added to the reference when no error condition exists.

    * 400_dne: user group does not exist
    * 400_exists: group already a member of ref
    * 404_ref: ref does not exist

    """
    client = await spawn_client(authenticated=True)

    group_1 = await fake.groups.create()
    group_2 = await fake.groups.create()

    if error != "404":
        await insert_reference(
            mongo,
            pg,
            {
                "_id": "foo",
                "archived": False,
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
                    },
                ],
                "name": "Test",
                "organism": "virus",
                "restrict_source_types": False,
                "source_types": [],
                "user": {"id": client.user.id},
                "users": [],
            },
        )

    resp = await client.post(
        "/references/v1/foo/groups",
        {"group_id": 21 if error == "400_dne" else group_2.id, "modify": True},
    )

    match error:
        case None:
            assert resp.status == 201
            assert await resp.json() == snapshot
        case "404":
            await resp_is.not_found(resp)
        case "400_dne":
            await resp_is.bad_request(resp, "Group does not exist")
        case "400_exists":
            await resp_is.bad_request(resp, "Group already exists")


class TestUpdateUser:
    @pytest.fixture(autouse=True)
    async def setup(
        self,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        spawn_client: ClientSpawner,
        static_time,
    ) -> None:
        self.client = await spawn_client(authenticated=True)
        self.user = await fake.users.create()
        self.mongo = mongo
        self.static_time = static_time

        await insert_reference(
            mongo,
            pg,
            {
                "_id": "foo",
                "archived": False,
                "created_at": static_time.datetime,
                "data_type": "genome",
                "description": "This is a test reference.",
                "groups": [],
                "name": "Test",
                "organism": "virus",
                "restrict_source_types": False,
                "source_types": [],
                "user": {"id": self.client.user.id},
                "users": [
                    {
                        "id": self.client.user.id,
                        "build": True,
                        "created_at": static_time.datetime,
                        "modify": True,
                        "modify_otu": True,
                    },
                    {
                        "id": self.user.id,
                        "build": False,
                        "created_at": static_time.datetime,
                        "modify": False,
                        "modify_otu": True,
                    },
                ],
            },
        )

    async def test_ok(self, snapshot: SnapshotAssertion):
        resp = await self.client.patch(
            f"/references/v1/foo/users/{self.user.id}",
            {"modify": True},
        )

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot

    async def test_ref_not_found(self, resp_is):
        resp = await self.client.patch(
            f"/references/v1/non_existent_ref/users/{self.user.id}",
            {"modify": True},
        )

        await resp_is.not_found(resp)

    async def test_user_not_found(self, resp_is):
        resp = await self.client.patch(
            "/references/v1/foo/users/99999",
            {"modify": True},
        )

        await resp_is.not_found(resp)


@pytest.mark.parametrize(
    "error",
    [None, "404_group", "404_ref"],
)
async def test_update_group(
    error: str | None,
    fake: DataFaker,
    resp_is,
    snapshot,
    mongo: Mongo,
    pg: AsyncEngine,
    spawn_client: ClientSpawner,
    static_time,
):
    client = await spawn_client(authenticated=True)

    group = await fake.groups.create()

    if error != "404_ref":
        await insert_reference(
            mongo,
            pg,
            {
                "_id": "foo",
                "archived": False,
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
                    },
                ],
            },
        )

    resp = await client.patch(
        f"/references/v1/foo/groups/{21 if error == '404_group' else group.id}",
        {"modify_otu": True},
    )

    match error:
        case None:
            assert resp.status == HTTPStatus.OK
            assert await resp.json() == snapshot(name="resp")
        case "404_group" | "404_ref":
            await resp_is.not_found(resp)


class TestDeleteUser:
    @pytest.fixture(autouse=True)
    async def setup(
        self,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        spawn_client: ClientSpawner,
        static_time,
    ) -> None:
        self.client = await spawn_client(authenticated=True)
        self.user = await fake.users.create()
        self.mongo = mongo
        self.static_time = static_time
        await insert_reference(
            mongo,
            pg,
            {
                "_id": "foo",
                "archived": False,
                "created_at": static_time.datetime,
                "data_type": "genome",
                "description": "This is a test reference.",
                "groups": [],
                "name": "Test",
                "organism": "virus",
                "restrict_source_types": False,
                "source_types": [],
                "user": {"id": self.client.user.id},
                "users": [
                    {
                        "id": self.client.user.id,
                        "build": True,
                        "created_at": static_time.datetime,
                        "modify": True,
                        "modify_otu": True,
                    },
                    {
                        "id": self.user.id,
                        "build": False,
                        "created_at": static_time.datetime,
                        "modify": False,
                        "modify_otu": False,
                    },
                ],
            },
        )

    async def test_ok(self):
        resp = await self.client.delete(f"/references/v1/foo/users/{self.user.id}")
        assert resp.status == 204

    async def test_ref_not_found(self, resp_is):
        resp = await self.client.delete(
            f"/references/v1/non_existent_ref/users/{self.user.id}"
        )
        await resp_is.not_found(resp)

    async def test_user_not_found(self, resp_is):
        resp = await self.client.delete("/references/v1/foo/users/21")
        await resp_is.not_found(resp)


@pytest.mark.parametrize("error", [None, "404_group", "404_ref"])
async def test_delete_group(
    error: str | None,
    fake: DataFaker,
    resp_is,
    mongo: Mongo,
    pg: AsyncEngine,
    spawn_client: ClientSpawner,
    static_time,
):
    client = await spawn_client(authenticated=True)

    group = await fake.groups.create()

    if error != "404_ref":
        await insert_reference(
            mongo,
            pg,
            {
                "_id": "foo",
                "archived": False,
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
                    },
                ],
            },
        )

    resp = await client.delete(
        f"/references/v1/foo/groups/{21 if error == '404_group' else group.id}",
    )

    if error:
        await resp_is.not_found(resp)
    else:
        assert resp.status == 204


@pytest.mark.parametrize("find", [None, "Prunus", "virus", "PVF", "VF"])
@pytest.mark.parametrize("verified", [None, True, False])
async def test_find_otus(
    find: str | None,
    verified: bool | None,
    fake: DataFaker,
    insert_otu,
    pg: AsyncEngine,
    snapshot: SnapshotAssertion,
    mongo: Mongo,
    spawn_client: ClientSpawner,
):
    """Test to check that the api returns the correct OTUs based on how the results are
    filtered.
    """
    client = await spawn_client(authenticated=True)

    user = await fake.users.create()

    async with AsyncSession(pg) as session:
        reference = SQLReference(
            legacy_id="foo",
            name="Foo",
            description="",
            created_at=virtool.utils.timestamp(),
            source_types=[],
            user_id=user.id,
        )
        session.add(reference)
        await session.flush()

        reference_id = reference.id

        await session.commit()

    await mongo.references.insert_one(
        {"_id": "foo", "name": "Foo", "data_type": "genome"},
    )

    await insert_otu(
        {
            "_id": "6116cba1",
            "name": "Prunus virus F",
            "abbreviation": "PVF",
            "last_indexed_version": None,
            "verified": True,
            "lower_name": "prunus virus f",
            "isolates": [],
            "version": 0,
            "schema": [],
        },
        reference_id,
    )

    await insert_otu(
        {
            "_id": "5316cbz2",
            "name": "Papaya virus q",
            "abbreviation": "P",
            "last_indexed_version": None,
            "verified": False,
            "lower_name": "papaya virus q",
            "isolates": [],
            "version": 0,
            "schema": [],
        },
        reference_id,
    )

    query = []

    if find is not None:
        query.append(f"find={find}")

    if verified is not None:
        query.append(f"verified={verified}")

    path = "/references/v1/foo/otus"

    if query:
        path = f"{path}?{'&'.join(query)}"

    resp = await client.get(path)

    assert resp.status == HTTPStatus.OK
    assert await resp.json() == snapshot


class TestFindHistory:
    """Test the reference history endpoint."""

    client: VirtoolTestClient
    reference_id: str

    @pytest.fixture(autouse=True)
    async def setup(
        self,
        data_layer: DataLayer,
        spawn_client: ClientSpawner,
    ):
        """Set up test data with reference, OTUs, isolates, and sequences."""
        self.client = await spawn_client(authenticated=True)

        reference = await data_layer.references.create(
            CreateReferenceRequest(
                name="Test Reference",
                organism="virus",
                data_type=ReferenceDataType.genome,
            ),
            self.client.user.id,
        )

        self.reference_id = reference.id

        otu_1 = await data_layer.otus.create(
            self.reference_id,
            CreateOTURequest(name="Tobacco mosaic virus", abbreviation="TMV"),
            self.client.user.id,
        )

        otu_2 = await data_layer.otus.create(
            self.reference_id,
            CreateOTURequest(name="Potato virus X", abbreviation="PVX"),
            self.client.user.id,
        )

        otu_3 = await data_layer.otus.create(
            self.reference_id,
            CreateOTURequest(name="Cucumber mosaic virus"),
            self.client.user.id,
        )

        isolate = await data_layer.otus.add_isolate(
            otu_1.id,
            "isolate",
            "strain_1",
            self.client.user.id,
        )

        await data_layer.otus.create_sequence(
            otu_1.id,
            isolate.id,
            "NC_001367",
            "Tobacco mosaic virus complete genome",
            "ATGCGTACGTACGTACGTACGTACGTACGTACG",
            self.client.user.id,
        )

    async def test_ok(self, snapshot_recent: SnapshotAssertion):
        """Test successful history retrieval."""
        resp = await self.client.get(f"/references/v1/{self.reference_id}/history")

        assert resp.status == HTTPStatus.OK
        body = await resp.json()

        assert len(body["documents"]) == body["found_count"] == body["total_count"] == 5
        assert body["page_count"] == 1

        assert body == snapshot_recent

    async def test_unbuilt_filter(self):
        """Test history with unbuilt filter."""
        resp = await self.client.get(
            f"/references/v1/{self.reference_id}/history?unbuilt=true"
        )

        assert resp.status == HTTPStatus.OK
        body = await resp.json()
        assert len(body["documents"]) == body["found_count"] == 5
        assert body["total_count"] == 5

    async def test_built_filter(self):
        """Test history with built filter."""
        resp = await self.client.get(
            f"/references/v1/{self.reference_id}/history?unbuilt=false"
        )

        assert resp.status == HTTPStatus.OK
        body = await resp.json()
        assert len(body["documents"]) == body["found_count"] == 0
        assert body["total_count"] == 5

    async def test_not_found(self):
        """Test 404 for non-existent reference."""
        resp = await self.client.get("/references/v1/nonexistent/history")

        assert resp.status == HTTPStatus.NOT_FOUND


class TestArchivedReferenceRejectsWrites:
    """User-driven writes against archived references must return 409."""

    @pytest.fixture
    async def archived_ref(
        self,
        spawn_client: ClientSpawner,
    ) -> tuple[VirtoolTestClient, int]:
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_ref],
        )

        reference = await create_reference(client)

        resp = await client.post(f"/references/v1/{reference['id']}/archive", {})

        assert resp.status == HTTPStatus.OK

        return client, reference["id"]

    async def test_patch(
        self,
        archived_ref: tuple[VirtoolTestClient, int],
        resp_is: RespIs,
    ):
        client, ref_id = archived_ref

        resp = await client.patch(f"/references/v1/{ref_id}", {"name": "Bar"})

        await resp_is.conflict(resp, "Reference is archived")

    async def test_create_otu(
        self,
        archived_ref: tuple[VirtoolTestClient, int],
        resp_is: RespIs,
    ):
        client, ref_id = archived_ref

        resp = await client.post(
            f"/references/v1/{ref_id}/otus",
            {"name": "Tobacco mosaic virus"},
        )

        await resp_is.conflict(resp, "Reference is archived")

    async def test_create_index(
        self,
        archived_ref: tuple[VirtoolTestClient, int],
        resp_is: RespIs,
    ):
        client, ref_id = archived_ref

        resp = await client.post(f"/references/v1/{ref_id}/indexes", {})

        await resp_is.conflict(resp, "Reference is archived")


async def test_archived_reference_allows_user_rights_update(
    fake: DataFaker,
    spawn_client: ClientSpawner,
):
    """Rights-management routes are unaffected by the archived guard (D5)."""
    client = await spawn_client(
        authenticated=True,
        permissions=[Permission.create_ref],
    )

    reference = await create_reference(client)

    await client.post(f"/references/v1/{reference['id']}/archive", {})

    user = await fake.users.create()

    resp = await client.post(
        f"/references/v1/{reference['id']}/users",
        {"user_id": user.id, "modify": True},
    )

    assert resp.status == HTTPStatus.CREATED
