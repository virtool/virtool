import asyncio

from aiohttp.web import (
    Request,
    Response,
)
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r201, r204, r400, r403, r404, r409
from pydantic import Field, conint, constr
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
from virtool.api.streaming import stream_storage_response
from virtool.authorization.permissions import LegacyPermission
from virtool.data.errors import (
    ResourceConflictError,
    ResourceError,
    ResourceNotFoundError,
)
from virtool.data.utils import get_data_from_req
from virtool.jobs.models import TERMINAL_JOB_STATES
from virtool.models.roles import AdministratorRole
from virtool.samples.models import Sample, SampleSearchResult
from virtool.samples.oas import (
    CreateAnalysisRequest,
    CreateSampleRequest,
    UpdateRightsRequest,
    UpdateSampleRequest,
)
from virtool.samples.utils import SampleRight
from virtool.uploads.utils import (
    multipart_file_chunker,
    naive_validator,
)

logger = get_logger("samples")

routes = Routes()

DELETABLE_JOB_STATES = {s.value for s in TERMINAL_JOB_STATES}
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
        user: list[int] = Field(default_factory=list),
        workflows: list[str] = Field(default_factory=list),
    ) -> r200[SampleSearchResult] | r400:
        """Find samples.

        Lists samples, filtering by data passed as URL parameters.

        The ``find`` parameter matches a substring of the sample name. Use ``user`` to
        filter by owner instead: it may be repeated to match samples owned by any of
        several users. Results are always limited to samples the requesting client may
        read, so filtering by another user cannot reveal their private samples.

        Status Codes:
            200: Successful operation
            400: Invalid query
        """
        search_result = await get_data_from_req(self.request).samples.find(
            labels=label,
            page=page,
            per_page=per_page,
            term=find,
            users=user,
            workflows=workflows,
            client=self.request["client"],
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
    async def get(self, sample_id: int, /) -> r200[Sample] | r403 | r404:
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
        sample_id: int,
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

    async def delete(self, sample_id: int, /) -> r204 | r403 | r404:
        """Delete a sample.

        Removes a sample document and all associated analyses.

        Status Codes:
            204: Operation successful
            400: Sample with active job cannot be deleted
            403: Insufficient rights
            404: Not found
        """
        samples = get_data_from_req(self.request).samples

        if not await samples.has_right(
            sample_id,
            self.request["client"],
            SampleRight.write,
        ):
            raise APIInsufficientRights()

        try:
            sample = await samples.get(sample_id)
        except ResourceNotFoundError:
            raise APINotFound()

        if not sample.ready:
            job_id = sample.job.id if sample.job else None

            if not job_id:
                raise APIBadRequest(
                    "Unfinalized samples without jobs cannot be deleted"
                )

            try:
                job = await get_data_from_req(self.request).jobs.get(job_id)
            except ResourceNotFoundError:
                job = None

            if job is not None and job.state.value not in DELETABLE_JOB_STATES:
                raise APIBadRequest(
                    f"Cannot delete sample with active job (current state: {job.state.value})"
                )

        try:
            await samples.delete(sample_id)
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

    try:
        sample = await get_data_from_req(req).samples.finalize(
            sample_id,
            data["quality"],
        )
    except ResourceConflictError as err:
        raise APIConflict(str(err))
    except ResourceNotFoundError:
        raise APINotFound()

    return json_response(sample)


@routes.view("/samples/{sample_id}/rights")
class RightsView(PydanticView):
    async def patch(
        self,
        sample_id: int,
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
        client: UserClient = self.request["client"]

        owner_id = await get_data_from_req(self.request).samples.get_owner_id(
            sample_id,
        )

        if owner_id is None:
            raise APINotFound()

        if (
            client.administrator_role != AdministratorRole.FULL
            and client.user_id != owner_id
        ):
            raise APIInsufficientRights("Must be administrator or sample owner")

        try:
            sample = await get_data_from_req(self.request).samples.update_rights(
                sample_id,
                data.dict(exclude_unset=True),
            )
        except ResourceConflictError as err:
            raise APIBadRequest(str(err))
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(sample)


@routes.jobs_api.delete("/samples/{sample_id}")
async def job_remove(req):
    """Remove a job.

    Removes a sample document and all associated analyses.

    Only usable in the Jobs API and when samples are unfinalized.

    """
    sample_id = req.match_info["sample_id"]

    try:
        sample = await get_data_from_req(req).samples.get(sample_id)
    except ResourceNotFoundError:
        raise APINotFound()

    if sample.ready:
        raise APIBadRequest("Only unfinalized samples can be deleted")

    if sample.job is not None and sample.job.state.value not in DELETABLE_JOB_STATES:
        raise APIBadRequest(
            f"Cannot delete sample with active job (current state: {sample.job.state.value})"
        )

    try:
        await get_data_from_req(req).samples.delete(sample_id)
    except ResourceNotFoundError:
        raise APINotFound()

    raise APINoContent()


@routes.view("/samples/{sample_id}/analyses")
class AnalysesView(PydanticView):
    async def get(
        self,
        sample_id: int,
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
        sample_id: int,
        /,
        data: CreateAnalysisRequest,
    ) -> r201[AnalysisMinimal] | r400 | r403 | r404 | r409:
        """Start analysis job.

        Starts an analysis job for a given sample.

        Status Codes:
            201: Successful operation
            400: Invalid input
            403: Insufficient rights
            404: Not found
            409: Reference does not exist
            409: Reference is archived
            409: No index is ready for the reference
            409: Subtractions do not exist
        """
        samples = get_data_from_req(self.request).samples

        if await samples.get_owner_id(sample_id) is None:
            raise APINotFound()

        if not await samples.has_right(
            sample_id,
            self.request["client"],
            SampleRight.write,
        ):
            raise APIInsufficientRights()

        try:
            await samples.has_resources_for_analysis_job(
                data.ref_id,
                data.subtractions,
            )
        except ResourceError as err:
            raise APIConflict(str(err))

        analysis = await get_data_from_req(self.request).analyses.create(
            data,
            sample_id,
            self.request["client"].user_id,
        )

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
    sample_id = req.match_info["sample_id"]
    artifact_type = req.query.get("type")

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
    except ResourceNotFoundError:
        raise APINotFound()
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
    name = req.match_info["filename"]
    sample_id = req.match_info["sample_id"]

    try:
        upload = int(req.query.get("upload"))
    except TypeError:
        upload = None

    if name not in ["reads_1.fq.gz", "reads_2.fq.gz"]:
        raise APIBadRequest("File name is not an accepted reads file")

    try:
        reads = await get_data_from_req(req).samples.upload_reads(
            sample_id,
            name,
            multipart_file_chunker(await req.multipart()),
            upload_id=upload,
        )
    except ResourceNotFoundError:
        raise APINotFound()
    except EOFError:
        raise APIBadRequest("Reads file is empty")
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

    return await stream_storage_response(
        req,
        stream,
        {
            "Content-Length": str(size),
            "Content-Type": "application/gzip",
        },
    )


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

    return await stream_storage_response(
        req,
        stream,
        {
            "Content-Length": str(size),
            "Content-Type": "application/gzip",
        },
    )
