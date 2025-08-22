from pathlib import Path

from aiohttp.web import FileResponse, RouteTableDef, View, json_response

from tests.fixtures.workflow_api.utils import (
    custom_dumps,
    generate_not_found,
)
from virtool.indexes.models import IndexFile
from virtool.workflow.pytest_plugin.data import WorkflowData

INDEX_FILE_NAMES = (
    "otus.json.gz",
    "reference.fa.gz",
    "reference.json.gz",
    "reference.1.bt2",
    "reference.2.bt2",
    "reference.3.bt2",
    "reference.4.bt2",
    "reference.rev.1.bt2",
    "reference.rev.2.bt2",
)


def create_indexes_routes(
    data: WorkflowData,
    example_path: Path,
    read_file_from_multipart,
) -> RouteTableDef:
    _uploaded_files = []

    routes = RouteTableDef()

    @routes.view("/indexes/{index_id}")
    class IndexView(View):
        async def get(self):
            index_id = self.request.match_info["index_id"]

            if index_id not in (
                data.index.id,
                data.new_index.id,
            ):
                return generate_not_found()

            index = data.index if index_id == data.index.id else data.new_index

            return json_response(index.dict(), status=200, dumps=custom_dumps)

        async def patch(self):
            """Finalize the index."""
            index_id = self.request.match_info["index_id"]

            if index_id != data.new_index.id:
                return generate_not_found()

            if missing_files := set(INDEX_FILE_NAMES) - set(_uploaded_files):
                return json_response(
                    {
                        "id": "conflict",
                        "message": f"Reference requires that all Bowtie2 index files have been uploaded. "
                        f"Missing files: {', '.join(sorted(missing_files))}",
                    },
                    status=409,
                )

            data.new_index.ready = True

            return json_response(data.new_index.dict(), status=200, dumps=custom_dumps)

    @routes.view("/indexes/{index_id}/files/{filename}")
    class IndexFilesView(View):
        async def get(self):
            index_id = self.request.match_info["index_id"]
            filename = self.request.match_info["filename"]

            if (index_id == data.index.id and filename in INDEX_FILE_NAMES) or (
                index_id == data.new_index.id and filename == "otus.json.gz"
            ):
                return FileResponse(
                    example_path / "indexes" / filename,
                    headers={
                        "Content-Disposition": f"attachment; filename='{filename}'",
                        "Content-Type": "application/octet-stream",
                    },
                )

            return generate_not_found()

        async def put(self):
            index_id = self.request.match_info["index_id"]
            filename = self.request.match_info["filename"]

            if filename not in INDEX_FILE_NAMES:
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
