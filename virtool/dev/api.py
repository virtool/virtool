from virtool.api.errors import APINoContent
from virtool.api.routes import Routes
from virtool.data.utils import get_data_from_app, get_data_from_req
from virtool.fake.next import DataFaker
from virtool.mongo.utils import get_mongo_from_app, get_mongo_from_req
from virtool.samples.fake import create_fake_sample
from virtool.uploads.models import UploadType
from virtool.utils import random_alphanumeric

routes = Routes()


@routes.post("/dev")
async def dev(req):
    data = await req.json()
    command = data.get("command")
    app = req.app

    if command == "clear_users":
        mongo = get_mongo_from_req(req)

        await mongo.users.delete_many({})
        await mongo.sessions.delete_many({})
        await mongo.keys.delete_many({})

    if command == "create_subtraction":
        layer = get_data_from_app(app)
        mongo = get_mongo_from_app(app)
        pg = app["pg"]

        fake = DataFaker(layer, mongo, pg)

        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
            name="foobar.fq.gz",
        )

        await fake.subtractions.create(user=user, upload=upload)

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
