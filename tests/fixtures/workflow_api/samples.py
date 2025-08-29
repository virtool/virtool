import tempfile
from pathlib import Path

from aiohttp.web import FileResponse, RouteTableDef, View, json_response

from tests.fixtures.workflow_api.utils import (
    custom_dumps,
    generate_not_found,
)
from virtool.samples.models import Quality
from virtool.workflow.pytest_plugin import WorkflowData


def create_samples_routes(
    data: WorkflowData, example_path: Path, read_file_from_multipart
):
    routes = RouteTableDef()

    @routes.view("/samples/{sample_id}")
    class SampleView(View):
        async def get(self):
            """Get the JSON representation of a sample."""
            sample_id = self.request.match_info["sample_id"]

            if sample_id not in (data.sample.id, data.new_sample.id):
                return generate_not_found()

            sample = data.sample if sample_id == data.sample.id else data.new_sample

            return json_response(sample.dict(), status=200, dumps=custom_dumps)

        async def patch(self):
            """Finalize a new sample."""
            sample_id = self.request.match_info["sample_id"]

            if sample_id != data.new_sample.id:
                return generate_not_found()

            if data.new_sample.ready:
                return json_response(
                    {"id": "conflict", "message": "Sample already finalized"},
                    status=409,
                )

            quality_json = await self.request.json()

            data.new_sample.quality = Quality(**quality_json["quality"])
            data.new_sample.ready = True

            return json_response(data.sample.dict(), dumps=custom_dumps)

        async def delete(self):
            sample_id = self.request.match_info["sample_id"]

            try:
                new_sample_id = data.new_sample.id
            except AttributeError:
                new_sample_id = None

            if sample_id != new_sample_id:
                return generate_not_found()

            if data.new_sample.ready:
                return json_response(
                    {
                        "id": "conflict",
                        "message": "Sample already finalized.",
                    },
                    status=409,
                )

            data.new_sample = None

            return json_response({}, status=204)

    @routes.view("/samples/{sample_id}/artifacts")
    class SampleArtifactsView(View):
        async def get(self):
            sample_id = self.request.match_info["sample_id"]
            filename = self.request.match_info["filename"]
            safe_filename = Path(filename).name

            if sample_id != data.sample.id:
                return generate_not_found()

            tempdir = Path(tempfile.mkdtemp())

            file = tempdir / safe_filename
            file.touch()

            return FileResponse(file)

        async def post(self):
            sample_id = self.request.match_info["sample_id"]

            if sample_id != data.sample.id:
                return generate_not_found()

            multipart = await self.request.multipart()

            file = await read_file_from_multipart(
                self.request.query.get("name"),
                multipart,
                self.request.query.get("type"),
            )

            return json_response(file, status=201)

    @routes.view("/samples/{sample_id}/reads/{filename}")
    class SampleReadsView(View):
        async def get(self):
            filename = self.request.match_info["filename"]
            id_ = self.request.match_info["sample_id"]

            if id_ != data.sample.id or filename not in (
                "reads_1.fq.gz",
                "reads_2.fq.gz",
            ):
                return generate_not_found()

            return FileResponse(
                example_path / "sample" / filename,
                headers={
                    "Content-Disposition": f"attachment; filename={filename}",
                    "Content-Type": "application/octet-stream",
                },
            )

        async def put(self):
            id_ = self.request.match_info["sample_id"]
            name = self.request.match_info["filename"]

            if id_ != data.new_sample.id:
                return generate_not_found()

            multipart = await self.request.multipart()

            file = await read_file_from_multipart(name, multipart)

            return json_response(file, status=201, dumps=custom_dumps)

    return routes
