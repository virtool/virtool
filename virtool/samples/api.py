import asyncio
import os
from asyncio import to_thread

from aiohttp.web import (
    FileResponse,
    Request,
    Response,
)
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r201, r204, r400, r403, r404
from pydantic import Field, conint, constr
from sqlalchemy import exc, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from structlog import get_logger
from virtool_core.models.roles import AdministratorRole
from virtool_core.models.samples import SampleSearchResult
from virtool_core.utils import file_stats

import virtool.uploads.db
import virtool.uploads.utils
from virtool.api.client import UserClient
from virtool.api.custom_json import json_response
from virtool.api.errors import (
    APIBadRequest,
    APIConflict,
    APIInsufficientRights,
    APIInvalidQuery,
    APINoContent,
    APINotFound,
)
from virtool.api.policy import PermissionRoutePolicy, policy
from virtool.api.routes import Routes
from virtool.api.schema import schema
from virtool.authorization.permissions import LegacyPermission
from virtool.config import get_config_from_req
from virtool.data.errors import (
    ResourceConflictError,
    ResourceError,
    ResourceNotFoundError,
)
from virtool.data.utils import get_data_from_req
from virtool.errors import DatabaseError
from virtool.groups.pg import SQLGroup
from virtool.mongo.utils import get_mongo_from_req, get_one_field
from virtool.pg.utils import delete_row, get_rows
from virtool.samples.db import (
    SAMPLE_RIGHTS_PROJECTION,
    check_rights,
    get_sample_owner,
    recalculate_workflow_tags,
)
from virtool.samples.files import (
    create_artifact_file,
    create_reads_file,
    get_existing_reads,
)
from virtool.samples.models import ArtifactType, SQLSampleArtifact, SQLSampleReads
from virtool.samples.oas import (
    CreateAnalysisRequest,
    CreateAnalysisResponse,
    CreateSampleRequest,
    CreateSampleResponse,
    GetSampleAnalysesResponse,
    GetSampleResponse,
    UpdateRightsRequest,
    UpdateRightsResponse,
    UpdateSampleRequest,
    UpdateSampleResponse,
)
from virtool.samples.utils import SampleRight, join_sample_path
from virtool.uploads.utils import (
    is_gzip_compressed,
    multipart_file_chunker,
    naive_validator,
)

logger = get_logger("samples")

routes = Routes()


@routes.view("/samples")
@routes.view("/spaces/{space_id}/samples")
class SamplesView(PydanticView):
    async def get(
        self,
        find: constr(strip_whitespace=True) = "",
        label: list[int] = Field(default_factory=list),
        page: conint(gt=0) = 1,
        per_page: conint(ge=1, le=100) = 25,
        workflows: list[str] = Field(default_factory=list),
    ) -> r200[SampleSearchResult] | r400:
        """Find samples.

        Lists samples, filtering by data passed as URL parameters.

        Status Codes:
            200: Successful operation
            400: Invalid query
        """
        search_result = await get_data_from_req(self.request).samples.find(
            label,
            page,
            per_page,
            find,
            workflows,
            self.request["client"],
        )

        return json_response(search_result)

    @policy(PermissionRoutePolicy(LegacyPermission.CREATE_SAMPLE))
    async def post(
        self,
        data: CreateSampleRequest,
    ) -> r201[CreateSampleResponse] | r400 | r403:
        """Create a sample.

        Creates a new sample with the given name, labels and subtractions.

        Status Codes:
            201: Operation successful
            400: File does not exist
            400: Group does not exist
            400: Group value required for sample creation
            400: Sample name already in use
            400: Subtraction does not exist
            403: Not permitted
            400: Invalid input
        """
        try:
            sample = await get_data_from_req(self.request).samples.create(
                data,
                self.request["client"].user_id,
                0,
            )
        except ResourceConflictError as err:
            raise APIBadRequest(str(err))

        return json_response(
            sample,
            status=201,
            headers={"Location": f"/samples/{sample.id}"},
        )


@routes.view("/spaces/{space_id}/samples/{sample_id}")
@routes.view("/samples/{sample_id}")
class SampleView(PydanticView):
    async def get(self, sample_id: str, /) -> r200[GetSampleResponse] | r403 | r404:
        """Get a sample.

        Fetches the details for a sample.

        Status Codes:
            200: Successful operation
            400: Invalid query
        """
        if not await get_data_from_req(self.request).samples.has_right(
            sample_id,
            self.request["client"],
            SampleRight.read,
        ):
            raise APIInsufficientRights()

        try:
            sample = await get_data_from_req(self.request).samples.get(sample_id)

        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(sample)

    async def patch(
        self,
        sample_id: str,
        /,
        data: UpdateSampleRequest,
    ) -> r200[UpdateSampleResponse] | r400 | r403 | r404:
        """Update a sample.

        Updates a sample using its 'sample id'.

        Status Codes:
            200: Successful operation
            400: Invalid input
            400: Sample name is already in use
            403: Insufficient rights
            404: Not found
        """
        if not await get_data_from_req(self.request).samples.has_right(
            sample_id,
            self.request["client"],
            SampleRight.write,
        ):
            raise APIInsufficientRights()

        try:
            sample = await get_data_from_req(self.request).samples.update(
                sample_id,
                data,
            )
        except ResourceConflictError as err:
            raise APIBadRequest(str(err))
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(sample)

    async def delete(self, sample_id: str, /) -> r204 | r403 | r404:
        """Delete a sample.

        Removes a sample document and all associated analyses.

        Status Codes:
            204: Operation successful
            403: Insufficient rights
            404: Not found
        """
        if not await get_data_from_req(self.request).samples.has_right(
            sample_id,
            self.request["client"],
            SampleRight.write,
        ):
            raise APIInsufficientRights()

        if (
            await get_one_field(
                get_mongo_from_req(self.request).samples,
                "ready",
                sample_id,
            )
            is False
        ):
            raise APIBadRequest("Only unfinalized samples can be deleted")

        try:
            await get_data_from_req(self.request).samples.delete(sample_id)
        except ResourceNotFoundError:
            raise APINotFound()

        raise APINoContent()


@routes.jobs_api.get("/samples/{sample_id}")
async def get_sample(req):
    """Get a sample.

    Fetches a complete sample document from a job.

    """
    sample_id = req.match_info["sample_id"]

    try:
        sample = await get_data_from_req(req).samples.get(sample_id)
    except ResourceNotFoundError:
        raise APINotFound()

    return json_response(sample)


@routes.jobs_api.patch("/samples/{sample_id}")
@schema({"quality": {"type": "dict", "required": True}})
async def finalize(req):
    """Finalize a sample.

    Set the sample's quality field and the `ready` field to `True`.

    """
    data = req["data"]

    sample_id = req.match_info["sample_id"]

    sample = await get_data_from_req(req).samples.finalize(
        sample_id,
        data["quality"],
    )

    return json_response(sample)


@routes.view("/samples/{sample_id}/rights")
class RightsView(PydanticView):
    async def patch(
        self,
        sample_id: str,
        /,
        data: UpdateRightsRequest,
    ) -> r200[UpdateRightsResponse] | r400 | r403 | r404:
        """Update rights settings.

        Updates the rights settings for the specified sample document.

        Status Codes:
            200: Successful operation
            400: Invalid input
            400: Group does not exist
            403: Must be administrator or sample owner
            404: Not found
        """
        mongo = get_mongo_from_req(self.request)
        pg: AsyncEngine = self.request.app["pg"]

        data = data.dict(exclude_unset=True)

        if not await mongo.samples.count_documents({"_id": sample_id}):
            raise APINotFound()

        client: UserClient = self.request["client"]

        if (
            client.administrator_role != AdministratorRole.FULL
            and client.user_id != await get_sample_owner(mongo, sample_id)
        ):
            raise APIInsufficientRights("Must be administrator or sample owner")

        group = data.get("group")

        if group is not None and group != "none":
            async with AsyncSession(pg) as session:
                result = await session.execute(
                    select(SQLGroup.id).where(
                        (SQLGroup.id == group)
                        if isinstance(group, int)
                        else (SQLGroup.legacy_id == group),
                    ),
                )

                if not result.scalars().one_or_none():
                    raise APIBadRequest("Group does not exist")

        # Update the sample document with the new rights.
        document = await mongo.samples.find_one_and_update(
            {"_id": sample_id},
            {"$set": data},
            projection=SAMPLE_RIGHTS_PROJECTION,
        )

        return json_response(document)


@routes.jobs_api.delete("/samples/{sample_id}")
async def job_remove(req):
    """Remove a job.

    Removes a sample document and all associated analyses.

    Only usable in the Jobs API and when samples are unfinalized.

    """
    pg = req.app["pg"]

    sample_id = req.match_info["sample_id"]

    if await get_one_field(get_mongo_from_req(req).samples, "ready", sample_id):
        raise APIBadRequest("Only unfinalized samples can be deleted")

    reads_files = await get_rows(pg, SQLSampleReads, "sample", sample_id)
    upload_ids = [upload for reads in reads_files if (upload := reads.upload)]

    if upload_ids:
        await get_data_from_req(req).uploads.release(upload_ids)

    try:
        await get_data_from_req(req).samples.delete(sample_id)
    except ResourceNotFoundError:
        raise APINotFound()

    raise APINoContent()


@routes.view("/samples/{sample_id}/analyses")
class AnalysesView(PydanticView):
    async def get(
        self,
        sample_id: str,
        page: conint(ge=1) = 1,
        per_page: conint(ge=1, le=100) = 25,
        /,
    ) -> r200[list[GetSampleAnalysesResponse]] | r403 | r404:
        """Get analyses.

        Lists the analyses associated with the given `sample_id`.

        Status Codes:
            200: Successful operation
            403: Insufficient rights
            404: Not found
        """
        search_result = await get_data_from_req(self.request).analyses.find(
            page,
            per_page,
            self.request["client"],
            sample_id,
        )

        return json_response(search_result)

    async def post(
        self,
        sample_id: str,
        /,
        data: CreateAnalysisRequest,
    ) -> r201[CreateAnalysisResponse] | r400 | r403 | r404:
        """Start analysis job.

        Starts an analysis job for a given sample.

        Status Codes:
            201: Successful operation
            400: Reference does not exist
            400: No index is ready for the reference
            400: Invalid input
            403: Insufficient rights
            404: Not found
        """
        mongo = get_mongo_from_req(self.request)

        try:
            if not await check_rights(mongo, sample_id, self.request["client"]):
                raise APIInsufficientRights()
        except DatabaseError as err:
            if "Sample does not exist" in str(err):
                raise APINotFound()

            raise

        try:
            await get_data_from_req(
                self.request,
            ).samples.has_resources_for_analysis_job(data.ref_id, data.subtractions)
        except ResourceError as err:
            raise APIBadRequest(str(err))

        analysis = await get_data_from_req(self.request).analyses.create(
            data,
            sample_id,
            self.request["client"].user_id,
            0,
        )

        await recalculate_workflow_tags(mongo, sample_id)

        return json_response(
            analysis,
            status=201,
            headers={"Location": f"/analyses/{analysis.id}"},
        )


@routes.jobs_api.post("/samples/{sample_id}/artifacts")
async def upload_artifact(req):
    """Upload an artifact.

    Uploads artifact created during sample creation using the Jobs API.
    """
    mongo = get_mongo_from_req(req)
    pg = req.app["pg"]

    sample_id = req.match_info["sample_id"]
    artifact_type = req.query.get("type")

    if not await mongo.samples.find_one(sample_id):
        raise APINotFound()

    if errors := naive_validator(req):
        raise APIInvalidQuery(errors)

    name = req.query.get("name")

    sample_path = join_sample_path(get_config_from_req(req), sample_id)
    await asyncio.to_thread(sample_path.mkdir, parents=True, exist_ok=True)

    artifact_file_path = sample_path / name

    if artifact_type and artifact_type not in ArtifactType.to_list():
        raise APIBadRequest("Unsupported sample artifact type")

    try:
        artifact = await create_artifact_file(pg, name, name, sample_id, artifact_type)
    except exc.IntegrityError:
        raise APIConflict("Artifact file has already been uploaded for this sample")

    artifact_id = artifact["id"]

    try:
        size = await virtool.uploads.utils.naive_writer(
            multipart_file_chunker(await req.multipart()),
            artifact_file_path,
        )
    except asyncio.CancelledError:
        logger.info(
            "Sample artifact file upload aborted",
            id=artifact_id,
            sample_id=sample_id,
        )
        await delete_row(pg, artifact_id, SQLSampleArtifact)
        await to_thread(os.remove, artifact_file_path)

        return Response(status=499)

    artifact = await virtool.uploads.db.finalize(
        pg,
        size,
        artifact_id,
        SQLSampleArtifact,
    )

    return json_response(
        artifact,
        status=201,
        headers={"Location": f"/samples/{sample_id}/artifact/{name}"},
    )


@routes.jobs_api.put("/samples/{sample_id}/reads/{filename}")
async def upload_reads(req):
    """Upload reads.

    Uploads sample reads using the Jobs API.
    """
    mongo = get_mongo_from_req(req)
    pg = req.app["pg"]

    name = req.match_info["filename"]
    sample_id = req.match_info["sample_id"]

    try:
        upload = int(req.query.get("upload"))
    except TypeError:
        upload = None

    if name not in ["reads_1.fq.gz", "reads_2.fq.gz"]:
        raise APIBadRequest("File name is not an accepted reads file")

    sample_path = join_sample_path(get_config_from_req(req), sample_id)
    await asyncio.to_thread(sample_path.mkdir, parents=True, exist_ok=True)

    reads_path = sample_path / name

    if not await mongo.samples.find_one(sample_id):
        raise APINotFound()

    try:
        size = await virtool.uploads.utils.naive_writer(
            multipart_file_chunker(await req.multipart()),
            reads_path,
            is_gzip_compressed,
        )
    except OSError:
        raise APIBadRequest("File is not compressed")
    except asyncio.CancelledError:
        logger.info("Sample reads upload aborted", sample_id=sample_id)
        return Response(status=499)
    try:
        reads = await create_reads_file(
            pg,
            size,
            name,
            name,
            sample_id,
            upload_id=upload,
        )
    except exc.IntegrityError:
        raise APIConflict("Reads file name is already uploaded for this sample")

    return json_response(
        reads,
        status=201,
        headers={"Location": f"/samples/{sample_id}/reads/{reads['name_on_disk']}"},
    )


@routes.get("/samples/{sample_id}/reads/reads_{suffix}.fq.gz")
@routes.jobs_api.get("/samples/{sample_id}/reads/reads_{suffix}.fq.gz")
async def download_reads(req: Request):
    """Download reads.

    Downloads the sample reads file.
    """
    mongo = get_mongo_from_req(req)
    pg = req.app["pg"]

    sample_id = req.match_info["sample_id"]
    suffix = req.match_info["suffix"]

    file_name = f"reads_{suffix}.fq.gz"

    if not await mongo.samples.find_one(sample_id):
        raise APINotFound()

    existing_reads = await get_existing_reads(pg, sample_id)

    if file_name not in existing_reads:
        raise APINotFound()

    file_path = get_config_from_req(req).data_path / "samples" / sample_id / file_name

    if not os.path.isfile(file_path):
        raise APINotFound()

    stats = await to_thread(file_stats, file_path)

    headers = {"Content-Length": stats["size"], "Content-Type": "application/gzip"}

    return FileResponse(file_path, chunk_size=1024 * 1024, headers=headers)


@routes.jobs_api.get("/samples/{sample_id}/artifacts/{filename}")
async def download_artifact(req: Request):
    """Download artifact.

    Downloads the sample artifact.

    """
    mongo = get_mongo_from_req(req)
    pg = req.app["pg"]

    sample_id = req.match_info["sample_id"]
    filename = req.match_info["filename"]

    if not await mongo.samples.find_one(sample_id):
        raise APINotFound()

    async with AsyncSession(pg) as session:
        result = (
            await session.execute(
                select(SQLSampleArtifact).filter_by(sample=sample_id, name=filename),
            )
        ).scalar()

    if not result:
        raise APINotFound()

    artifact = result.to_dict()

    file_path = (
        get_config_from_req(req).data_path
        / f"samples/{sample_id}/{artifact['name_on_disk']}"
    )

    if not os.path.isfile(file_path):
        raise APINotFound()

    stats = await to_thread(file_stats, file_path)

    return FileResponse(
        file_path,
        chunk_size=1024 * 1024,
        headers={"Content-Length": stats["size"], "Content-Type": "application/gzip"},
    )
