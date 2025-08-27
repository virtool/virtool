from pathlib import Path

from aiohttp.web import FileResponse, RouteTableDef, View

from tests.fixtures.workflow_api.utils import generate_not_found
from virtool.workflow.pytest_plugin.data import WorkflowData


def create_uploads_routes(data: WorkflowData, example_path: Path):
    routes = RouteTableDef()

    @routes.view("/uploads/{upload_id}")
    class HMMFilesView(View):
        async def get(self):
            upload_id = int(self.request.match_info["upload_id"])

            if upload_id == 1:
                return FileResponse(
                    example_path / "sample" / "reads_1.fq.gz",
                    headers={
                        "Content-Disposition": "attachment; filename='reads_1.fq.gz'",
                        "Content-Type": "application/octet-stream",
                    },
                )

            if upload_id == 2:
                return FileResponse(
                    example_path / "sample" / "reads_2.fq.gz",
                    headers={
                        "Content-Disposition": "attachment; filename='reads_2.fq.gz'",
                        "Content-Type": "application/octet-stream",
                    },
                )

            if upload_id == 3:
                return FileResponse(
                    example_path
                    / "subtractions"
                    / "arabidopsis_thaliana"
                    / "subtraction.fa.gz",
                    headers={
                        "Content-Disposition": "attachment; filename='subtraction.fa.gz'",
                        "Content-Type": "application/octet-stream",
                    },
                )

            return generate_not_found()

    return routes
