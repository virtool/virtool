"""Request handlers for querying and downloading machine learning models."""
from aiohttp.web_fileresponse import FileResponse
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r404

from virtool.api.response import json_response
from virtool.data.utils import get_data_from_req
from virtool.http.routes import Routes
from virtool.ml.models import MLModel, MLModelListResult

routes = Routes()


@routes.view("/ml")
class MLModelsView(PydanticView):
    async def get(self) -> r200[MLModelListResult]:
        """
        List models.

        Lists all available machine learning models.

        The `last_checked_at` field is the time at which the list of models was last
        refreshed from www.virtool.ca.
        """
        search_result = await get_data_from_req(self.request).ml.list()
        return json_response(search_result)


@routes.view("/ml/{model_id}")
class MLModelView(PydanticView):
    async def get(self, model_id: int, /) -> r200[MLModel] | r404:
        """
        Get a model.

        Fetches the details of a machine learning model, including all of its releases.

        The `releases` field comprises a list of all releases of the model that can be
        downloaded.
        """
        model = await get_data_from_req(self.request).ml.get(model_id)
        return json_response(model)


@routes.view("/ml/{model_id}/releases/{release_id}/model.tar.gz")
class MLModelFileView(PydanticView):
    async def get(self, release_id: int, /) -> r200[bytes] | r404:
        """
        Download a model release.

        Downloads the archived model release.
        """
        file_descriptor = await get_data_from_req(self.request).ml.download_release(
            release_id
        )

        return FileResponse(
            file_descriptor.path,
            headers={
                "Content-Disposition": "attachment; filename='model.tar.gz'",
                "Content-Type": "application/octet-stream",
            },
        )
