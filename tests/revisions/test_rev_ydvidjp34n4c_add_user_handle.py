import re

import pytest
from syrupy.filters import props

from assets.revisions.rev_ydvidjp34n4c_add_user_handle import upgrade
from virtool.migration import MigrationContext


@pytest.mark.parametrize("user", ["ad_user", "existing_user", "user_with_handle"])
async def test_upgrade(ctx: MigrationContext, snapshot, user):
    document = {"_id": "abc123"}

    if user == "ad_user":
        document.update({"b2c_given_name": "foo", "b2c_family_name": "bar"})

    if user == "user_with_handle":
        document["handle"] = "bar"

    await ctx.mongo.users.insert_one(document)

    await upgrade(ctx)

    document = await ctx.mongo.users.find_one({"_id": "abc123"})

    if user == "ad_user":
        if "handle" in document:
            assert re.match(r"foo-bar-\d+", document["handle"])

        assert document == snapshot(exclude=props("handle"))
    else:
        assert document == snapshot
