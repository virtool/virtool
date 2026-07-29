import gzip
import json
from pathlib import Path

from aiohttp.web import FileResponse, Response, RouteTableDef, View, json_response

from tests.fixtures.workflow_api.utils import (
    custom_dumps,
    generate_not_found,
)
from virtool.indexes.constants import INDEX_SQLITE_FILE_NAME
from virtool.indexes.db import (
    JOB_INDEX_FILE_NAMES,
    REFERENCE_JSON_V2_FILE_NAME,
)
from virtool.workflow.data.index_sqlite import create_index_sqlite
from virtool.workflow.pytest_plugin.data import WorkflowData


def create_indexes_routes(
    data: WorkflowData,
    example_path: Path,
    index_sqlite_path: Path,
) -> RouteTableDef:
    with gzip.open(
        example_path / "indexes" / "reference.json.gz",
        "rt",
    ) as handle:
        reference_json_v2 = json.load(handle)

    reference_json_v2["_id"] = data.index.reference.id
    reference_json_v2["name"] = data.index.reference.name
    compressed_reference_json_v2 = gzip.compress(json.dumps(reference_json_v2).encode())

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
                        body=compressed_reference_json_v2,
                        headers={
                            "Content-Disposition": (
                                f"attachment; filename='{filename}'"
                            ),
                            "Content-Type": "application/octet-stream",
                        },
                    )

                if filename == INDEX_SQLITE_FILE_NAME:
                    reference = {
                        "_id": data.index.reference.id,
                        "created_at": reference_json_v2["created_at"],
                        "data_type": reference_json_v2["data_type"],
                        "name": data.index.reference.name,
                        "organism": reference_json_v2["organism"],
                    }
                    otus = [
                        {
                            **otu,
                            "version": data.index.manifest[otu["_id"]],
                        }
                        for otu in reference_json_v2["otus"]
                    ]

                    await create_index_sqlite(index_sqlite_path, reference, otus)

                    return FileResponse(
                        index_sqlite_path,
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
