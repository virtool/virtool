import asyncio
from pathlib import Path
from tempfile import TemporaryDirectory

from aiohttp.web import FileResponse, Response, RouteTableDef, View, json_response

from tests.fixtures.workflow_api.utils import (
    custom_dumps,
    generate_not_found,
)
from virtool.indexes.db import (
    INDEX_FILE_NAMES,
    JOBS_API_UPLOAD_INDEX_FILE_NAMES,
    LEGACY_INDEX_FILE_NAMES,
)
from virtool.indexes.index_sqlite import (
    COMPRESSED_INDEX_SQLITE_FILE_NAME,
    INDEX_SQLITE_FILE_NAME,
    create_index_sqlite,
)
from virtool.indexes.models import IndexFile
from virtool.utils import compress_file
from virtool.workflow.pytest_plugin.data import WorkflowData

READY_INDEX_FILE_NAMES = LEGACY_INDEX_FILE_NAMES


async def _create_index_sqlite_gz() -> bytes:
    async def _iter_otus():
        yield {
            "_id": "sqlite_otu",
            "abbreviation": "SQL",
            "isolates": [
                {
                    "default": True,
                    "id": "sqlite_isolate",
                    "sequences": [
                        {
                            "_id": "sqlite_sequence",
                            "accession": "SQL123",
                            "definition": "SQLite fixture sequence",
                            "host": "",
                            "segment": None,
                            "sequence": "ACGTAC",
                        },
                    ],
                    "source_name": "sqlite",
                    "source_type": "isolate",
                },
                {
                    "default": False,
                    "id": "sqlite_other_isolate",
                    "sequences": [
                        {
                            "_id": "sqlite_other_sequence",
                            "accession": "SQL456",
                            "definition": "SQLite non-default sequence",
                            "host": "",
                            "segment": None,
                            "sequence": "TTTTAA",
                        },
                    ],
                    "source_name": "sqlite other",
                    "source_type": "isolate",
                },
            ],
            "name": "SQLite OTU",
            "schema": [],
            "taxid": None,
            "version": 1,
        }

    with TemporaryDirectory() as temp_dir:
        path = Path(temp_dir)
        sqlite_path = path / INDEX_SQLITE_FILE_NAME
        compressed_path = path / COMPRESSED_INDEX_SQLITE_FILE_NAME

        await create_index_sqlite(
            sqlite_path,
            {
                "_id": "hxn167",
                "created_at": "2026-01-15T19:55:34.203324Z",
                "data_type": "genome",
                "name": "Plant Viruses",
                "organism": "virus",
            },
            _iter_otus(),
        )
        await asyncio.to_thread(compress_file, sqlite_path, compressed_path)

        return await asyncio.to_thread(compressed_path.read_bytes)


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

            if data.new_index.reference.data_type == "genome":
                required_files = [
                    file_name
                    for file_name in LEGACY_INDEX_FILE_NAMES
                    if file_name != "reference.json.gz"
                ]
            else:
                required_files = ["reference.fa.gz"]
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
                            "Job-backed index builds require all legacy index files. "
                            f"missing files: {', '.join(missing_files)}"
                        ),
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
                    available_files = set(READY_INDEX_FILE_NAMES)

                if filename not in available_files:
                    return generate_not_found()

                if filename == COMPRESSED_INDEX_SQLITE_FILE_NAME:
                    return Response(
                        body=await _create_index_sqlite_gz(),
                        headers={
                            "Content-Disposition": f"attachment; filename='{filename}'",
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

            if filename not in JOBS_API_UPLOAD_INDEX_FILE_NAMES:
                message = f"{filename} cannot be uploaded through the Jobs API"

                return json_response(
                    {
                        "id": "conflict",
                        "message": message,
                    },
                    status=409,
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
