
from virtool.api.errors import APINoContent
from virtool.data.utils import get_data_from_req
from virtool.api.routes import Routes
from virtool.samples.fake import create_fake_sample
from virtool.subtractions.fake import (
    create_fake_fasta_upload,
    create_fake_finalized_subtraction,
)
from virtool.utils import random_alphanumeric

routes = Routes()


@routes.post("/dev")
async def dev(req):
    data = await req.json()
    user_id = req["client"].user_id
    command = data.get("command")

    if command == "clear_users":
        await req.app["db"].users.delete_many({})
        await req.app["db"].sessions.delete_many({})
        await req.app["db"].keys.delete_many({})

    if command == "create_subtraction":
        upload_id, upload_name = await create_fake_fasta_upload(
            req.app, req["client"].user_id
        )

        await create_fake_finalized_subtraction(
            req.app, upload_id, upload_name, random_alphanumeric(8), user_id
        )

    if command == "create_sample":
        await create_fake_sample(
            req.app, random_alphanumeric(8), req["client"].user_id, False, True
        )

    if command == "force_delete_jobs":
        await get_data_from_req(req).jobs.force_delete()

    raise APINoContent()
