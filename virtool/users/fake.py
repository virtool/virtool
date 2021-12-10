from logging import getLogger

import virtool.users.db
from virtool.types import App

logger = getLogger(__name__)


async def create_fake_bob_user(app: App):
    """
    Create a fake user called Bob.

    :param app: the application object

    """
    user_document = await virtool.users.db.create(app["db"], "hello_world", "bob", True)
    await virtool.users.db.edit(app["db"], user_document["_id"], administrator=True, force_reset=False)
    logger.debug("Created fake user")
    return user_document
