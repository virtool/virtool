import pytest
from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.data.errors import ResourceNotFoundError
from virtool.history.data import HistoryData
from virtool.mongo.core import Mongo


async def test_get_not_found(mongo: Mongo, pg: AsyncEngine):
    """A change id with no ``legacy_history`` row raises ``ResourceNotFoundError``.

    The happy path is covered end-to-end by the detail endpoint test in
    ``tests/history/test_api.py``.
    """
    with pytest.raises(ResourceNotFoundError):
        await HistoryData(mongo, pg).get("6116cba1.1")
