import aiohttp.web
import pytest
from aiohttp.test_utils import make_mocked_coro
from pytest_mock import MockerFixture
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.utils
from virtool.mongo.core import Mongo
from virtool.references.sql import SQLReference


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

        await session.commit()

    return reference_pk


@pytest.fixture(params=[True, False])
def check_ref_right(mocker: MockerFixture, request):
    mock = mocker.patch(
        "virtool.references.db.check_right",
        make_mocked_coro(request.param),
    )

    mock.__bool__ = lambda x: request.param

    mock.called_with_req = lambda: isinstance(mock.call_args[0][0], aiohttp.web.Request)

    return mock


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
