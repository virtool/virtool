import asyncio

from aiohttp.web import (
    Request,
    Response,
    StreamResponse,
)
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r201, r204, r400, r403, r404
from pydantic import Field, conint, constr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from structlog import get_logger

from virtool.analyses.models import AnalysisMinimal
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
from virtool.data.errors import (
    ResourceConflictError,
    ResourceError,
    ResourceNotFoundError,
)
from virtool.data.utils import get_data_from_req
from virtool.errors import DatabaseError
from virtool.groups.pg import SQLGroup
from virtool.jobs.models import JobState
from virtool.models.roles import AdministratorRole
from virtool.mongo.utils import get_mongo_from_req
from virtool.pg.utils import get_rows
from virtool.samples.db import (
    SAMPLE_RIGHTS_PROJECTION,
    check_rights,
    get_sample_owner,
    recalculate_workflow_tags,
)
from virtool.samples.models import Sample, SampleSearchResult
from virtool.samples.oas import (
    CreateAnalysisRequest,
    CreateSampleRequest,
    UpdateRightsRequest,
    UpdateSampleRequest,
)
from virtool.samples.sql import SQLSampleReads
from virtool.samples.utils import SampleRight
from virtool.storage.errors import StorageKeyNotFoundError
from virtool.uploads.utils import (
    multipart_file_chunker,
    naive_validator,
)
from virtool.utils import get_safely

logger = get_logger("samples")

routes = Routes()

DELETABLE_JOB_STATES = {
    JobState.ERROR,
    JobState.TIMEOUT,
    JobState.CANCELLED,
    JobState.TERMINATED,
}
"""Job states that allow sample deletion.

Samples with jobs in these states can be deleted because the jobs are no longer
active and will not be resumed.
"""


@routes.view("/samples")
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
    ) -> r201[Sample] | r400 | r403:
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


@routes.view("/samples/{sample_id}")
class SampleView(PydanticView):
    async def get(self, sample_id: str, /) -> r200[Sample] | r403 | r404:
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
    ) -> r200[Sample] | r400 | r403 | r404:
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
            400: Sample with active job cannot be deleted
            403: Insufficient rights
            404: Not found
        """
        if not await get_data_from_req(self.request).samples.has_right(
            sample_id,
            self.request["client"],
            SampleRight.write,
        ):
            raise APIInsufficientRights()

        mongo = get_mongo_from_req(self.request)

        sample_document = await mongo.samples.find_one(
            {"_id": sample_id},
            {"ready": 1, "job": 1},
        )

        if not sample_document:
            raise APINotFound()

        if sample_document.get("ready") is False:
            job_id = get_safely(sample_document, "job", "id")

            if not job_id:
                raise APIBadRequest(
                    "Unfinalized samples without jobs cannot be deleted"
                )

            job_document = await mongo.jobs.find_one(
                {"_id": job_id},
                {"status": 1},
            )

            if job_document:
                current_state = JobState(job_document["status"][-1]["state"])

                if current_state not in DELETABLE_JOB_STATES:
                    raise APIBadRequest(
                        f"Cannot delete sample with active job (current state: {current_state.value})"
                    )

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
    ) -> r200[Sample] | r400 | r403 | r404:
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
    mongo = get_mongo_from_req(req)

    sample_id = req.match_info["sample_id"]

    sample_document = await mongo.samples.find_one(
        {"_id": sample_id},
        {"ready": 1, "job": 1},
    )

    if not sample_document:
        raise APINotFound()

    if sample_document.get("ready") is not False:
        raise APIBadRequest("Only unfinalized samples can be deleted")

    job_id = get_safely(sample_document, "job", "id")

    if job_id:
        job_document = await mongo.jobs.find_one(
            {"_id": job_id},
            {"status": 1},
        )

        if job_document:
            current_state = JobState(job_document["status"][-1]["state"])

            if current_state not in DELETABLE_JOB_STATES:
                raise APIBadRequest(
                    f"Cannot delete sample with active job (current state: {current_state.value})"
                )

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
    ) -> r200[list[AnalysisMinimal]] | r403 | r404:
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
    ) -> r201[AnalysisMinimal] | r400 | r403 | r404:
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

    sample_id = req.match_info["sample_id"]
    artifact_type = req.query.get("type")

    if not await mongo.samples.find_one(sample_id):
        raise APINotFound()

    if errors := naive_validator(req):
        raise APIInvalidQuery(errors)

    name = req.query.get("name")

    try:
        artifact = await get_data_from_req(req).samples.upload_artifact(
            sample_id,
            artifact_type,
            name,
            multipart_file_chunker(await req.multipart()),
        )
    except ResourceConflictError as err:
        if "Unsupported" in str(err):
            raise APIBadRequest(str(err))
        raise APIConflict(str(err))
    except asyncio.CancelledError:
        logger.info(
            "Sample artifact file upload aborted",
            sample_id=sample_id,
        )
        return Response(status=499)

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

    name = req.match_info["filename"]
    sample_id = req.match_info["sample_id"]

    try:
        upload = int(req.query.get("upload"))
    except TypeError:
        upload = None

    if name not in ["reads_1.fq.gz", "reads_2.fq.gz"]:
        raise APIBadRequest("File name is not an accepted reads file")

    if not await mongo.samples.find_one(sample_id):
        raise APINotFound()

    try:
        reads = await get_data_from_req(req).samples.upload_reads(
            sample_id,
            name,
            multipart_file_chunker(await req.multipart()),
            upload_id=upload,
        )
    except OSError:
        raise APIBadRequest("File is not compressed")
    except ResourceConflictError as err:
        raise APIConflict(str(err))
    except asyncio.CancelledError:
        logger.info("sample reads upload aborted", sample_id=sample_id)
        return Response(status=499)

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
    sample_id = req.match_info["sample_id"]
    suffix = req.match_info["suffix"]
    file_name = f"reads_{suffix}.fq.gz"

    try:
        stream, size, name = await get_data_from_req(req).samples.get_reads_file(
            sample_id,
            file_name,
        )
    except ResourceNotFoundError:
        raise APINotFound()

    response = StreamResponse(
        headers={
            "Content-Length": str(size),
            "Content-Type": "application/gzip",
        },
    )

    if size > 0:
        try:
            first_chunk = await anext(stream)
        except (StopAsyncIteration, StorageKeyNotFoundError):
            raise APINotFound()

        await response.prepare(req)
        await response.write(first_chunk)

        async for chunk in stream:
            await response.write(chunk)
    else:
        await response.prepare(req)

    return response


@routes.jobs_api.get("/samples/{sample_id}/artifacts/{filename}")
async def download_artifact(req: Request):
    """Download artifact.

    Downloads the sample artifact.

    """
    sample_id = req.match_info["sample_id"]
    filename = req.match_info["filename"]

    try:
        stream, size = await get_data_from_req(req).samples.get_artifact_file(
            sample_id,
            filename,
        )
    except ResourceNotFoundError:
        raise APINotFound()

    response = StreamResponse(
        headers={
            "Content-Length": str(size),
            "Content-Type": "application/gzip",
        },
    )

    if size > 0:
        try:
            first_chunk = await anext(stream)
        except (StopAsyncIteration, StorageKeyNotFoundError):
            raise APINotFound()

        await response.prepare(req)
        await response.write(first_chunk)

        async for chunk in stream:
            await response.write(chunk)
    else:
        await response.prepare(req)

    return response
