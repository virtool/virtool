"""Request handlers for querying and downloading machine learning models."""

from aiohttp.web_fileresponse import FileResponse
from virtool_core.models.ml import MLModel, MLModelListResult, MLModelReleaseMinimal

from virtool.api.custom_json import json_response
from virtool.api.errors import APINotFound
from virtool.api.routes import Routes
from virtool.api.status import R200, R404
from virtool.api.view import APIView
from virtool.data.errors import ResourceNotFoundError

routes = Routes()


@routes.web.view("/ml")
class MLModelsView(APIView):
    async def get(self) -> R200[MLModelListResult]:
        """List models.

        Lists all available machine learning models.

        The `last_checked_at` field is the time at which the list of models was last
        refreshed from www.virtool.ca.
        """
        search_result = await self.data.ml.list()
        return json_response(search_result)


@routes.web.view("/ml/{model_id}")
@routes.job.view("/ml/{model_id}")
class MLModelView(APIView):
    async def get(self, model_id: int, /) -> R200[MLModel] | R404:
        """Get a model.

        Fetches the details of a machine learning model, including all of its releases.

        The `releases` field comprises a list of all releases of the model that can be
        downloaded.
        """
        model = await self.data.ml.get(model_id)
        return json_response(model)


@routes.web.view("/ml/{model_id}/releases/{release_id}")
@routes.job.view("/ml/{model_id}/releases/{release_id}")
class MLModelReleaseView(APIView):
    async def get(self, release_id: int, /) -> R200[MLModelReleaseMinimal] | R404:
        """Get a model release.

        Fetches the details of a machine learning model release.
        """
        try:
            release = await self.data.ml.get_release(release_id)
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(release)


@routes.web.view("/ml/{model_id}/releases/{release_id}/model.tar.gz")
@routes.job.view("/ml/{model_id}/releases/{release_id}/model.tar.gz")
class MLModelFileView(APIView):
    async def get(self, release_id: int, /) -> R200[bytes] | R404:
        """Download a model release.

        Downloads the archived model release.
        """
        file_descriptor = await self.data.ml.download_release(
            release_id,
        )

        return FileResponse(
            file_descriptor.path,
            headers={
                "Content-Disposition": "attachment; filename=model.tar.gz",
                "Content-Type": "application/octet-stream",
            },
        )
