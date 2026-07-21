from virtool.api.errors import APINoContent
from virtool.api.routes import Routes
from virtool.data.utils import get_data_from_app, get_data_from_req
from virtool.fake.next import DataFaker
from virtool.identifier import RandomIdProvider
from virtool.uploads.sql import UploadType

routes = Routes()


@routes.post("/dev")
async def dev(request):
    data = await request.json()
    command = data.get("command")
    app = request.app

    if command == "create_subtraction":
        layer = get_data_from_app(app)
        pg = app["pg"]
        storage = app["storage"]

        fake = DataFaker(layer, pg, storage, RandomIdProvider())

        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
            name="foobar.fq.gz",
        )

        await fake.subtractions.create(user=user, upload=upload)

    if command == "force_delete_jobs":
        await get_data_from_req(request).jobs.force_delete()

    raise APINoContent()
