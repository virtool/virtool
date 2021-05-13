from logging import getLogger

from virtool.api.response import no_content
from virtool.fake.wrapper import FakerWrapper
from virtool.http.routes import Routes
from virtool.samples.fake import create_fake_sample
from virtool.subtractions.fake import create_fake_fasta_upload, create_fake_finalized_subtraction
from virtool.utils import random_alphanumeric

logger = getLogger(__name__)

routes = Routes()

faker = FakerWrapper()


@routes.post("/api/dev")
async def dev(req):
    data = await req.json()
    user_id = req["client"].user_id
    command = data.get("command")

    if command == "clear_users":
        await req.app["db"].users.delete_many({})
        await req.app["db"].sessions.delete_many({})
        await req.app["db"].keys.delete_many({})

        logger.debug("Cleared users")

    if command == "create_subtraction":
        upload_id, upload_name = await create_fake_fasta_upload(
            req.app,
            req["client"].user_id
        )

        await create_fake_finalized_subtraction(
            req.app,
            upload_id,
            upload_name,
            random_alphanumeric(8),
            user_id
        )

    if command == "create_sample":
        await create_fake_sample(
            req.app,
            random_alphanumeric(8),
            req["client"].user_id,
            False,
            True
        )

    return no_content()
