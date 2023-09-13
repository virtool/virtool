import asyncio
import logging
import os
from asyncio import to_thread
from typing import List, Optional, Union

import aiohttp.web
import pymongo.errors
from aiohttp.web_exceptions import HTTPBadRequest, HTTPConflict, HTTPNoContent
from aiohttp.web_fileresponse import FileResponse
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r201, r204, r400, r403, r404
from pydantic import Field, conint, constr
from sqlalchemy import exc, select
from sqlalchemy.ext.asyncio import AsyncSession
from virtool_core.models.samples import SampleSearchResult
from virtool_core.utils import file_stats

import virtool.caches.db
import virtool.uploads.db
import virtool.uploads.utils
from virtool.analyses.db import PROJECTION
from virtool.api.response import (
    InsufficientRights,
    InvalidQuery,
    NotFound,
    json_response,
)
from virtool.api.utils import compose_regex_query, paginate
from virtool.authorization.permissions import LegacyPermission
from virtool.caches.models import SQLSampleArtifactCache
from virtool.caches.utils import join_cache_path
from virtool.config import get_config_from_req
from virtool.data.errors import (
    ResourceConflictError,
    ResourceNotFoundError,
    ResourceError,
)
from virtool.data.transforms import apply_transforms
from virtool.data.utils import get_data_from_req
from virtool.errors import DatabaseError
from virtool.http.policy import PermissionRoutePolicy, policy
from virtool.http.routes import Routes
from virtool.http.schema import schema
from virtool.mongo.utils import get_one_field
from virtool.pg.utils import delete_row, get_rows
from virtool.samples.db import (
    RIGHTS_PROJECTION,
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
from virtool.subtractions.db import AttachSubtractionTransform
from virtool.uploads.utils import is_gzip_compressed
from virtool.users.db import AttachUserTransform
from virtool.utils import base_processor

logger = logging.getLogger("samples")

routes = Routes()


@routes.view("/samples")
@routes.view("/spaces/{space_id}/samples")
class SamplesView(PydanticView):
    async def get(
        self,
        find: constr(strip_whitespace=True) = "",
        label: List[int] = Field(default_factory=lambda: []),
        page: conint(gt=0) = 1,
        per_page: conint(ge=1, le=100) = 25,
        workflows: List[str] = Field(default_factory=lambda: []),
    ) -> Union[r200[SampleSearchResult], r400]:
        """
        Find samples.

        Lists samples, filtering by data passed as URL parameters.

        Status Codes:
            200: Successful operation
            400: Invalid query
        """
        search_result = await get_data_from_req(self.request).samples.find(
            label, page, per_page, find, workflows, self.request["client"]
        )

        return json_response(search_result)

    @policy(PermissionRoutePolicy(LegacyPermission.CREATE_SAMPLE))
    async def post(
        self, data: CreateSampleRequest
    ) -> Union[r201[CreateSampleResponse], r400, r403]:
        """
        Create a sample.

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
                data, self.request["client"].user_id, 0
            )
        except ResourceConflictError as err:
            raise HTTPBadRequest(text=str(err))

        return json_response(
            sample,
            status=201,
            headers={"Location": f"/samples/{sample.id}"},
        )


@routes.view("/spaces/{space_id}/samples/{sample_id}")
@routes.view("/samples/{sample_id}")
class SampleView(PydanticView):
    async def get(
        self, sample_id: str, /
    ) -> Union[r200[GetSampleResponse], r403, r404]:
        """
        Get a sample.

        Fetches the details for a sample.

        Status Codes:
            200: Successful operation
            400: Invalid query
        """
        if not await get_data_from_req(self.request).samples.has_right(
            sample_id, self.request["client"], SampleRight.read
        ):
            raise InsufficientRights

        try:
            sample = await get_data_from_req(self.request).samples.get(sample_id)

        except ResourceNotFoundError:
            raise NotFound

        return json_response(sample)

    async def patch(
        self, sample_id: str, /, data: UpdateSampleRequest
    ) -> Union[r200[UpdateSampleResponse], r400, r403, r404]:
        """
        Update a sample.

        Updates a sample using its 'sample id'.

        Status Codes:
            200: Successful operation
            400: Invalid input
            400: Sample name is already in use
            403: Insufficient rights
            404: Not found
        """
        if not await get_data_from_req(self.request).samples.has_right(
            sample_id, self.request["client"], SampleRight.write
        ):
            raise InsufficientRights

        try:
            sample = await get_data_from_req(self.request).samples.update(
                sample_id, data
            )
        except ResourceConflictError as err:
            raise HTTPBadRequest(text=str(err))
        except ResourceNotFoundError:
            raise NotFound

        return json_response(sample)

    async def delete(self, sample_id: str, /) -> Union[r204, r403, r404]:
        """
        Delete a sample.

        Removes a sample document and all associated analyses.

        Status Codes:
            204: Operation successful
            403: Insufficient rights
            404: Not found
        """
        if not await get_data_from_req(self.request).samples.has_right(
            sample_id, self.request["client"], SampleRight.write
        ):
            raise InsufficientRights

        try:
            await get_data_from_req(self.request).samples.delete(sample_id)
        except ResourceNotFoundError:
            raise NotFound

        raise HTTPNoContent


@routes.jobs_api.get("/samples/{sample_id}")
async def get_sample(req):
    """
    Get a sample.

    Fetches a complete sample document from a job.

    """
    sample_id = req.match_info["sample_id"]

    try:
        sample = await get_data_from_req(req).samples.get(sample_id)
    except ResourceNotFoundError:
        raise NotFound

    return json_response(sample)


@routes.jobs_api.get("/samples/{sample_id}/caches/{cache_key}")
async def get_cache(req):
    """
    Get cache.

    Fetches a cache document by key using the Jobs API.

    """
    db = req.app["db"]

    sample_id = req.match_info["sample_id"]
    cache_key = req.match_info["cache_key"]

    document = await db.caches.find_one({"key": cache_key, "sample.id": sample_id})

    if document is None:
        raise NotFound()

    return json_response(base_processor(document))


@routes.jobs_api.patch("/samples/{sample_id}")
@schema({"quality": {"type": "dict", "required": True}})
async def finalize(req):
    """
    Finalize a sample.

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
        self, sample_id: str, /, data: UpdateRightsRequest
    ) -> Union[r200[UpdateRightsResponse], r400, r403, r404]:
        """
        Update rights settings.

        Updates rights settings for the specified sample document.

        Status Codes:
            200: Successful operation
            400: Invalid input
            400: Group does not exist
            403: Must be administrator or sample owner
            404: Not found
        """
        db = self.request.app["db"]
        data = data.dict(exclude_unset=True)

        if not await db.samples.count_documents({"_id": sample_id}):
            raise NotFound()

        user_id = self.request["client"].user_id

        # Only update the document if the connected user owns the samples or is an
        # administrator.
        if not self.request[
            "client"
        ].administrator and user_id != await get_sample_owner(db, sample_id):
            raise InsufficientRights("Must be administrator or sample owner")

        group = data["group"]

        if group is not None:
            existing_group_ids = await db.groups.distinct("_id") + ["none"]

            if group not in existing_group_ids:
                raise HTTPBadRequest(text="Group does not exist")

        # Update the sample document with the new rights.
        document = await db.samples.find_one_and_update(
            {"_id": sample_id},
            {"$set": data},
            projection=RIGHTS_PROJECTION,
        )

        return json_response(document)


@routes.jobs_api.delete("/samples/{sample_id}")
async def job_remove(req):
    """
    Remove a job.

    Removes a sample document and all associated analyses.

    Only usable in the Jobs API and when samples are unfinalized.

    """
    pg = req.app["pg"]

    sample_id = req.match_info["sample_id"]

    if await get_one_field(req.app["db"].samples, "ready", sample_id):
        raise HTTPBadRequest(text="Only unfinalized samples can be deleted")

    reads_files = await get_rows(pg, SQLSampleReads, "sample", sample_id)
    upload_ids = [upload for reads in reads_files if (upload := reads.upload)]

    if upload_ids:
        await get_data_from_req(req).uploads.release(upload_ids)

    try:
        await get_data_from_req(req).samples.delete(sample_id)
    except ResourceNotFoundError:
        raise NotFound

    raise HTTPNoContent


@routes.view("/samples/{sample_id}/analyses")
class AnalysesView(PydanticView):
    async def get(
        self,
        sample_id: str,
        /,
        term: Optional[str] = Field(
            description="Provide text to filter by partial matches to the reference name or user id in the sample."
        ),
    ) -> Union[r200[List[GetSampleAnalysesResponse]], r403, r404]:
        """
        Get analyses.

        Lists the analyses associated with the given `sample_id`.

        Status Codes:
            200: Successful operation
            403: Insufficient rights
            404: Not found
        """
        db = self.request.app["db"]

        try:
            if not await check_rights(
                db, sample_id, self.request["client"], write=False
            ):
                raise InsufficientRights()
        except DatabaseError as err:
            if "Sample does not exist" in str(err):
                raise NotFound()

            raise

        db_query = {}

        if term:
            db_query.update(compose_regex_query(term, ["reference.name", "user.id"]))

        data = await paginate(
            db.analyses,
            db_query,
            self.request.query,
            base_query={"sample.id": sample_id},
            projection=PROJECTION,
            sort=[("created_at", -1)],
        )

        return json_response(
            {
                **data,
                "documents": await apply_transforms(
                    data["documents"],
                    [AttachSubtractionTransform(db), AttachUserTransform(db)],
                ),
            }
        )

    async def post(
        self, sample_id: str, /, data: CreateAnalysisRequest
    ) -> Union[r201[CreateAnalysisResponse], r400, r403, r404]:
        """
        Start analysis job.

        Starts an analysis job for a given sample.

        Status Codes:
            201: Successful operation
            400: Reference does not exist
            400: No index is ready for the reference
            400: Invalid input
            403: Insufficient rights
            404: Not found
        """
        db = self.request.app["db"]

        try:
            if not await check_rights(db, sample_id, self.request["client"]):
                raise InsufficientRights()
        except DatabaseError as err:
            if "Sample does not exist" in str(err):
                raise NotFound()

            raise

        try:
            await get_data_from_req(
                self.request
            ).samples.has_resources_for_analysis_job(data.ref_id, data.subtractions)
        except ResourceError as err:
            raise HTTPBadRequest(text=str(err))

        analysis = await get_data_from_req(self.request).analyses.create(
            sample_id,
            data.ref_id,
            data.subtractions,
            self.request["client"].user_id,
            data.workflow,
            0,
        )

        analysis_id = analysis.id

        await recalculate_workflow_tags(db, sample_id)

        return json_response(
            analysis,
            status=201,
            headers={"Location": f"/analyses/{analysis_id}"},
        )


@routes.jobs_api.delete("/samples/{sample_id}/caches/{cache_key}")
async def cache_job_remove(req: aiohttp.web.Request):
    """
    Remove cache document.

    Removes a cache document. Only usable in the Jobs API and when caches are
    unfinalized.

    """
    db = req.app["db"]

    cache_key = req.match_info["cache_key"]

    document = await db.caches.find_one({"key": cache_key})

    if document is None:
        raise NotFound()

    if "ready" in document and document["ready"]:
        raise HTTPConflict(text="Jobs cannot delete finalized caches")

    await virtool.caches.db.remove(req.app, document["_id"])

    raise HTTPNoContent


@routes.jobs_api.post("/samples/{sample_id}/artifacts")
async def upload_artifact(req):
    """
    Upload an artifact.

    Uploads artifact created during sample creation using the Jobs API.
    """
    db = req.app["db"]
    pg = req.app["pg"]

    sample_id = req.match_info["sample_id"]
    artifact_type = req.query.get("type")

    if not await db.samples.find_one(sample_id):
        raise NotFound()

    errors = virtool.uploads.utils.naive_validator(req)

    if errors:
        raise InvalidQuery(errors)

    name = req.query.get("name")

    sample_path = join_sample_path(get_config_from_req(req), sample_id)
    await asyncio.to_thread(sample_path.mkdir, parents=True, exist_ok=True)

    artifact_file_path = sample_path / name

    if artifact_type and artifact_type not in ArtifactType.to_list():
        raise HTTPBadRequest(text="Unsupported sample artifact type")

    try:
        artifact = await create_artifact_file(pg, name, name, sample_id, artifact_type)
    except exc.IntegrityError:
        raise HTTPConflict(
            text="Artifact file has already been uploaded for this sample"
        )

    upload_id = artifact["id"]

    try:
        size = await virtool.uploads.utils.naive_writer(
            await req.multipart(), artifact_file_path
        )
    except asyncio.CancelledError:
        logger.debug("Artifact file upload aborted for sample: %s", sample_id)
        await delete_row(pg, upload_id, SQLSampleArtifact)
        await to_thread(os.remove, artifact_file_path)
        return aiohttp.web.Response(status=499)

    artifact = await virtool.uploads.db.finalize(pg, size, upload_id, SQLSampleArtifact)

    headers = {"Location": f"/samples/{sample_id}/artifact/{name}"}

    return json_response(artifact, status=201, headers=headers)


@routes.jobs_api.put("/samples/{sample_id}/reads/{filename}")
async def upload_reads(req):
    """
    Upload reads.

    Uploads sample reads using the Jobs API.
    """
    db = req.app["db"]
    pg = req.app["pg"]

    name = req.match_info["filename"]
    sample_id = req.match_info["sample_id"]

    try:
        upload = int(req.query.get("upload"))
    except TypeError:
        upload = None

    if name not in ["reads_1.fq.gz", "reads_2.fq.gz"]:
        raise HTTPBadRequest(text="File name is not an accepted reads file")

    sample_path = join_sample_path(get_config_from_req(req), sample_id)
    await asyncio.to_thread(sample_path.mkdir, parents=True, exist_ok=True)

    reads_path = sample_path / name

    if not await db.samples.find_one(sample_id):
        raise NotFound()

    try:
        size = await virtool.uploads.utils.naive_writer(
            await req.multipart(), reads_path, is_gzip_compressed
        )
    except OSError:
        raise HTTPBadRequest(text="File is not compressed")
    except asyncio.CancelledError:
        logger.debug("Reads file upload aborted for %s", sample_id)
        return aiohttp.web.Response(status=499)
    try:
        reads = await create_reads_file(
            pg, size, name, name, sample_id, upload_id=upload
        )
    except exc.IntegrityError:
        raise HTTPConflict(text="Reads file name is already uploaded for this sample")

    headers = {"Location": f"/samples/{sample_id}/reads/{reads['name_on_disk']}"}

    return json_response(reads, status=201, headers=headers)


@routes.jobs_api.post("/samples/{sample_id}/caches")
@schema({"key": {"type": "string", "required": True}})
async def create_cache(req):
    """
    Create cache document.

    Creates a new cache document using the Jobs API.

    """
    db = req.app["db"]
    key = req["data"]["key"]

    sample_id = req.match_info["sample_id"]

    sample = await db.samples.find_one({"_id": sample_id}, ["paired"])

    if not sample:
        raise NotFound("Sample does not exist")

    try:
        document = await virtool.caches.db.create(db, sample_id, key, sample["paired"])
    except pymongo.errors.DuplicateKeyError:
        raise HTTPConflict(text=f"Cache with key {key} already exists for this sample")

    headers = {"Location": f"/samples/{sample_id}/caches/{document['id']}"}

    return json_response(document, status=201, headers=headers)


@routes.jobs_api.put("/samples/{sample_id}/caches/{key}/reads/{filename}")
async def upload_cache_reads(req):
    """
    Upload reads files to cache.

    Upload reads files to cache using the Jobs API.

    """
    db = req.app["db"]
    pg = req.app["pg"]

    name = req.match_info["filename"]
    sample_id = req.match_info["sample_id"]
    key = req.match_info["key"]

    if name not in ["reads_1.fq.gz", "reads_2.fq.gz"]:
        raise HTTPBadRequest(text="File name is not an accepted reads file")

    cache_path = join_cache_path(get_config_from_req(req), key) / name
    await asyncio.to_thread(cache_path.mkdir, parents=True, exist_ok=True)

    cache_file_path = cache_path / name

    if not await db.caches.count_documents({"key": key, "sample.id": sample_id}):
        raise NotFound("Cache doesn't exist with given key")

    try:
        size = await virtool.uploads.utils.naive_writer(
            await req.multipart(), cache_file_path, is_gzip_compressed
        )
    except OSError:
        raise HTTPBadRequest(text="File is not compressed")
    except exc.IntegrityError:
        raise HTTPConflict(text="File name is already uploaded for this cache")
    except asyncio.CancelledError:
        logger.debug("Reads cache file upload aborted for %s", key)
        return aiohttp.web.Response(status=499)

    reads = await create_reads_file(
        pg, size, name, name, sample_id, key=key, cache=True
    )

    headers = {"Location": f"/samples/{sample_id}/caches/{key}/reads/{reads['id']}"}

    return json_response(reads, status=201, headers=headers)


@routes.jobs_api.post("/samples/{sample_id}/caches/{key}/artifacts")
async def upload_cache_artifact(req):
    """
    Upload artifacts to cache.

    Uploads sample artifacts to cache using the Jobs API.

    """
    db = req.app["db"]
    pg = req.app["pg"]

    sample_id = req.match_info["sample_id"]
    key = req.match_info["key"]
    artifact_type = req.query.get("type")

    if not await db.caches.count_documents({"key": key, "sample.id": sample_id}):
        raise NotFound()

    errors = virtool.uploads.utils.naive_validator(req)

    if errors:
        raise InvalidQuery(errors)

    name = req.query.get("name")

    caches_path = get_config_from_req(req).data_path / "caches"
    await asyncio.to_thread(caches_path.mkdir, parents=True, exist_ok=True)

    cache_path = join_cache_path(get_config_from_req(req), key) / name

    if artifact_type and artifact_type not in ArtifactType.to_list():
        raise HTTPBadRequest(text="Unsupported sample artifact type")

    try:
        artifact = await create_artifact_file(
            pg, name, name, sample_id, artifact_type, key=key
        )
    except exc.IntegrityError:
        raise HTTPConflict(
            text="Artifact file has already been uploaded for this sample cache"
        )

    upload_id = artifact["id"]

    try:
        size = await virtool.uploads.utils.naive_writer(
            await req.multipart(), cache_path
        )
    except asyncio.CancelledError:
        logger.debug("Artifact file cache upload aborted for sample: %s", sample_id)
        await delete_row(pg, upload_id, SQLSampleArtifact)
        await to_thread(os.remove, cache_path)
        return aiohttp.web.Response(status=499)

    artifact = await virtool.uploads.db.finalize(
        pg, size, upload_id, SQLSampleArtifactCache
    )

    headers = {"Location": f"/samples/{sample_id}/caches/{key}/artifacts/{name}"}

    return json_response(artifact, status=201, headers=headers)


@routes.jobs_api.patch("/samples/{sample_id}/caches/{key}")
@schema({"quality": {"type": "dict", "required": True}})
async def finalize_cache(req):
    """
    Finalize cache.

    Finalizes cache documents.
    """
    db = req.app["db"]
    data = req["data"]
    key = req.match_info["key"]

    document = await db.caches.find_one_and_update(
        {"key": key}, {"$set": {"quality": data["quality"], "ready": True}}
    )

    return json_response(base_processor(document))


@routes.get("/samples/{sample_id}/reads/reads_{suffix}.fq.gz")
@routes.jobs_api.get("/samples/{sample_id}/reads/reads_{suffix}.fq.gz")
async def download_reads(req: aiohttp.web.Request):
    """
    Download reads.

    Downloads the sample reads file.
    """
    db = req.app["db"]
    pg = req.app["pg"]

    sample_id = req.match_info["sample_id"]
    suffix = req.match_info["suffix"]

    file_name = f"reads_{suffix}.fq.gz"

    if not await db.samples.find_one(sample_id):
        raise NotFound()

    existing_reads = await get_existing_reads(pg, sample_id)

    if file_name not in existing_reads:
        raise NotFound()

    file_path = get_config_from_req(req).data_path / "samples" / sample_id / file_name

    if not os.path.isfile(file_path):
        raise NotFound()

    stats = await to_thread(file_stats, file_path)

    headers = {"Content-Length": stats["size"], "Content-Type": "application/gzip"}

    return FileResponse(file_path, chunk_size=1024 * 1024, headers=headers)


@routes.jobs_api.get("/samples/{sample_id}/artifacts/{filename}")
async def download_artifact(req: aiohttp.web.Request):
    """
    Download artifact.

    Downloads the sample artifact.

    """
    db = req.app["db"]
    pg = req.app["pg"]

    sample_id = req.match_info["sample_id"]
    filename = req.match_info["filename"]

    if not await db.samples.find_one(sample_id):
        raise NotFound()

    async with AsyncSession(pg) as session:
        result = (
            await session.execute(
                select(SQLSampleArtifact).filter_by(sample=sample_id, name=filename)
            )
        ).scalar()

    if not result:
        raise NotFound()

    artifact = result.to_dict()

    file_path = (
        get_config_from_req(req).data_path
        / f"samples/{sample_id}/{artifact['name_on_disk']}"
    )

    if not os.path.isfile(file_path):
        raise NotFound()

    stats = await to_thread(file_stats, file_path)

    headers = {"Content-Length": stats["size"], "Content-Type": "application/gzip"}

    return FileResponse(file_path, chunk_size=1024 * 1024, headers=headers)


@routes.jobs_api.get("/samples/{sample_id}/caches/{key}/reads/reads_{suffix}.fq.gz")
async def download_cache_reads(req):
    """
    Download reads cache.

    Downloads sample reads cache for a given key.

    """
    db = req.app["db"]
    pg = req.app["pg"]

    sample_id = req.match_info["sample_id"]
    key = req.match_info["key"]
    suffix = req.match_info["suffix"]

    file_name = f"reads_{suffix}.fq.gz"

    if not await db.samples.count_documents(
        {"_id": sample_id}
    ) or not await db.caches.count_documents({"key": key}):
        raise NotFound()

    existing_reads = await get_existing_reads(pg, sample_id, key=key)

    if file_name not in existing_reads:
        raise NotFound()

    file_path = get_config_from_req(req).data_path / "caches" / key / file_name

    if not os.path.isfile(file_path):
        raise NotFound()

    stats = await to_thread(file_stats, file_path)

    headers = {"Content-Length": stats["size"], "Content-Type": "application/gzip"}

    return FileResponse(file_path, chunk_size=1024 * 1024, headers=headers)


@routes.jobs_api.get("/samples/{sample_id}/caches/{key}/artifacts/{filename}")
async def download_cache_artifact(req):
    """
    Download artifact cache.

    Downloads sample artifact cache for a given key.

    """
    db = req.app["db"]
    pg = req.app["pg"]

    sample_id = req.match_info["sample_id"]
    key = req.match_info["key"]
    filename = req.match_info["filename"]

    if not await db.samples.count_documents(
        {"_id": sample_id}
    ) or not await db.caches.count_documents({"key": key}):
        raise NotFound()

    async with AsyncSession(pg) as session:
        result = (
            await session.execute(
                select(SQLSampleArtifactCache).filter_by(
                    name=filename, key=key, sample=sample_id
                )
            )
        ).scalar()

    if not result:
        raise NotFound()

    artifact = result.to_dict()

    file_path = (
        get_config_from_req(req).data_path / "caches" / key / artifact["name_on_disk"]
    )

    if not file_path.exists():
        raise NotFound()

    stats = await to_thread(file_stats, file_path)

    return FileResponse(
        file_path,
        chunk_size=1024 * 1024,
        headers={
            "Content-Length": stats["size"],
            "Content-Type": "application/gzip",
        },
    )
