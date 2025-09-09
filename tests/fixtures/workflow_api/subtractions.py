from pathlib import Path

from aiohttp.web import Response, RouteTableDef, View, json_response
from aiohttp.web_fileresponse import FileResponse

from tests.fixtures.workflow_api.utils import (
    custom_dumps,
    generate_not_found,
    read_file_from_request,
)
from virtool.subtractions.models import NucleotideComposition
from virtool.workflow.pytest_plugin.data import WorkflowData
from virtool.workflow.pytest_plugin.utils import SUBTRACTION_FILENAMES


def create_subtractions_routes(
    data: WorkflowData,
    example_path: Path,
    read_file_from_multipart,
):
    routes = RouteTableDef()

    @routes.view("/subtractions/{subtraction_id}")
    class SubtractionView(View):
        async def get(self):
            """Return the JSON representation of a subtraction that can be used for testing
            analysis fixtures.
            """
            subtraction_id = self.request.match_info["subtraction_id"]

            if subtraction_id not in (data.subtraction.id, data.new_subtraction.id):
                return generate_not_found()

            subtraction = (
                data.subtraction
                if subtraction_id == data.subtraction.id
                else data.new_subtraction
            )

            return json_response(subtraction.dict(), status=200, dumps=custom_dumps)

        async def patch(self):
            """Finalize a subtraction with its ``gc`` and ``count`` field with the passed
            data. Set ``ready`` to ``true``.
            """
            subtraction_id = self.request.match_info["subtraction_id"]

            if subtraction_id != data.new_subtraction.id:
                return generate_not_found()

            if data.new_subtraction.ready is True:
                return json_response(
                    {"id": "conflict", "message": "Subtraction already finalized."},
                    status=409,
                )

            request_json = await self.request.json()

            data.new_subtraction.count = request_json["count"]
            data.new_subtraction.gc = NucleotideComposition(
                **{"n": 0.0, **request_json["gc"]},
            )
            data.new_subtraction.ready = True

            return json_response(
                data.new_subtraction.dict(),
                status=200,
                dumps=custom_dumps,
            )

        async def delete(self):
            """Delete the subtraction."""
            subtraction_id = self.request.match_info["subtraction_id"]

            if subtraction_id != data.new_subtraction.id:
                return generate_not_found()

            if data.new_subtraction.ready is True:
                return json_response(
                    {"id": "conflict", "message": "Subtraction already finalized."},
                    status=409,
                )

            data.new_subtraction = None

            return Response(status=204)

    @routes.view("/subtractions/{subtraction_id}/files/{filename}")
    class SubtractionFilesView(View):
        async def get(self):
            subtraction_id = self.request.match_info["subtraction_id"]
            filename = self.request.match_info["filename"]

            if (
                subtraction_id != data.subtraction.id
                or filename not in SUBTRACTION_FILENAMES
            ):
                return generate_not_found()

            return FileResponse(
                example_path / "subtractions" / "arabidopsis_thaliana" / filename,
                headers={
                    "Content-Disposition": f"attachment; filename='{filename}'",
                    "Content-Type": "application/octet-stream",
                },
                status=200,
            )

        async def put(self):
            """Upload a subtraction file. For use during subtraction creation."""
            name = self.request.match_info["filename"]

            if name not in SUBTRACTION_FILENAMES:
                return json_response({"message": "Unsupported file name."}, status=400)

            return json_response(
                await read_file_from_request(self.request, name, "bt2"),
                status=201,
                dumps=custom_dumps,
            )

    return routes
