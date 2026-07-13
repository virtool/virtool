from http import HTTPStatus

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.utils
from tests.fixtures.client import VirtoolTestClient
from virtool.mongo.core import Mongo
from virtool.references.sql import (
    SQLReference,
    SQLReferenceGroup,
    SQLReferenceUser,
)


async def seed_reference(
    mongo: Mongo,
    pg: AsyncEngine,
    legacy_id: str,
    user_id: int,
    *,
    name: str = "Reference",
    archived: bool = False,
    **fields,
) -> int:
    """Seed a reference into Mongo and Postgres and return its primary key.

    Reference reads come from Postgres, so a Mongo-only reference is invisible to the
    data layer. Mongo fields not mirrored to Postgres may be passed as ``fields``.

    :return: the integer ``legacy_references.id`` of the seeded reference
    """
    created_at = fields.pop("created_at", None) or virtool.utils.timestamp()
    source_types = fields.pop("source_types", [])
    description = fields.pop("description", "")
    organism = fields.pop("organism", "")

    await mongo.references.insert_one(
        {
            "_id": legacy_id,
            "archived": archived,
            "created_at": created_at,
            "data_type": "genome",
            "description": description,
            "name": name,
            "organism": organism,
            "source_types": source_types,
            "user": {"id": user_id},
            **fields,
        },
    )

    async with AsyncSession(pg) as session:
        reference = SQLReference(
            legacy_id=legacy_id,
            name=name,
            description=description,
            organism=organism,
            created_at=created_at,
            archived=archived,
            source_types=source_types,
            user_id=user_id,
        )

        session.add(reference)
        await session.flush()

        reference_pk = reference.id

        for member in fields.get("users", []):
            session.add(
                SQLReferenceUser(
                    reference_id=reference_pk,
                    user_id=member["id"],
                    build=member.get("build", False),
                    modify=member.get("modify", False),
                    modify_otu=member.get("modify_otu", False),
                ),
            )

        for group in fields.get("groups", []):
            session.add(
                SQLReferenceGroup(
                    reference_id=reference_pk,
                    group_id=group["id"],
                    build=group.get("build", False),
                    modify=group.get("modify", False),
                    modify_otu=group.get("modify_otu", False),
                ),
            )

        await session.commit()

    return reference_pk


async def create_reference(
    client: VirtoolTestClient,
    name: str = "Test Reference",
) -> dict:
    """Create a reference through the API and return the response body.

    The creating user becomes the reference owner and is granted the ``build``,
    ``modify``, and ``modify_otu`` rights on it. The client must have the
    ``create_ref`` permission.

    :param client: the client that will own the reference
    :param name: the name of the reference
    :return: the created reference
    """
    resp = await client.post("/references/v1", {"name": name})

    assert resp.status == HTTPStatus.CREATED

    return await resp.json()


async def add_reference_user(
    client: VirtoolTestClient,
    ref_id: int | str,
    user_id: int,
    *,
    build: bool = False,
    modify: bool = False,
    modify_otu: bool = False,
) -> dict:
    """Add a user to a reference with the passed rights, through the API.

    Rights default to ``False``, which makes the user a member that can read the
    reference but modify nothing.

    The ``client`` must hold the ``modify`` right on the reference or be an
    administrator.

    :param client: the client that will make the request
    :param ref_id: the id of the reference to add the user to
    :param user_id: the id of the user to add
    :param build: whether the user may build indexes
    :param modify: whether the user may modify the reference
    :param modify_otu: whether the user may modify the reference's OTUs
    :return: the created reference user
    """
    resp = await client.post(
        f"/references/v1/{ref_id}/users",
        {
            "user_id": user_id,
            "build": build,
            "modify": modify,
            "modify_otu": modify_otu,
        },
    )

    assert resp.status == HTTPStatus.CREATED

    return await resp.json()


@pytest.fixture
def test_ref():
    return {
        "_id": "hxn167",
        "archived": False,
        "data_type": "genome",
        "groups": [],
        "name": "Reference A",
        "source_types": ["isolate", "strain"],
        "users": [],
    }


@pytest.fixture
def reference(static_time):
    return {
        "_id": "3tt0w336",
        "archived": False,
        "created_at": static_time.datetime,
        "data_type": "genome",
        "description": "",
        "name": "Original",
        "organism": "virus",
        "restrict_source_types": False,
        "source_types": ["isolate", "strain"],
        "groups": [],
        "users": [
            {
                "id": "igboyes",
                "build": True,
                "modify": True,
                "modify_otu": True,
                "remove": True,
            },
        ],
        "user": {"id": "igboyes"},
        "imported_from": {
            "name": "reference.json.gz",
            "user": {"id": "igboyes"},
            "id": "knoqfdk9-reference.json.gz",
        },
        "task": {"id": "flv0gecl"},
    }
