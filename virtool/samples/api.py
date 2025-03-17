import asyncio
from asyncio import to_thread
from typing import Annotated

from aiohttp.web import (
    FileResponse,
    Response,
)
from pydantic import Field
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
    APINoContent,
    APINotFound,
)
from virtool.api.policy import PermissionRoutePolicy, policy
from virtool.api.routes import Routes
from virtool.api.status import R200, R201, R204, R400, R403, R404
from virtool.api.view import APIView
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
from virtool.pg.utils import get_rows
from virtool.samples.db import (
    SAMPLE_RIGHTS_PROJECTION,
    check_rights,
    get_sample_owner,
    recalculate_workflow_tags,
)
from virtool.samples.files import (
    create_reads_file,
    get_existing_reads,
)
from virtool.samples.models import SQLSampleArtifact, SQLSampleReads
from virtool.samples.oas import (
    AcceptedSampleReadNames,
    AnalysisCreateResponse,
    CreateAnalysisRequest,
    CreateSampleResponse,
    FinalizeSampleRequest,
    ListSampleAnalysesResponse,
    SampleCreateRequest,
    SampleResponse,
    SampleRightsUpdateRequest,
    SampleUpdateRequest,
    SampleUpdateResponse,
)
from virtool.samples.utils import SampleRight, join_sample_path
from virtool.uploads.utils import (
    body_part_file_chunker,
    is_gzip_compressed,
)
from virtool.validation import is_set

logger = get_logger("samples")

routes = Routes()


@routes.web.view("/samples")
@routes.web.view("/spaces/{space_id}/samples")
class SamplesView(APIView):
    async def get(
        self,
        label: Annotated[list[int], Field(default_factory=list)],
        workflows: Annotated[list[str], Field(default_factory=list)],
        find: str = "",
        page: int = Field(default=1, gt=0),
        per_page: int = Field(default=25, gt=0, le=100),
    ) -> R200[SampleSearchResult] | R400:
        """Find samples.

        Lists samples, filtering by data passed as URL parameters.

        Status Codes:
            200: Successful operation
            400: Invalid query
        """
        search_result = await self.data.samples.find(
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
        data: SampleCreateRequest,
    ) -> R201[CreateSampleResponse] | R400 | R403:
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
            sample = await self.data.samples.create(
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


@routes.job.get("/samples/{sample_id}")
@routes.web.view("/samples/{sample_id}")
class SampleView(APIView):
    async def get(self, sample_id: str, /) -> R200[SampleResponse] | R403 | R404:
        """Get a sample.

        Fetches the details for a sample.

        Status Codes:
            200: Successful operation
            400: Invalid query
        """
        if not await self.data.samples.has_right(
            sample_id,
            self.request["client"],
            SampleRight.read,
        ):
            raise APIInsufficientRights()

        try:
            sample = await self.data.samples.get(sample_id)
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(sample)

    async def patch(
        self,
        sample_id: str,
        /,
        data: SampleUpdateRequest,
    ) -> R200[SampleUpdateResponse] | R400 | R403 | R404:
        """Update a sample.

        Updates a sample using its 'sample id'.

        Status Codes:
            200: Successful operation
            400: Invalid input
            400: Sample name is already in use
            403: Insufficient rights
            404: Not found
        """
        if not await self.data.samples.has_right(
            sample_id,
            self.request["client"],
            SampleRight.write,
        ):
            raise APIInsufficientRights()

        try:
            sample = await self.data.samples.update(
                sample_id,
                data,
            )
        except ResourceConflictError as err:
            raise APIBadRequest(str(err))
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(sample)

    async def delete(self, sample_id: str, /) -> R204 | R403 | R404:
        """Delete a sample.

        Removes a sample document and all associated analyses.

        Status Codes:
            204: Operation successful
            403: Insufficient rights
            404: Not found
        """
        if not await self.data.samples.has_right(
            sample_id,
            self.request["client"],
            SampleRight.write,
        ):
            raise APIInsufficientRights()

        ready = await get_one_field(
            get_mongo_from_req(self.request).samples,
            "ready",
            sample_id,
        )

        if not self.client.is_job and not ready:
            raise APIBadRequest("Only ready samples can be deleted.")

        if self.client.is_job and ready:
            raise APIBadRequest("Only unfinalized samples can be deleted.")

        try:
            await self.data.samples.delete(sample_id)
        except ResourceNotFoundError:
            raise APINotFound()

        raise APINoContent()


@routes.job.view("/samples/{sample_id}")
class SampleFinalizeView(APIView):
    """Finalize a sample.

    TODO: Move this functionality to `/samples/{sample_id}/finalize`.
    """

    async def patch(
        self,
        sample_id: str,
        /,
        data: FinalizeSampleRequest,
    ) -> R200[SampleResponse] | R400 | R403 | R404:
        """Finalize a sample.

        Set the sample's quality field and the `ready` field to `True`.

        """
        try:
            sample = await self.data.samples.finalize(sample_id, data.quality)
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(sample)


@routes.web.view("/samples/{sample_id}/rights")
class RightsView(APIView):
    async def patch(
        self,
        sample_id: str,
        /,
        data: SampleRightsUpdateRequest,
    ) -> R200[SampleRightsUpdateRequest] | R400 | R403 | R404:
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

        if not await mongo.samples.count_documents({"_id": sample_id}):
            raise APINotFound()

        client: UserClient = self.request["client"]

        if (
            client.administrator_role != AdministratorRole.FULL
            and client.user_id != await get_sample_owner(mongo, sample_id)
        ):
            raise APIInsufficientRights("Must be administrator or sample owner")

        if is_set(data.group):
            async with AsyncSession(pg) as session:
                result = await session.execute(
                    select(SQLGroup.id).where(SQLGroup.id == data.group),
                )

                if not result.scalars().one_or_none():
                    raise APIBadRequest("Group does not exist")

        # Update the sample document with the new rights.
        document = await mongo.samples.find_one_and_update(
            {"_id": sample_id},
            {"$set": data.model_dump(exclude_unset=True)},
            projection=SAMPLE_RIGHTS_PROJECTION,
        )

        return json_response(document)


@routes.job.delete("/samples/{sample_id}")
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


@routes.web.view("/samples/{sample_id}/analyses")
class AnalysesView(APIView):
    async def get(
        self,
        sample_id: str,
        page: int = Field(default=1, ge=1),
        per_page: int = Field(default=25, ge=1, le=100),
        /,
    ) -> R200[list[ListSampleAnalysesResponse]] | R403 | R404:
        """Get analyses.

        Lists the analyses associated with the given `sample_id`.

        Status Codes:
            200: Successful operation
            403: Insufficient rights
            404: Not found
        """
        search_result = await self.data.analyses.find(
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
    ) -> R201[AnalysisCreateResponse] | R400 | R403 | R404:
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

        analysis = await self.data.analyses.create(
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


@routes.job.view("/samples/{sample_id}/artifacts/{filename}")
class SampleArtifactsView(APIView):
    async def get(self, sample_id: str, filename: str) -> R200[FileResponse] | R404:
        """Download artifact.

        Downloads the sample artifact.

        """
        mongo = get_mongo_from_req(self.request)
        pg = self.request.app["pg"]

        if not await mongo.samples.find_one(sample_id):
            raise APINotFound()

        async with AsyncSession(pg) as session:
            result = (
                await session.execute(
                    select(SQLSampleArtifact).filter_by(
                        sample=sample_id,
                        name=filename,
                    ),
                )
            ).scalar()

        if not result:
            raise APINotFound()

        artifact = result.to_dict()

        file_path = (
            get_config_from_req(self.request).data_path
            / f"samples/{sample_id}/{artifact['name_on_disk']}"
        )

        try:
            stats = await to_thread(file_stats, file_path)
        except FileNotFoundError:
            raise APINotFound()

        return FileResponse(
            file_path,
            chunk_size=1024 * 1024,
            headers={
                "Content-Length": stats["size"],
                "Content-Type": "application/gzip",
            },
        )


@routes.web.get("/samples/{sample_id}/reads/{filename}")
@routes.job.view("/samples/{sample_id}/reads/{filename}")
class SampleReadsView(APIView):
    async def get(
        self,
        sample_id: str,
        filename: AcceptedSampleReadNames,
    ) -> R200[FileResponse] | R404:
        """Download reads.

        Downloads the sample reads file.
        """
        mongo = get_mongo_from_req(self.request)

        if not await mongo.samples.find_one(sample_id):
            raise APINotFound()

        existing_reads = await get_existing_reads(self.request.app["pg"], sample_id)

        if filename not in existing_reads:
            raise APINotFound()

        file_path = (
            get_config_from_req(self.request).data_path
            / "samples"
            / sample_id
            / filename
        )

        try:
            stats = await to_thread(file_stats, file_path)
        except FileNotFoundError:
            raise APINotFound()

        return FileResponse(
            file_path,
            chunk_size=1024 * 1024,
            headers={
                "Content-Length": stats["size"],
                "Content-Type": "application/gzip",
            },
        )

    async def post(
        self,
        sample_id: str,
        filename: AcceptedSampleReadNames,
        /,
        upload: int | None = None,
    ) -> R201 | R400 | R404:
        """Upload reads.

        Uploads sample reads using the Jobs API.
        """
        mongo = get_mongo_from_req(self.request)
        pg = self.request.app["pg"]

        sample_path = join_sample_path(get_config_from_req(self.request), sample_id)
        await asyncio.to_thread(sample_path.mkdir, parents=True, exist_ok=True)

        reads_path = sample_path / filename

        if not await mongo.samples.find_one(sample_id):
            raise APINotFound()

        try:
            size = await virtool.uploads.utils.naive_writer(
                body_part_file_chunker(await self.request.multipart()),
                reads_path,
                is_gzip_compressed,
            )
        except OSError:
            raise APIBadRequest("File is not compressed")
        except asyncio.CancelledError:
            logger.info("sample reads upload aborted", sample_id=sample_id)
            return Response(status=499)
        try:
            reads = await create_reads_file(
                pg,
                size,
                filename,
                filename,
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
