import asyncio
import logging
import os
from pathlib import Path
from typing import List, Union

import aiohttp.web
import pymongo.errors
from aiohttp.web_exceptions import HTTPBadRequest, HTTPConflict, HTTPNoContent
from aiohttp.web_fileresponse import FileResponse
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r201, r204, r400, r403, r404
from cerberus import Validator
from sqlalchemy import exc, select
from sqlalchemy.ext.asyncio import AsyncSession

import virtool.analyses.db
import virtool.caches.db
import virtool.mongo.utils
import virtool.samples.db
import virtool.samples.utils
import virtool.uploads.db
import virtool.uploads.utils
import virtool.utils
from virtool.analyses.db import PROJECTION
from virtool.api.response import (
    InsufficientRights,
    InvalidQuery,
    NotFound,
    json_response,
)
from virtool.api.utils import compose_regex_query, paginate
from virtool.caches.models import SampleArtifactCache
from virtool.caches.utils import join_cache_path
from virtool.data.utils import get_data_from_req
from virtool.errors import DatabaseError
from virtool.http.policy import policy, PermissionsRoutePolicy
from virtool.http.routes import Routes
from virtool.http.schema import schema
from virtool.jobs.utils import JobRights
from virtool.labels.db import AttachLabelsTransform
from virtool.mongo.transforms import apply_transforms
from virtool.pg.utils import delete_row, get_rows
from virtool.samples.db import (
    LIST_PROJECTION,
    RIGHTS_PROJECTION,
    check_name,
    check_rights,
    compose_sample_workflow_query,
    create_sample,
    get_sample_owner,
    recalculate_workflow_tags,
    validate_force_choice_group,
)
from virtool.samples.files import (
    create_artifact_file,
    create_reads_file,
    get_existing_reads,
)
from virtool.samples.models import ArtifactType, SampleArtifact, SampleReads
from virtool.samples.oas import (
    GetSamplesResponse,
    GetSampleResponse,
    CreateSampleSchema,
    CreateSampleResponse,
    EditSampleSchema,
    EditSampleResponse,
    EditRightsSchema,
    EditRightsResponse,
    CreateAnalysisSchema,
    GetSampleAnalysesResponse,
    CreateAnalysisResponse,
)
from virtool.samples.utils import bad_labels_response, check_labels
from virtool.subtractions.db import AttachSubtractionTransform
from virtool.uploads.utils import is_gzip_compressed
from virtool.users.db import AttachUserTransform
from virtool.users.utils import Permission
from virtool.utils import run_in_thread
from virtool.validators import strip

logger = logging.getLogger("samples")

QUERY_SCHEMA = {
    "find": {"type": "string", "default": "", "coerce": (str, strip)},
    "page": {"type": "integer", "coerce": int, "default": 1, "min": 1},
    "per_page": {"type": "integer", "coerce": int, "default": 15, "min": 1, "max": 100},
}

routes = Routes()


@routes.view("/samples")
class SamplesView(PydanticView):
    async def get(self) -> Union[r200[List[GetSamplesResponse]], r400]:
        """
        Find samples, filtering by data passed as URL parameters

        Status Codes:
            200: Successful operation
            400: Invalid query
        """
        db = self.request.app["db"]
        pg = self.request.app["pg"]

        v = Validator(QUERY_SCHEMA, allow_unknown=True)

        if not v.validate(dict(self.request.query)):
            raise InvalidQuery(v.errors)

        queries = []

        term = self.request.query.get("find")

        if term:
            queries.append(compose_regex_query(term, ["name", "user.id"]))

        if "label" in self.request.query:
            labels = self.request.query.getall("label")
            labels = [int(label) for label in labels if label.isdigit()]

            queries.append({"labels": {"$in": labels}})

        if "workflows" in self.request.query:
            queries.append(compose_sample_workflow_query(self.request.query))

        db_query = {}

        if queries:
            db_query["$and"] = queries

        rights_filter = [
            # The requesting user is the sample owner
            {"user.id": self.request["client"].user_id},
            # The sample rights allow all users to view the sample.
            {"all_read": True},
        ]

        if self.request["client"].groups:
            # The sample rights allow owner group members to view the sample and the
            # requesting user is a member of the owner group.
            rights_filter.append(
                {"group_read": True, "group": {"$in": self.request["client"].groups}}
            )

        base_query = {"$or": rights_filter}

        data = await paginate(
            db.samples,
            db_query,
            self.request.query,
            sort="created_at",
            projection=LIST_PROJECTION,
            base_query=base_query,
            reverse=True,
        )

        documents = await apply_transforms(
            data["documents"], [AttachLabelsTransform(pg), AttachUserTransform(db)]
        )

        return json_response({**data, "documents": documents})

    @policy(PermissionsRoutePolicy(Permission.create_sample))
    async def post(
        self, data: CreateSampleSchema
    ) -> Union[r201[CreateSampleResponse], r400, r403]:
        """
        Create a sample.

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
        db = self.request.app["db"]
        pg = self.request.app["pg"]
        user_id = self.request["client"].user_id
        settings = self.request.app["settings"]

        name_error_message = await check_name(
            db, self.request.app["settings"], data.name
        )

        if name_error_message:
            raise HTTPBadRequest(text=name_error_message)

        subtractions = data.subtractions

        # Make sure each subtraction host was submitted and it exists.
        non_existent_subtractions = await virtool.mongo.utils.check_missing_ids(
            db.subtraction, subtractions
        )

        if non_existent_subtractions:
            raise HTTPBadRequest(
                text=f"Subtractions do not exist: {','.join(non_existent_subtractions)}"
            )

        if len(data.labels) != 0:
            non_existent_labels = await check_labels(pg, data.labels)

            if non_existent_labels:
                return bad_labels_response(non_existent_labels)

        try:
            uploads = [
                (await virtool.uploads.db.get(pg, file_)).to_dict()
                for file_ in data.files
            ]
        except AttributeError:
            raise HTTPBadRequest(text="File does not exist")

        sample_group_setting = settings.sample_group

        group = "none"

        # Require a valid ``group`` field if the ``sample_group`` setting is
        # ``users_primary_group``.
        if sample_group_setting == "force_choice":
            force_choice_error_message = await validate_force_choice_group(
                db, data.dict(exclude_unset=True)
            )

            if force_choice_error_message:
                raise HTTPBadRequest(text=force_choice_error_message)

            group = data.group

        # Assign the user"s primary group as the sample owner group if the setting is
        # ``users_primary_group``.
        elif sample_group_setting == "users_primary_group":
            group = await virtool.mongo.utils.get_one_field(
                db.users, "primary_group", user_id
            )

        files = [
            {"id": upload["id"], "name": upload["name"], "size": upload["size"]}
            for upload in uploads
        ]

        document = await create_sample(
            db,
            data.name,
            data.host,
            data.isolate,
            group,
            data.locale,
            data.library_type,
            data.subtractions,
            data.notes,
            data.labels,
            user_id,
            settings,
            paired=len(files) == 2,
        )

        sample_id = document["id"]

        await virtool.uploads.db.reserve(pg, data.files)

        task_args = {"sample_id": sample_id, "files": files}

        rights = JobRights()

        rights.samples.can_read(sample_id)
        rights.samples.can_modify(sample_id)
        rights.samples.can_remove(sample_id)
        rights.uploads.can_read(*data.files)

        await get_data_from_req(self.request).jobs.create(
            "create_sample", task_args, user_id, rights
        )

        headers = {"Location": f"/samples/{sample_id}"}

        return json_response(
            await virtool.samples.db.get_sample(self.request.app, sample_id),
            status=201,
            headers=headers,
        )


@routes.view("/samples/{sample_id}")
class SampleView(PydanticView):
    async def get(
        self,
    ) -> Union[r200[GetSampleResponse], r403, r404]:
        """
        Get a complete sample document.

        Status Codes:
            200: Successful operation
            400: Invalid query
        """
        sample_id = self.request.match_info["sample_id"]

        try:
            sample = await virtool.samples.db.get_sample(self.request.app, sample_id)
        except ValueError:
            raise NotFound()

        rights = virtool.samples.utils.get_sample_rights(
            sample, self.request["client"]
        )[0]

        if not rights:
            raise InsufficientRights()

        return json_response(sample)

    async def patch(
        self, data: EditSampleSchema
    ) -> Union[r200[EditSampleResponse], r400, r403, r404]:
        """
        Update specific fields in the sample document.

        Status Codes:
            200: Successful operation
            400: Invalid input
            400: Sample name is already in use
            403: Insufficient rights
            404: Not found
        """
        data = data.dict(exclude_unset=True)
        db = self.request.app["db"]
        pg = self.request.app["pg"]

        sample_id = self.request.match_info["sample_id"]

        if not await check_rights(db, sample_id, self.request["client"]):
            raise InsufficientRights()

        if "name" in data:
            message = await check_name(
                db, self.request.app["settings"], data["name"], sample_id=sample_id
            )

            if message:
                raise HTTPBadRequest(text=message)

        if "labels" in data:
            non_existent_labels = await check_labels(pg, data["labels"])

            if non_existent_labels:
                return bad_labels_response(non_existent_labels)

        if "subtractions" in data:
            non_existent_subtractions = await virtool.mongo.utils.check_missing_ids(
                db.subtraction, data["subtractions"]
            )

            if non_existent_subtractions:
                raise HTTPBadRequest(
                    text=f"Subtractions do not exist: {','.join(non_existent_subtractions)}"
                )

        await db.samples.update_one({"_id": sample_id}, {"$set": data})

        return json_response(
            await virtool.samples.db.get_sample(self.request.app, sample_id)
        )

    async def delete(self) -> Union[r204, r403, r404]:
        """
        Remove a sample document and all associated analyses.

        Status Codes:
            204: Operation successful
            403: Insufficient rights
            404: Not found
        """
        db = self.request.app["db"]
        client = self.request["client"]

        sample_id = self.request.match_info["sample_id"]

        try:
            if not await check_rights(db, sample_id, client):
                raise InsufficientRights()
        except DatabaseError as err:
            if "Sample does not exist" in str(err):
                raise NotFound()

            raise

        await virtool.samples.db.remove_samples(
            db, self.request.app["config"], [sample_id]
        )

        raise HTTPNoContent


@routes.jobs_api.get("/samples/{sample_id}")
async def get_sample(req):
    """
    Get a complete sample document from a job.

    """
    sample_id = req.match_info["sample_id"]

    try:
        return json_response(await virtool.samples.db.get_sample(req.app, sample_id))
    except ValueError:
        raise NotFound()


@routes.jobs_api.get("/samples/{sample_id}/caches/{cache_key}")
async def get_cache(req):
    """
    Get a cache document by key using the Jobs API.

    """
    db = req.app["db"]

    sample_id = req.match_info["sample_id"]
    cache_key = req.match_info["cache_key"]

    document = await db.caches.find_one({"key": cache_key, "sample.id": sample_id})

    if document is None:
        raise NotFound()

    return json_response(virtool.utils.base_processor(document))


@routes.jobs_api.patch("/samples/{sample_id}")
@schema({"quality": {"type": "dict", "required": True}})
async def finalize(req):
    """
    Finalize a sample.

    Set the sample's quality field and the `ready` field to `True`.

    """
    data = req["data"]

    sample_id = req.match_info["sample_id"]

    await virtool.samples.db.finalize(
        req.app["db"],
        req.app["pg"],
        sample_id,
        data["quality"],
        run_in_thread,
        req.app["config"].data_path,
    )

    return json_response(await virtool.samples.db.get_sample(req.app, sample_id))


@routes.view("/samples/{sample_id}/rights")
class RightsView(PydanticView):
    async def patch(
        self, data: EditRightsSchema
    ) -> Union[r200[EditRightsResponse], r400, r403, r404]:
        """
        Change rights settings for the specified sample document.

        Status Codes:
            200: Successful operation
            400: Invalid input
            400: Group does not exist
            403: Must be administrator or sample owner
            404: Not found
        """
        db = self.request.app["db"]
        data = data.dict(exclude_unset=True)

        sample_id = self.request.match_info["sample_id"]

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
    Remove a sample document and all associated analyses.

    Only usable in the Jobs API and when samples are unfinalized.

    """
    db = req.app["db"]
    pg = req.app["pg"]

    sample_id = req.match_info["sample_id"]

    document = await db.samples.find_one({"_id": sample_id})

    if not document:
        raise NotFound()

    if document["ready"]:
        raise HTTPBadRequest(text="Only unfinalized samples can be deleted")

    reads_files = await get_rows(pg, SampleReads, "sample", sample_id)
    upload_ids = [upload for reads in reads_files if (upload := reads.upload)]

    if upload_ids:
        await virtool.uploads.db.release(req.app["pg"], upload_ids)

    await virtool.samples.db.remove_samples(db, req.app["config"], [sample_id])

    raise HTTPNoContent


@routes.view("/samples/{sample_id}/analyses")
class AnalysesView(PydanticView):
    async def get(self) -> Union[r200[List[GetSampleAnalysesResponse]], r403, r404]:
        """
        List the analyses associated with the given ``sample_id``.

        Status Codes:
            200: Successful operation
            403: Insufficient rights
            404: Not found
        """
        db = self.request.app["db"]

        sample_id = self.request.match_info["sample_id"]

        try:
            if not await check_rights(
                db, sample_id, self.request["client"], write=False
            ):
                raise InsufficientRights()
        except DatabaseError as err:
            if "Sample does not exist" in str(err):
                raise NotFound()

            raise

        term = self.request.query.get("term")

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
        self, data: CreateAnalysisSchema
    ) -> Union[r201[CreateAnalysisResponse], r400, r403, r404]:
        """
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
        sample_id = self.request.match_info["sample_id"]
        ref_id = data.ref_id

        try:
            if not await check_rights(db, sample_id, self.request["client"]):
                raise InsufficientRights()
        except DatabaseError as err:
            if "Sample does not exist" in str(err):
                raise NotFound()

            raise

        if not await db.references.count_documents({"_id": ref_id}):
            raise HTTPBadRequest(text="Reference does not exist")

        if not await db.indexes.count_documents(
            {"reference.id": ref_id, "ready": True}
        ):
            raise HTTPBadRequest(text="No ready index")

        subtractions = data.subtractions

        if subtractions is None:
            subtractions = []
        else:
            non_existent_subtractions = await virtool.mongo.utils.check_missing_ids(
                db.subtraction, subtractions
            )

            if non_existent_subtractions:
                raise HTTPBadRequest(
                    text=f"Subtractions do not exist: {','.join(non_existent_subtractions)}"
                )

        job_id = await virtool.mongo.utils.get_new_id(db.jobs)

        document = await virtool.analyses.db.create(
            self.request.app["db"],
            sample_id,
            ref_id,
            subtractions,
            self.request["client"].user_id,
            data.workflow,
            job_id,
        )

        analysis_id = document["id"]

        sample = await db.samples.find_one(sample_id, ["name"])

        task_args = {
            "analysis_id": analysis_id,
            "ref_id": ref_id,
            "sample_id": sample_id,
            "sample_name": sample["name"],
            "index_id": document["index"]["id"],
            "subtractions": subtractions,
        }

        rights = JobRights()

        rights.analyses.can_read(analysis_id)
        rights.analyses.can_modify(analysis_id)
        rights.analyses.can_remove(analysis_id)
        rights.samples.can_read(sample_id)
        rights.indexes.can_read(document["index"]["id"])
        rights.references.can_read(ref_id)
        rights.subtractions.can_read(*subtractions)

        await get_data_from_req(self.request).jobs.create(
            document["workflow"], task_args, document["user"]["id"], rights
        )

        await recalculate_workflow_tags(db, sample_id)

        return json_response(
            virtool.utils.base_processor(document),
            status=201,
            headers={"Location": f"/analyses/{analysis_id}"},
        )


@routes.jobs_api.delete("/samples/{sample_id}/caches/{cache_key}")
async def cache_job_remove(req: aiohttp.web.Request):
    """
    Remove a cache document. Only usable in the Jobs API and when caches are
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
    Upload artifact created during sample creation using the Jobs API.

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

    artifact_file_path = (
        virtool.samples.utils.join_sample_path(req.app["config"], sample_id) / name
    )

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
        size = await virtool.uploads.utils.naive_writer(req, artifact_file_path)
    except asyncio.CancelledError:
        logger.debug(f"Artifact file upload aborted for sample: {sample_id}")
        await delete_row(pg, upload_id, SampleArtifact)
        await run_in_thread(os.remove, artifact_file_path)
        return aiohttp.web.Response(status=499)

    artifact = await virtool.uploads.db.finalize(pg, size, upload_id, SampleArtifact)

    headers = {"Location": f"/samples/{sample_id}/artifact/{name}"}

    return json_response(artifact, status=201, headers=headers)


@routes.jobs_api.put("/samples/{sample_id}/reads/{filename}")
async def upload_reads(req):
    """
    Upload sample reads using the Jobs API.

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

    reads_path = (
        virtool.samples.utils.join_sample_path(req.app["config"], sample_id) / name
    )

    if not await db.samples.find_one(sample_id):
        raise NotFound()

    try:
        size = await virtool.uploads.utils.naive_writer(
            req, reads_path, is_gzip_compressed
        )
    except OSError:
        raise HTTPBadRequest(text="File is not compressed")
    except asyncio.CancelledError:
        logger.debug(f"Reads file upload aborted for {sample_id}")
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
    Create a new cache document using the Jobs API.

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
    Upload reads files to cache using the Jobs API.

    """
    db = req.app["db"]
    pg = req.app["pg"]

    name = req.match_info["filename"]
    sample_id = req.match_info["sample_id"]
    key = req.match_info["key"]

    if name not in ["reads_1.fq.gz", "reads_2.fq.gz"]:
        raise HTTPBadRequest(text="File name is not an accepted reads file")

    cache_path = (
        Path(virtool.caches.utils.join_cache_path(req.app["config"], key)) / name
    )

    if not await db.caches.count_documents({"key": key, "sample.id": sample_id}):
        raise NotFound("Cache doesn't exist with given key")

    try:
        size = await virtool.uploads.utils.naive_writer(
            req, cache_path, is_gzip_compressed
        )
    except OSError:
        raise HTTPBadRequest(text="File is not compressed")
    except exc.IntegrityError:
        raise HTTPConflict(text="File name is already uploaded for this cache")
    except asyncio.CancelledError:
        logger.debug(f"Reads cache file upload aborted for {key}")
        return aiohttp.web.Response(status=499)

    reads = await create_reads_file(
        pg, size, name, name, sample_id, key=key, cache=True
    )

    headers = {"Location": f"/samples/{sample_id}/caches/{key}/reads/{reads['id']}"}

    return json_response(reads, status=201, headers=headers)


@routes.jobs_api.post("/samples/{sample_id}/caches/{key}/artifacts")
async def upload_cache_artifact(req):
    """
    Upload sample artifacts to cache using the Jobs API.

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

    cache_path = join_cache_path(req.app["config"], key) / name

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
        size = await virtool.uploads.utils.naive_writer(req, cache_path)
    except asyncio.CancelledError:
        logger.debug(f"Artifact file cache upload aborted for sample: {sample_id}")
        await delete_row(pg, upload_id, SampleArtifact)
        await run_in_thread(os.remove, cache_path)
        return aiohttp.web.Response(status=499)

    artifact = await virtool.uploads.db.finalize(
        pg, size, upload_id, SampleArtifactCache
    )

    headers = {"Location": f"/samples/{sample_id}/caches/{key}/artifacts/{name}"}

    return json_response(artifact, status=201, headers=headers)


@routes.jobs_api.patch("/samples/{sample_id}/caches/{key}")
@schema({"quality": {"type": "dict", "required": True}})
async def finalize_cache(req):
    db = req.app["db"]
    data = req["data"]
    key = req.match_info["key"]

    document = await db.caches.find_one_and_update(
        {"key": key}, {"$set": {"quality": data["quality"], "ready": True}}
    )

    processed = virtool.utils.base_processor(document)

    return json_response(processed)


@routes.get("/samples/{sample_id}/reads/reads_{suffix}.fq.gz")
@routes.jobs_api.get("/samples/{sample_id}/reads/reads_{suffix}.fq.gz")
async def download_reads(req: aiohttp.web.Request):
    """
    Download the sample reads file.

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

    file_path = req.app["config"].data_path / "samples" / sample_id / file_name

    if not os.path.isfile(file_path):
        raise NotFound()

    file_stats = virtool.utils.file_stats(file_path)

    headers = {"Content-Length": file_stats["size"], "Content-Type": "application/gzip"}

    return FileResponse(file_path, chunk_size=1024 * 1024, headers=headers)


@routes.jobs_api.get("/samples/{sample_id}/artifacts/{filename}")
async def download_artifact(req: aiohttp.web.Request):
    """
    Download the sample artifact.

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
                select(SampleArtifact).filter_by(sample=sample_id, name=filename)
            )
        ).scalar()

    if not result:
        raise NotFound()

    artifact = result.to_dict()

    file_path = (
        req.app["config"].data_path / f"samples/{sample_id}/{artifact['name_on_disk']}"
    )

    if not os.path.isfile(file_path):
        raise NotFound()

    file_stats = virtool.utils.file_stats(file_path)

    headers = {"Content-Length": file_stats["size"], "Content-Type": "application/gzip"}

    return FileResponse(file_path, chunk_size=1024 * 1024, headers=headers)


@routes.jobs_api.get("/samples/{sample_id}/caches/{key}/reads/reads_{suffix}.fq.gz")
async def download_cache_reads(req):
    """
    Download sample reads cache for a given key.

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

    file_path = req.app["config"].data_path / "caches" / key / file_name

    if not os.path.isfile(file_path):
        raise NotFound()

    file_stats = virtool.utils.file_stats(file_path)

    headers = {"Content-Length": file_stats["size"], "Content-Type": "application/gzip"}

    return FileResponse(file_path, chunk_size=1024 * 1024, headers=headers)


@routes.jobs_api.get("/samples/{sample_id}/caches/{key}/artifacts/{filename}")
async def download_cache_artifact(req):
    """
    Download sample artifact cache for a given key.

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
                select(SampleArtifactCache).filter_by(
                    name=filename, key=key, sample=sample_id
                )
            )
        ).scalar()

    if not result:
        raise NotFound()

    artifact = result.to_dict()

    file_path = req.app["config"].data_path / "caches" / key / artifact["name_on_disk"]

    if not file_path.exists():
        raise NotFound()

    file_stats = virtool.utils.file_stats(file_path)

    headers = {"Content-Length": file_stats["size"], "Content-Type": "application/gzip"}

    return FileResponse(file_path, chunk_size=1024 * 1024, headers=headers)
