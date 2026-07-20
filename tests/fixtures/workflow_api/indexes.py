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
from virtool.indexes.models import IndexFile
from virtool.workflow.pytest_plugin.data import WorkflowData


def create_indexes_routes(
    data: WorkflowData,
    example_path: Path,
    read_file_from_multipart,
) -> RouteTableDef:
    _uploaded_files = []

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

            if index_id not in (
                data.index.id,
                data.new_index.id,
            ):
                return generate_not_found()

            index = data.index if index_id == data.index.id else data.new_index

            return json_response(index.dict(), status=200, dumps=custom_dumps)

        async def patch(self):
            """Finalize the index."""
            index_id = int(self.request.match_info["index_id"])

            if index_id != data.new_index.id:
                return generate_not_found()

            required_files = [
                file_name
                for file_name in JOB_INDEX_FILE_NAMES
                if file_name != "reference.json.gz"
            ]

            missing_files = [
                file_name
                for file_name in required_files
                if file_name not in _uploaded_files
            ]

            if missing_files:
                return json_response(
                    {
                        "id": "conflict",
                        "message": (
                            "Reference requires that all Bowtie2 index files have "
                            "been uploaded. "
                            f"Missing files: {', '.join(missing_files)}"
                        ),
                    },
                    status=409,
                )

            data.new_index.ready = True

            return json_response(data.new_index.dict(), status=200, dumps=custom_dumps)

    @routes.view("/indexes/{index_id}/files/{filename}")
    class IndexFilesView(View):
        async def get(self):
            index_id = int(self.request.match_info["index_id"])
            filename = self.request.match_info["filename"]

            if filename == "otus.json.gz" and index_id in (
                data.index.id,
                data.new_index.id,
            ):
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

        async def put(self):
            index_id = int(self.request.match_info["index_id"])
            filename = self.request.match_info["filename"]

            if filename not in JOB_INDEX_FILE_NAMES:
                return json_response(
                    {
                        "id": "not_found",
                        "message": "Index file not found",
                    },
                    status=404,
                )

            index_file = await read_file_from_multipart(
                filename,
                await self.request.multipart(),
            )

            _uploaded_files.append(index_file["name"])

            index_file = IndexFile(
                download_url=f"/indexes/{data.index.id}/files/{index_file['name']}",
                id=index_file["id"],
                index=index_id,
                name=index_file["name"],
                size=index_file["size"],
                type="unknown",
            )

            return json_response(
                index_file.dict(),
                status=201,
            )

    return routes
