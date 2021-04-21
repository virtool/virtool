from logging import getLogger

import virtool.users.db
from virtool.fake.identifiers import USER_ID
from virtool.types import App

logger = getLogger(__name__)


async def create_fake_bob_user(app: App):
    """
    Create a fake user called Bob.

    :param app: the application object

    """
    await virtool.users.db.create(app["db"], USER_ID, "hello_world", True)
    await virtool.users.db.edit(app["db"], "bob", administrator=True, force_reset=False)
    logger.debug("Created fake user")