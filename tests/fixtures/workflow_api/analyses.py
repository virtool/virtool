from pathlib import Path

from aiohttp.web import Response, RouteTableDef, View, json_response

from tests.fixtures.workflow_api.utils import (
    custom_dumps,
    generate_not_found,
)
from virtool.workflow.pytest_plugin.data import WorkflowData


def create_analyses_routes(
    data: WorkflowData, example_path: Path, read_file_from_multipart
):
    routes = RouteTableDef()

    @routes.view("/analyses/{analysis_id}")
    class AnalysisView(View):
        async def get(self):
            id_ = self.request.match_info["analysis_id"]

            if id_ == data.analysis.id:
                return json_response(
                    data.analysis.dict(), status=200, dumps=custom_dumps
                )

            return generate_not_found()

        async def patch(self):
            analysis_id = self.request.match_info["analysis_id"]

            if analysis_id != data.analysis.id:
                return generate_not_found()

            results = (await self.request.json())["results"]

            data.analysis.results = results

            return json_response(data.analysis.dict(), status=200, dumps=custom_dumps)

        async def delete(self):
            analysis_id = self.request.match_info["analysis_id"]

            if analysis_id != data.analysis.id:
                return generate_not_found()

            if data.analysis.ready is True:
                return json_response(
                    {
                        "id": "conflict",
                        "message": "Analysis is finalized",
                    },
                    status=409,
                )

            data.analysis = None

            return Response(status=204)

    @routes.view("/analyses/{analysis_id}/files")
    class AnalysisFilesView(View):
        async def post(self):
            name = self.request.query["name"]
            multipart = await self.request.multipart()

            analysis_file = await read_file_from_multipart(name, multipart)

            return json_response(
                analysis_file,
                status=201,
                dumps=custom_dumps,
            )

    return routes
