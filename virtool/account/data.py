from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from structlog import get_logger

from virtool.account.models import APIKey
from virtool.account.sql import SQLAPIKey
from virtool.data.domain import DataLayerDomain
from virtool.data.errors import ResourceNotFoundError
from virtool.utils import hash_key

logger = get_logger(layer="data", domain="account")


class AccountData(DataLayerDomain):
    name = "account"

    def __init__(
        self,
        pg: AsyncEngine,
    ):
        self._pg = pg

    async def get_key_by_secret(self, user_id: int, key: str) -> APIKey:
        """Get the complete representation of the API key with secret value ``key``.

        The secret key is not returned in the result.

        :param user_id: the user id
        :param key: the raw API key
        :return: the API key
        """
        user = await self.data.users.get(user_id)

        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                select(SQLAPIKey).where(
                    SQLAPIKey.user_id == user_id,
                    SQLAPIKey.hashed == hash_key(key),
                ),
            )
            api_key = result.scalar_one_or_none()

        if api_key is None:
            raise ResourceNotFoundError

        return APIKey(
            id=api_key.id,
            created_at=api_key.created_at,
            groups=sorted(user.groups, key=lambda group: group.name),
            name=api_key.name,
            permissions=api_key.permissions,
        )
