from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.administrators.actions import get_action_from_name
from virtool.authorization.client import AuthorizationClient
from virtool.data.domain import DataLayerDomain
from virtool.mongo.core import Mongo

PROJECTION = (
    "_id",
    "active",
    "administrator_role",
    "force_reset",
    "groups",
    "handle",
    "last_password_change",
    "permissions",
    "primary_group",
)


class AdministratorsData(DataLayerDomain):
    name = "administrators"

    def __init__(
        self,
        authorization_client: AuthorizationClient,
        mongo: Mongo,
        pg: AsyncEngine,
    ):
        self._authorization_client = authorization_client
        self._mongo = mongo
        self._pg = pg

    async def run_action(self, name: str):
        """Run an action

        Runs an action with the given name.

        :param name: the name of the action to run
        :return: the result of the action
        """
        return await get_action_from_name(name).run(self.data)
