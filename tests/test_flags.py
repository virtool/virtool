import pytest
from virtool.flags import (
    FF_ADMINISTRATOR_ROLES,
    FF_SPACES,
    check_flag_enabled,
    FeatureFlags,
)


def test_check_flag_enabled():
    FeatureFlags.flags = ["FF_ML_MODELS"]

    assert check_flag_enabled("FF_ADMINISTRATOR_ROLES") == FF_ADMINISTRATOR_ROLES
    assert check_flag_enabled("FF_ML_MODELS") is True
    assert check_flag_enabled("FF_SPACES") == FF_SPACES


# @pytest.mark.apitest
# async def test_404(fake2, spawn_client):
#     """
#     Test that the route does not get registered
#
#     Add @flag("FF_SPACES") to the Labels view class with @routes.view("/spaces/{space_id}/labels")
#     when FF_SPACES is False. This breaks the tests that use the route in labels/test_api.py
#     """
#     client = await spawn_client(authorize=True, administrator=True)
#
#     label_1 = await fake2.labels.create()
#     label_2 = await fake2.labels.create()
#
#     await client.db.samples.insert_many(
#         [
#             {
#                 "_id": "foo",
#                 "name": "Foo",
#                 "labels": [
#                     label_1.id,
#                 ],
#             },
#             {"_id": "bar", "name": "Bar", "labels": [label_1.id, label_2.id]},
#             {"_id": "baz", "name": "Baz", "labels": [label_2.id]},
#         ],
#         session=None,
#     )
#
#     resp = await client.get("/spaces/{space_id}/labels")
#
#     assert resp.status == 404


@pytest.mark.apitest
async def test_200(spawn_client):
    """
    Test that the route gets registered
    """
    client = await spawn_client(authorize=True, administrator=True)

    resp = await client.get("/admin/roles")

    assert resp.status == 200
