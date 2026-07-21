import pytest
from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.data.errors import ResourceNotFoundError
from virtool.history.data import HistoryData


async def test_get_not_found(pg: AsyncEngine):
    """A change id with no ``legacy_history`` row raises ``ResourceNotFoundError``.

    The happy path is covered end-to-end by the detail endpoint test in
    ``tests/history/test_api.py``.
    """
    with pytest.raises(ResourceNotFoundError):
        await HistoryData(pg).get("6116cba1.1")
