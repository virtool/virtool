from logging import getLogger

from virtool.api.response import no_content
from virtool.http.routes import Routes

logger = getLogger(__name__)

routes = Routes()


@routes.post("/api/dev")
async def dev(req):
    data = await req.json()

    command = data.get("command")

    if command == "clear_users":
        await req.app["db"].users.delete_many({})
        await req.app["db"].sessions.delete_many({})
        await req.app["db"].keys.delete_many({})

        logger.debug("Cleared users")

    return no_content()
