from pathlib import Path

from aiohttp.web import RouteTableDef, View
from aiohttp.web_fileresponse import FileResponse
from aiohttp.web_response import json_response

from tests.fixtures.workflow_api.utils import custom_dumps, generate_not_found
from virtool.workflow.pytest_plugin.data import WorkflowData


def create_ml_routes(data: WorkflowData, example_path: Path):
    routes = RouteTableDef()

    @routes.view("/ml/{model_id}/releases/{release_id}")
    class MLView(View):
        async def get(self):
            model_id = int(self.request.match_info["model_id"])
            release_id = int(self.request.match_info["release_id"])

            if model_id == data.ml.model.id and release_id == data.ml.id:
                return json_response(data.ml.dict(), status=200, dumps=custom_dumps)

            return generate_not_found()

    @routes.view("/ml/{model_id}/releases/{release_id}/model.tar.gz")
    class MLFileView(View):
        async def get(self):
            model_id = int(self.request.match_info["model_id"])
            release_id = int(self.request.match_info["release_id"])

            if model_id == data.ml.model.id and release_id == data.ml.id:
                return FileResponse(
                    example_path / "ml" / "model.tar.gz",
                    headers={
                        "Content-Disposition": "attachment; filename='model.tar.gz'",
                        "Content-Type": "application/octet-stream",
                    },
                )

            return generate_not_found()

    return routes
