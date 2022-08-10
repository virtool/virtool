import asyncio
import logging
import os
from typing import Union, List

import aiohttp.web
from aiohttp.web_exceptions import HTTPBadRequest, HTTPConflict, HTTPNoContent
from aiohttp.web_fileresponse import FileResponse
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r201, r204, r404, r400, r403, r409
from sqlalchemy import exc, select
from sqlalchemy.ext.asyncio import AsyncSession

import virtool.pg.utils
import virtool.subtractions.db
import virtool.uploads.db
from virtool.api.response import NotFound, json_response
from virtool.api.utils import compose_regex_query, get_req_bool, paginate
from virtool.config import get_config_from_req
from virtool.data.errors import ResourceNotFoundError
from virtool.data.utils import get_data_from_req
from virtool.http.policy import PermissionsRoutePolicy, policy
from virtool.http.routes import Routes
from virtool.http.schema import schema
from virtool.jobs.utils import JobRights
from virtool.mongo.transforms import apply_transforms
from virtool.subtractions.db import PROJECTION, attach_computed
from virtool.subtractions.files import create_subtraction_file, delete_subtraction_file
from virtool.subtractions.models import SubtractionFile
from virtool.subtractions.oas import (
    CreateSubtractionSchema,
    EditSubtractionSchema,
    GetSubtractionResponse,
    CreateSubtractionResponse,
    SubtractionResponse,
)
from virtool.subtractions.utils import FILES
from virtool.uploads.models import Upload
from virtool.uploads.utils import naive_writer
from virtool.users.db import AttachUserTransform
from virtool.users.utils import Permission
from virtool.utils import base_processor

logger = logging.getLogger("subtractions")

routes = Routes()

BASE_QUERY = {"deleted": False}


@routes.view("/subtractions")
class SubtractionsView(PydanticView):
    async def get(self) -> r200[List[GetSubtractionResponse]]:
        """
        Find subtractions.

        Find subtractions by their ``name`` or ``nickname`` by providing a ``term`` as a
        query parameter. Partial matches are supported.

        This endpoint returns paginated results by default.

        Status Codes:
            200: Successful operation
        """
        db = self.request.app["db"]

        ready = get_req_bool(self.request, "ready", False)
        short = get_req_bool(self.request, "short", False)
        term = self.request.query.get("find")

        db_query = {}

        if term:
            db_query = compose_regex_query(term, ["name", "nickname"])

        if ready:
            db_query["ready"] = True

        if short:
            documents = []

            async for document in db.subtraction.find(
                {**db_query, **BASE_QUERY}, ["name", "ready"]
            ).sort("name"):
                documents.append(base_processor(document))

            return json_response(documents)

        data = await paginate(
            db.subtraction,
            db_query,
            self.request.query,
            base_query=BASE_QUERY,
            sort="name",
            projection=PROJECTION,
        )

        documents, ready_count = await asyncio.gather(
            apply_transforms(
                data["documents"], [AttachUserTransform(db, ignore_errors=True)]
            ),
            db.subtraction.count_documents({"ready": True}),
        )

        return json_response(
            {**data, "documents": documents, "ready_count": ready_count}
        )

    @policy(PermissionsRoutePolicy(Permission.modify_subtraction))
    async def post(
        self, data: CreateSubtractionSchema
    ) -> Union[r201[CreateSubtractionResponse], r400, r403]:
        """
        Create a subtraction.

        Creates a new subtraction. A job is started to build the data necessary to make
        the subtraction usable in analyses. The subtraction is usable when the
        ``ready`` property is ``true``.

        Status Codes:
            201: Successful operation
            400: Bad request
            403: Not permitted

        """
        db = self.request.app["db"]
        pg = self.request.app["pg"]

        name = data.name
        nickname = data.nickname
        upload_id = data.upload_id

        upload_record = await virtool.pg.utils.get_row_by_id(pg, Upload, upload_id)

        if upload_record is None:
            raise HTTPBadRequest(text="File does not exist")

        filename = upload_record.name

        user_id = self.request["client"].user_id

        document = await virtool.subtractions.db.create(
            db, user_id, filename, name, nickname, upload_id
        )

        subtraction_id = document["_id"]

        task_args = {
            "subtraction_id": subtraction_id,
            "files": [{"id": upload_id, "name": filename}],
        }

        rights = JobRights()

        rights.subtractions.can_read(subtraction_id)
        rights.subtractions.can_modify(subtraction_id)
        rights.subtractions.can_remove(subtraction_id)
        rights.uploads.can_read(upload_id)

        await get_data_from_req(self.request).jobs.create(
            "create_subtraction", task_args, user_id, rights
        )

        headers = {"Location": f"/subtraction/{subtraction_id}"}

        document = await attach_computed(self.request.app, document)
        document = await apply_transforms(document, [AttachUserTransform(db)])

        return json_response(base_processor(document), headers=headers, status=201)


@routes.view("/subtractions/{subtraction_id}")
@routes.jobs_api.get("/subtractions/{subtraction_id}")
class SubtractionView(PydanticView):
    async def get(self) -> Union[r200[SubtractionResponse], r404]:
        """
        Get a subtraction.

        Retrieves the details of a subtraction.

        Status Codes:
            200: Operation Successful
            404: Not found

        """
        db = self.request.app["db"]

        subtraction_id = self.request.match_info["subtraction_id"]

        document = await db.subtraction.find_one(subtraction_id)

        if not document:
            raise NotFound()

        document = await attach_computed(self.request.app, document)

        return json_response(
            await apply_transforms(
                base_processor(document), [AttachUserTransform(db, ignore_errors=True)]
            )
        )

    @policy(PermissionsRoutePolicy(Permission.modify_subtraction))
    async def patch(
        self, data: EditSubtractionSchema
    ) -> Union[r200[SubtractionResponse], r400, r403, r404]:
        """
        Update a subtraction.

        Updates the name or nickname of an existing subtraction.

        Status Codes:
            200: Operation successful
            400: Invalid input
            403: Not permitted
            404: Not found

        """
        db = self.request.app["db"]

        subtraction_id = self.request.match_info["subtraction_id"]

        update = data.dict(exclude_unset=True)

        document = await db.subtraction.find_one_and_update(
            {"_id": subtraction_id}, {"$set": update}
        )

        if document is None:
            raise NotFound()

        document = await attach_computed(self.request.app, document)

        return json_response(
            await apply_transforms(
                base_processor(document), [AttachUserTransform(db, ignore_errors=True)]
            )
        )

    @policy(PermissionsRoutePolicy(Permission.modify_subtraction))
    async def delete(self) -> Union[r204, r403, r404, r409]:
        """
        Delete a subtraction.

        Deletes an existing subtraction.

        Status Codes:
            204: No content
            403: Not permitted
            404: Not found
            409: Has linked samples
        """
        subtraction_id = self.request.match_info["subtraction_id"]

        updated_count = await asyncio.shield(
            virtool.subtractions.db.delete(self.request.app, subtraction_id)
        )

        if updated_count == 0:
            raise NotFound()

        raise HTTPNoContent


@routes.jobs_api.put("/subtractions/{subtraction_id}/files/{filename}")
async def upload(req):
    """Upload a new subtraction file."""
    db = req.app["db"]
    pg = req.app["pg"]

    subtraction_id = req.match_info["subtraction_id"]
    filename = req.match_info["filename"]

    document = await db.subtraction.find_one(subtraction_id)

    if document is None:
        raise NotFound()

    if filename not in FILES:
        raise NotFound("Unsupported subtraction file name")

    file_type = virtool.subtractions.utils.check_subtraction_file_type(filename)

    try:
        subtraction_file = await create_subtraction_file(
            pg, subtraction_id, file_type, filename
        )
    except exc.IntegrityError:
        raise HTTPConflict(text="File name already exists")

    upload_id = subtraction_file["id"]
    path = req.app["config"].data_path / "subtractions" / subtraction_id / filename

    try:
        size = await naive_writer(req, path)
    except asyncio.CancelledError:
        logger.debug(f"Subtraction file upload aborted: {upload_id}")
        await delete_subtraction_file(pg, upload_id)

        return aiohttp.web.Response(status=499)

    subtraction_file = await virtool.uploads.db.finalize(
        pg, size, upload_id, SubtractionFile
    )

    headers = {"Location": f"/subtractions/{subtraction_id}/files/{filename}"}

    return json_response(subtraction_file, headers=headers, status=201)


@routes.jobs_api.patch("/subtractions/{subtraction_id}")
@schema(
    {
        "gc": {"type": "dict", "required": True},
        "count": {"type": "integer", "required": True},
    }
)
async def finalize_subtraction(req: aiohttp.web.Request):
    """
    Sets the gc field for an subtraction and marks it as ready.

    """
    db = req.app["db"]
    pg = req.app["pg"]

    data = await req.json()
    subtraction_id = req.match_info["subtraction_id"]

    document = await db.subtraction.find_one(subtraction_id)

    if document is None:
        raise NotFound()

    if "ready" in document and document["ready"]:
        raise HTTPConflict(text="Subtraction has already been finalized")

    document = await virtool.subtractions.db.finalize(
        db, pg, subtraction_id, data["gc"], data["count"]
    )

    document = await attach_computed(
        db, pg, get_config_from_req(req).base_url, document
    )

    return json_response(
        await apply_transforms(base_processor(document), [AttachUserTransform(db)])
    )


@routes.jobs_api.delete("/subtractions/{subtraction_id}")
async def job_remove(req: aiohttp.web.Request):
    """
    Remove a subtraction document. Only usable in the Jobs API and when subtractions are
    unfinalized.

    """
    db = req.app["db"]
    subtraction_id = req.match_info["subtraction_id"]

    document = await db.subtraction.find_one(subtraction_id)

    if document is None:
        raise NotFound()

    if "ready" in document and document["ready"]:
        raise HTTPConflict(text="Only unfinalized subtractions can be deleted")

    await virtool.subtractions.db.delete(req.app, subtraction_id)

    raise HTTPNoContent


@routes.view("/subtractions/{subtraction_id}/files/{filename}")
@routes.jobs_api.get("/subtractions/{subtraction_id}/files/{filename}")
class SubtractionFileView(PydanticView):
    async def get(self) -> Union[r200, r400, r404]:
        """
        Download a Bowtie2 index file or a FASTA file for the given subtraction.

        Status Codes:
            200: Operation successful
            400: Bad request
            404: Not found
        """
        db = self.request.app["db"]
        pg = self.request.app["pg"]
        subtraction_id = self.request.match_info["subtraction_id"]
        filename = self.request.match_info["filename"]

        document = await db.subtraction.find_one(subtraction_id)

        if document is None:
            raise NotFound()

        if filename not in FILES:
            raise HTTPBadRequest(text="Unsupported subtraction file name")

        async with AsyncSession(pg) as session:
            result = (
                await session.execute(
                    select(SubtractionFile).filter_by(
                        subtraction=subtraction_id, name=filename
                    )
                )
            ).scalar()

        if not result:
            raise NotFound()

        file = result.to_dict()

        file_path = (
            virtool.subtractions.utils.join_subtraction_path(
                self.request.app["config"], subtraction_id
            )
            / filename
        )

        if not os.path.isfile(file_path):
            raise NotFound()

        return FileResponse(
            file_path,
            headers={
                "Content-Length": file["size"],
                "Content-Type": "application/octet-stream",
            },
        )
