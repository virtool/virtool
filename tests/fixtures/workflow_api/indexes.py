import gzip
import json
from pathlib import Path

from aiohttp.web import FileResponse, Response, RouteTableDef, View, json_response

from tests.fixtures.workflow_api.utils import (
    custom_dumps,
    generate_not_found,
)
from virtool.indexes.db import (
    JOB_INDEX_FILE_NAMES,
    REFERENCE_JSON_V2_FILE_NAME,
)
from virtool.workflow.pytest_plugin.data import WorkflowData


def create_indexes_routes(
    data: WorkflowData,
    example_path: Path,
) -> RouteTableDef:
    with gzip.open(
        example_path / "indexes" / "reference.json.gz",
        "rt",
    ) as handle:
        reference_json_v2 = json.load(handle)

    reference_json_v2["_id"] = data.index.reference.id
    reference_json_v2["name"] = data.index.reference.name
    reference_json_v2 = gzip.compress(json.dumps(reference_json_v2).encode())

    routes = RouteTableDef()

    @routes.view("/indexes/{index_id}")
    class IndexView(View):
        async def get(self):
            index_id = int(self.request.match_info["index_id"])

            if index_id != data.index.id:
                return generate_not_found()

            return json_response(data.index.dict(), status=200, dumps=custom_dumps)

    @routes.view("/indexes/{index_id}/files/{filename}")
    class IndexFilesView(View):
        async def get(self):
            index_id = int(self.request.match_info["index_id"])
            filename = self.request.match_info["filename"]

            if filename == "otus.json.gz" and index_id == data.index.id:
                return FileResponse(
                    example_path / "indexes" / filename,
                    headers={
                        "Content-Disposition": f"attachment; filename='{filename}'",
                        "Content-Type": "application/octet-stream",
                    },
                )

            if index_id == data.index.id:
                available_files = {file.name for file in data.index.files}

                if not available_files:
                    available_files = set(JOB_INDEX_FILE_NAMES)

                if filename not in available_files:
                    return generate_not_found()

                if filename == REFERENCE_JSON_V2_FILE_NAME:
                    return Response(
                        body=reference_json_v2,
                        headers={
                            "Content-Disposition": (
                                f"attachment; filename='{filename}'"
                            ),
                            "Content-Type": "application/octet-stream",
                        },
                    )

                return FileResponse(
                    example_path / "indexes" / filename,
                    headers={
                        "Content-Disposition": f"attachment; filename='{filename}'",
                        "Content-Type": "application/octet-stream",
                    },
                )

            return generate_not_found()

    return routes
