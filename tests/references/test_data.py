import pytest
from aiohttp.test_utils import make_mocked_coro

from virtool.data.utils import get_data_from_app


# async def test_create_manifest(dbi, test_otu, app, data_layer):
#     await dbi.otus.insert_many(
#         [
#             test_otu,
#             dict(test_otu, _id="foo", version=5),
#             dict(test_otu, _id="baz", version=3, reference={"id": "123"}),
#             dict(test_otu, _id="bar", version=11),
#         ]
#     )
#     app["data"] = data_layer
#
#     assert await get_data_from_app(app).references.get_manifest("hxn167") == {
#         "6116cba1": 0,
#         "foo": 5,
#         "bar": 11,
#     }

