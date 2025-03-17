from pydantic import BaseModel

from virtool.api.errors import APINoContent
from virtool.api.routes import Routes
from virtool.api.status import R204
from virtool.api.view import APIView
from virtool.fake.next import DataFaker
from virtool.mongo.utils import get_mongo_from_req
from virtool.samples.fake import create_fake_sample
from virtool.uploads.models import UploadType
from virtool.utils import random_alphanumeric

routes = Routes()


class DevRequest(BaseModel):
    """A request for development operations."""

    command: str


@routes.web.view("/dev")
class DevView(APIView):
    async def get(self, data: DevRequest) -> R204:
        """Perform development operation.

        Takes a `command` and performs the corresponding operation. This endpoint is
        only available in development mode.
        """
        app = self.request.app
        mongo = get_mongo_from_req(self.request)
        pg = app["pg"]

        if data.command == "clear_users":
            await mongo.users.delete_many({})
            await mongo.sessions.delete_many({})
            await mongo.keys.delete_many({})

        if data.command == "create_subtraction":
            fake = DataFaker(self.data, mongo, pg)

            user = await fake.users.create()

            upload = await fake.uploads.create(
                user=user,
                upload_type=UploadType.subtraction,
                name="foobar.fq.gz",
            )

            await fake.subtractions.create(user=user, upload=upload)

        if data.command == "create_sample":
            await create_fake_sample(
                app,
                random_alphanumeric(8),
                self.request["client"].user_id,
                False,
                True,
            )

        if data.command == "force_delete_jobs":
            await self.data.jobs.force_delete()

        raise APINoContent()
