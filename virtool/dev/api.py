from virtool.api.errors import APINoContent
from virtool.api.routes import Routes
from virtool.data.utils import get_data_from_req
from virtool.mongo.utils import get_mongo_from_req
from virtool.samples.fake import create_fake_sample
from virtool.subtractions.fake import (
    create_fake_finalized_subtraction,
)
from virtool.utils import random_alphanumeric

routes = Routes()


@routes.post("/dev")
async def dev(req):
    data = await req.json()
    command = data.get("command")

    if command == "clear_users":
        mongo = get_mongo_from_req(req)

        await mongo.users.delete_many({})
        await mongo.sessions.delete_many({})
        await mongo.keys.delete_many({})

    if command == "create_subtraction":
        await create_fake_finalized_subtraction(req.app)

    if command == "create_sample":
        await create_fake_sample(
            req.app,
            random_alphanumeric(8),
            req["client"].user_id,
            False,
            True,
        )

    if command == "force_delete_jobs":
        await get_data_from_req(req).jobs.force_delete()

    raise APINoContent()
