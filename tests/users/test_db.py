import hashlib

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.errors import ResourceConflictError
from virtool.groups.pg import SQLGroup
from virtool.mongo.core import Mongo
from virtool.users.db import (
    compose_groups_update,
)
from virtool.users.mongo import (
    validate_credentials,
)
from virtool.users.utils import hash_password
from virtool.utils import random_alphanumeric


@pytest.mark.parametrize(
    "user_id,password,result",
    [
        ("test", "foobar", True),
        ("baz", "foobar", False),
        ("test", "baz", False),
        ("baz", "baz", False),
    ],
)
@pytest.mark.parametrize("legacy", [True, False])
async def test_validate_credentials(
    legacy: bool, user_id: str, password: str, result: bool, mongo: Mongo
):
    """Test that valid, bcrypt-based credentials work."""
    document = {"_id": "test"}

    if legacy:
        salt = random_alphanumeric(24)

        document.update(
            {
                "salt": salt,
                "password": hashlib.sha512(
                    salt.encode("utf-8") + b"foobar"
                ).hexdigest(),
            }
        )
    else:
        document["password"] = hash_password("foobar")

    await mongo.users.insert_one(document)

    assert await validate_credentials(mongo, user_id, password) is result
