import asyncio.tasks
import logging
import os
from asyncio import gather
from pathlib import Path

import aiohttp.web
import pymongo.errors
import virtool.analyses.db
import virtool.caches.db
import virtool.db.utils
import virtool.jobs.db
import virtool.samples.db
import virtool.samples.utils
import virtool.uploads.db
import virtool.uploads.utils
import virtool.utils
from aiohttp.web_exceptions import HTTPBadRequest, HTTPConflict, HTTPNoContent
from aiohttp.web_fileresponse import FileResponse
from cerberus import Validator
from sqlalchemy import exc, select
from sqlalchemy.ext.asyncio import AsyncSession
from virtool.analyses.db import PROJECTION
from virtool.analyses.utils import WORKFLOW_NAMES
from virtool.api.response import (InsufficientRights, InvalidQuery, NotFound,
                                  json_response)
from virtool.api.utils import compose_regex_query, paginate
from virtool.caches.models import SampleArtifactCache
from virtool.caches.utils import join_cache_path
from virtool.errors import DatabaseError
from virtool.http.routes import Routes
from virtool.http.schema import schema
from virtool.jobs.utils import JobRights
from virtool.pg.utils import delete_row, get_rows
from virtool.samples.db import (LIST_PROJECTION, RIGHTS_PROJECTION,
                                attach_labels, check_name, check_rights,
                                compose_sample_workflow_query, create_sample,
                                get_sample_owner, recalculate_workflow_tags,
                                validate_force_choice_group)
from virtool.samples.files import (create_artifact_file, create_reads_file,
                                   get_existing_reads)
from virtool.samples.models import ArtifactType, SampleArtifact, SampleReads
from virtool.samples.utils import bad_labels_response, check_labels
from virtool.subtractions.db import attach_subtractions
from virtool.uploads.utils import is_gzip_compressed
from virtool.users.db import attach_users
from virtool.validators import strip

logger = logging.getLogger("samples")

QUERY_SCHEMA = {
    "find": {
        "type": "string",
        "default": "",
        "coerce": (str, strip)
    },
    "page": {
        "type": "integer",
        "coerce": int,
        "default": 1,
        "min": 1
    },
    "per_page": {
        "type": "integer",
        "coerce": int,
        "default": 15,
        "min": 1,
        "max": 100
    }
}

routes = Routes()


@routes.get("/api/samples")
async def find(req):
    """
    Find samples, filtering by data passed as URL parameters.

    """
    db = req.app["db"]
    pg = req.app["pg"]

    v = Validator(QUERY_SCHEMA, allow_unknown=True)

    if not v.validate(dict(req.query)):
        raise InvalidQuery(v.errors)

    queries = list()

    term = req.query.get("find")

    if term:
        queries.append(compose_regex_query(term, ["name", "user.id"]))

    if "label" in req.query:
        labels = req.query.getall("label")
        labels = [int(label) if label.isdigit() else label for label in labels]

        queries.append({
            "labels": {"$in": labels}
        })

    if "workflows" in req.query:
        queries.append(compose_sample_workflow_query(req.query))

    db_query = dict()

    if queries:
        db_query["$and"] = queries

    rights_filter = [
        # The requesting user is the sample owner
        {"user.id": req["client"].user_id},

        # The sample rights allow all users to view the sample.
        {"all_read": True}
    ]

    if req["client"].groups:
        # The sample rights allow owner group members to view the sample and the requesting user
        # is a member of the owner group.
        rights_filter.append({
            "group_read": True,
            "group": {"$in": req["client"].groups}
        })

    base_query = {
        "$or": rights_filter
    }

    data = await paginate(
        db.samples,
        db_query,
        req.query,
        sort="created_at",
        projection=LIST_PROJECTION,
        base_query=base_query,
        reverse=True
    )

    documents = await gather(*[attach_labels(pg, d) for d in data["documents"]])
    documents = await attach_users(db, documents)

    return json_response({
        **data,
        "documents": documents
    })


@routes.get("/api/samples/{sample_id}")
async def get(req):
    """
    Get a complete sample document.

    """
    sample_id = req.match_info["sample_id"]

    try:
        sample = await virtool.samples.db.get_sample(req.app, sample_id)

        rights = virtool.samples.utils.get_sample_rights(
            sample,
            req["client"]
        )[0]

        if not rights:
            raise InsufficientRights()

        return json_response(sample)
    except ValueError:
        raise NotFound()


@routes.jobs_api.get("/api/samples/{sample_id}")
async def get_sample(req):
    """
    Get a complete sample document from a job.

    """
    sample_id = req.match_info["sample_id"]

    try:
        return json_response(
            await virtool.samples.db.get_sample(req.app, sample_id)
        )
    except ValueError:
        raise NotFound()


@routes.jobs_api.get("/api/samples/{sample_id}/caches/{cache_key}")
async def get_cache(req):
    """
    Get a cache document by key using the Jobs API.

    """
    db = req.app["db"]

    sample_id = req.match_info["sample_id"]
    cache_key = req.match_info["cache_key"]

    document = await db.caches.find_one({
        "key": cache_key,
        "sample.id": sample_id
    })

    if document is None:
        raise NotFound()

    return json_response(virtool.utils.base_processor(document))


@routes.post("/api/samples", permission="create_sample")
@schema({
    "name": {
        "type": "string",
        "coerce": strip,
        "empty": False,
        "required": True
    },
    "host": {
        "type": "string",
        "coerce": strip,
        "default": ''
    },
    "isolate": {
        "type": "string",
        "coerce": strip,
        "default": ''
    },
    "group": {
        "type": "string"
    },
    "locale": {
        "type": "string",
        "coerce": strip,
        "default": ''
    },
    "library_type": {
        "type": "string",
        "allowed": [
            "normal",
            "srna",
            "amplicon"
        ],
        "default": "normal"
    },
    "subtractions": {
        "type": "list",
        "default": []
    },
    "files": {
        "type": "list",
        "minlength": 1,
        "maxlength": 2,
        "required": True
    },
    "notes": {
        "type": "string",
        "default": ''
    },
    "labels": {
        "type": "list",
        "default": []
    }
})
async def create(req):
    db = req.app["db"]
    pg = req.app["pg"]
    data = req["data"]
    user_id = req["client"].user_id
    settings = req.app["settings"]

    name_error_message = await check_name(db, req.app["settings"], data["name"])

    if name_error_message:
        raise HTTPBadRequest(text=name_error_message)

    subtractions = data.get("subtractions", list())

    # Make sure each subtraction host was submitted and it exists.
    non_existent_subtractions = await virtool.db.utils.check_missing_ids(
        db.subtraction,
        subtractions
    )

    if non_existent_subtractions:
        raise HTTPBadRequest(
            text=f"Subtractions do not exist: {','.join(non_existent_subtractions)}")

    if "labels" in data:
        non_existent_labels = await check_labels(pg, data["labels"])

        if non_existent_labels:
            return bad_labels_response(non_existent_labels)

    try:
        uploads = [(await virtool.uploads.db.get(pg, file_)).to_dict() for file_ in data["files"]]
    except AttributeError:
        raise HTTPBadRequest(text="File does not exist")

    sample_group_setting = settings.sample_group

    group = "none"

    # Require a valid ``group`` field if the ``sample_group`` setting is ``users_primary_group``.
    if sample_group_setting == "force_choice":
        force_choice_error_message = await validate_force_choice_group(db, data)

        if force_choice_error_message:
            raise HTTPBadRequest(text=force_choice_error_message)

        group = data["group"]

    # Assign the user"s primary group as the sample owner group if the setting is
    # ``users_primary_group``.
    elif sample_group_setting == "users_primary_group":
        group = await virtool.db.utils.get_one_field(db.users, "primary_group", user_id)

    files = [
        {"id": upload["id"], "name": upload["name"], "size": upload["size"]}
        for upload in uploads
    ]

    document = await create_sample(
        db,
        data["name"],
        data["host"],
        data["isolate"],
        group,
        data["locale"],
        data["library_type"],
        data["subtractions"],
        data["notes"],
        data["labels"],
        user_id,
        settings,
        paired=len(files) == 2,
    )

    sample_id = document["_id"]

    await virtool.uploads.db.reserve(pg, data["files"])

    task_args = {
        "sample_id": sample_id,
        "files": files
    }

    rights = JobRights()

    rights.samples.can_read(sample_id)
    rights.samples.can_modify(sample_id)
    rights.samples.can_remove(sample_id)
    rights.uploads.can_read(*data["files"])

    # Create job document.
    job = await virtool.jobs.db.create(
        db,
        "create_sample",
        task_args,
        user_id,
        rights
    )

    await req.app["jobs"].enqueue(job["_id"])

    headers = {
        "Location": f"/api/samples/{sample_id}"
    }

    return json_response(
        await virtool.samples.db.get_sample(req.app, sample_id),
        status=201,
        headers=headers
    )


@routes.patch("/api/samples/{sample_id}")
@schema({
    "name": {
        "type": "string",
        "coerce": strip,
        "empty": False
    },
    "host": {
        "type": "string",
        "coerce": strip,
    },
    "isolate": {
        "type": "string",
        "coerce": strip,
    },
    "locale": {
        "type": "string",
        "coerce": strip,
    },
    "notes": {
        "type": "string",
        "coerce": strip,
    },
    "labels": {
        "type": "list"
    },
    "subtractions": {
        "type": "list"
    }
})
async def edit(req):
    """
    Update specific fields in the sample document.

    """
    db = req.app["db"]
    pg = req.app["pg"]
    data = req["data"]

    sample_id = req.match_info["sample_id"]

    if not await check_rights(db, sample_id, req["client"]):
        raise InsufficientRights()

    if "name" in data:
        message = await check_name(
            db,
            req.app["settings"],
            data["name"],
            sample_id=sample_id
        )

        if message:
            raise HTTPBadRequest(text=message)

    if "labels" in data:
        non_existent_labels = await check_labels(pg, data["labels"])

        if non_existent_labels:
            return bad_labels_response(non_existent_labels)

    if "subtractions" in data:
        non_existent_subtractions = await virtool.db.utils.check_missing_ids(
            db.subtraction,
            data["subtractions"]
        )

        if non_existent_subtractions:
            raise HTTPBadRequest(
                text=f"Subtractions do not exist: {','.join(non_existent_subtractions)}")

    await db.samples.update_one({"_id": sample_id}, {
        "$set": data
    })

    return json_response(
        await virtool.samples.db.get_sample(req.app, sample_id)
    )


@routes.jobs_api.patch("/api/samples/{sample_id}")
@schema({
    "quality": {
        "type": "dict",
        "required": True
    }
})
async def finalize(req):
    """
    Finalize a sample that is being created using the Jobs API by setting a sample's quality field
    and `ready` to `True`

    """
    data = req["data"]

    sample_id = req.match_info["sample_id"]

    await virtool.samples.db.finalize(
        req.app["db"],
        req.app["pg"],
        sample_id,
        data["quality"],
        req.app["run_in_thread"],
        req.app["config"].data_path
    )

    return json_response(await virtool.samples.db.get_sample(req.app, sample_id))


@routes.patch("/api/samples/{sample_id}/rights")
@schema({
    "group": {
        "type": "string"
    },
    "all_read": {
        "type": "boolean"
    },
    "all_write": {
        "type": "boolean"
    },
    "group_read": {
        "type": "boolean"
    },
    "group_write": {
        "type": "boolean"
    }
})
async def set_rights(req):
    """
    Change rights settings for the specified sample document.

    """
    db = req.app["db"]
    data = req["data"]

    sample_id = req.match_info["sample_id"]

    if not await db.samples.count_documents({"_id": sample_id}):
        raise NotFound()

    user_id = req["client"].user_id

    # Only update the document if the connected user owns the samples or is an administrator.
    if not req["client"].administrator and user_id != await get_sample_owner(db, sample_id):
        raise InsufficientRights("Must be administrator or sample owner")

    group = data.get("group")

    if group:
        existing_group_ids = await db.groups.distinct("_id") + ["none"]

        if group not in existing_group_ids:
            raise HTTPBadRequest(text="Group does not exist")

    # Update the sample document with the new rights.
    document = await db.samples.find_one_and_update({"_id": sample_id}, {
        "$set": data
    }, projection=RIGHTS_PROJECTION)

    return json_response(document)


@routes.delete("/api/samples/{sample_id}")
async def remove(req):
    """
    Remove a sample document and all associated analyses.

    """
    db = req.app["db"]
    client = req["client"]

    sample_id = req.match_info["sample_id"]

    try:
        if not await check_rights(db, sample_id, client):
            raise InsufficientRights()
    except DatabaseError as err:
        if "Sample does not exist" in str(err):
            raise NotFound()

        raise

    await virtool.samples.db.remove_samples(
        db,
        req.app["config"],
        [sample_id]
    )

    raise HTTPNoContent


@routes.jobs_api.delete("/api/samples/{sample_id}")
async def job_remove(req):
    """
    Remove a sample document and all associated analyses. Only usable in the Jobs API and when
    samples are unfinalized.

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

    await virtool.samples.db.remove_samples(
        db,
        req.app["config"],
        [sample_id]
    )

    raise HTTPNoContent


@routes.get("/api/samples/{sample_id}/analyses")
async def find_analyses(req):
    """
    List the analyses associated with the given ``sample_id``.

    """
    db = req.app["db"]

    sample_id = req.match_info["sample_id"]

    try:
        if not await check_rights(db, sample_id, req["client"], write=False):
            raise InsufficientRights()
    except DatabaseError as err:
        if "Sample does not exist" in str(err):
            raise NotFound()

        raise

    term = req.query.get("term")

    db_query = dict()

    if term:
        db_query.update(compose_regex_query(
            term, ["reference.name", "user.id"]))
    base_query = {
        "sample.id": sample_id
    }

    data = await paginate(
        db.analyses,
        db_query,
        req.query,
        base_query=base_query,
        projection=PROJECTION,
        sort=[("created_at", -1)]
    )

    documents = await asyncio.tasks.gather(
        *[attach_subtractions(db, d) for d in data["documents"]]
    )

    documents = await attach_users(db, documents)

    return json_response({
        **data,
        "documents": documents
    })


@routes.post("/api/samples/{sample_id}/analyses")
@schema({
    "ref_id": {
        "type": "string",
        "required": True
    },
    "subtractions": {
        "type": "list"
    },
    "workflow": {
        "type": "string",
        "required": True,
        "allowed": WORKFLOW_NAMES
    }
})
async def analyze(req):
    """
    Starts an analysis job for a given sample.

    """
    db = req.app["db"]
    data = req["data"]

    sample_id = req.match_info["sample_id"]
    ref_id = data["ref_id"]

    try:
        if not await check_rights(db, sample_id, req["client"]):
            raise InsufficientRights()
    except DatabaseError as err:
        if "Sample does not exist" in str(err):
            raise NotFound()

        raise

    if not await db.references.count_documents({"_id": ref_id}):
        raise HTTPBadRequest(text="Reference does not exist")

    if not await db.indexes.count_documents({"reference.id": ref_id, "ready": True}):
        raise HTTPBadRequest(text="No ready index")

    subtractions = data.get("subtractions")

    if subtractions is None:
        subtractions = []
    else:
        non_existent_subtractions = await virtool.db.utils.check_missing_ids(
            db.subtraction, subtractions
        )

        if non_existent_subtractions:
            raise HTTPBadRequest(
                text=f"Subtractions do not exist: {','.join(non_existent_subtractions)}")

    job_id = await virtool.db.utils.get_new_id(db.jobs)

    document = await virtool.analyses.db.create(
        req.app["db"],
        sample_id,
        ref_id,
        subtractions,
        req["client"].user_id,
        data["workflow"],
        job_id
    )

    analysis_id = document["_id"]
    sample = await db.samples.find_one(sample_id, ["name"])

    task_args = {
        "analysis_id": analysis_id,
        "ref_id": ref_id,
        "sample_id": sample_id,
        "sample_name": sample["name"],
        "index_id": document["index"]["id"],
        "subtractions": subtractions
    }

    rights = JobRights()

    rights.analyses.can_read(analysis_id)
    rights.analyses.can_modify(analysis_id)
    rights.analyses.can_remove(analysis_id)
    rights.samples.can_read(sample_id)
    rights.indexes.can_read(document["index"]["id"])
    rights.references.can_read(ref_id)
    rights.subtractions.can_read(*subtractions)

    # Create job document.
    job = await virtool.jobs.db.create(
        db,
        document["workflow"],
        task_args,
        document["user"]["id"],
        rights
    )

    await req.app["jobs"].enqueue(job["_id"])

    await recalculate_workflow_tags(db, sample_id)

    return json_response(
        virtool.utils.base_processor(document),
        status=201,
        headers={
            "Location": f"/api/analyses/{analysis_id}"
        }
    )


@routes.jobs_api.delete("/api/samples/{sample_id}/caches/{cache_key}")
async def cache_job_remove(req: aiohttp.web.Request):
    """
    Remove a cache document. Only usable in the Jobs API and when caches are unfinalized.

    """
    db = req.app["db"]

    cache_key = req.match_info["cache_key"]

    document = await db.caches.find_one({
        "key": cache_key
    })

    if document is None:
        raise NotFound()

    if "ready" in document and document["ready"]:
        raise HTTPConflict(text="Jobs cannot delete finalized caches")

    await virtool.caches.db.remove(req.app, document["_id"])

    raise HTTPNoContent


@routes.jobs_api.post("/api/samples/{sample_id}/artifacts")
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

    artifact_file_path = virtool.samples.utils.join_sample_path(
        req.app["config"], sample_id) / name

    if artifact_type and artifact_type not in ArtifactType.to_list():
        raise HTTPBadRequest(text="Unsupported sample artifact type")

    try:
        artifact = await create_artifact_file(pg, name, name, sample_id, artifact_type)
    except exc.IntegrityError:
        raise HTTPConflict(
            text="Artifact file has already been uploaded for this sample")

    upload_id = artifact["id"]

    try:
        size = await virtool.uploads.utils.naive_writer(req, artifact_file_path)
    except asyncio.CancelledError:
        logger.debug(f"Artifact file upload aborted for sample: {sample_id}")
        await delete_row(pg, upload_id, SampleArtifact)
        await req.app["run_in_thread"](os.remove, artifact_file_path)
        return aiohttp.web.Response(status=499)

    artifact = await virtool.uploads.db.finalize(pg, size, upload_id, SampleArtifact)

    headers = {
        "Location": f"/api/samples/{sample_id}/artifact/{name}"
    }

    return json_response(artifact, status=201, headers=headers)


@routes.jobs_api.put("/api/samples/{sample_id}/reads/{filename}")
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

    reads_path = virtool.samples.utils.join_sample_path(
        req.app["config"], sample_id) / name

    if not await db.samples.find_one(sample_id):
        raise NotFound()

    try:
        size = await virtool.uploads.utils.naive_writer(req, reads_path, is_gzip_compressed)
    except OSError:
        raise HTTPBadRequest(text="File is not compressed")
    except asyncio.CancelledError:
        logger.debug(f"Reads file upload aborted for {sample_id}")
        return aiohttp.web.Response(status=499)
    try:
        reads = await create_reads_file(
            pg,
            size,
            name,
            name,
            sample_id,
            upload_id=upload
        )
    except exc.IntegrityError:
        raise HTTPConflict(
            text="Reads file name is already uploaded for this sample")

    headers = {
        "Location": f"/api/samples/{sample_id}/reads/{reads['name_on_disk']}"
    }

    return json_response(reads, status=201, headers=headers)


@routes.jobs_api.post("/api/samples/{sample_id}/caches")
@schema({
    "key": {
        "type": "string",
        "required": True
    }
})
async def create_cache(req):
    """
    Create a new cache document using the Jobs API.

    """
    db = req.app["db"]
    key = req["data"]["key"]

    sample_id = req.match_info["sample_id"]

    sample = await db.samples.find_one(
        {"_id": sample_id}, ["paired"]
    )

    if not sample:
        raise NotFound("Sample does not exist")

    try:
        document = await virtool.caches.db.create(db, sample_id, key, sample["paired"])
    except pymongo.errors.DuplicateKeyError:
        raise HTTPConflict(
            text=f"Cache with key {key} already exists for this sample")

    headers = {
        "Location": f"/api/samples/{sample_id}/caches/{document['id']}"
    }

    return json_response(document, status=201, headers=headers)


@routes.jobs_api.put("/api/samples/{sample_id}/caches/{key}/reads/{filename}")
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

    cache_path = Path(virtool.caches.utils.join_cache_path(
        req.app["config"], key)) / name

    if not await db.caches.count_documents({"key": key, "sample.id": sample_id}):
        raise NotFound("Cache doesn't exist with given key")

    try:
        size = await virtool.uploads.utils.naive_writer(req, cache_path, is_gzip_compressed)
    except OSError:
        raise HTTPBadRequest(text="File is not compressed")
    except exc.IntegrityError:
        raise HTTPConflict(text="File name is already uploaded for this cache")
    except asyncio.CancelledError:
        logger.debug(f"Reads cache file upload aborted for {key}")
        return aiohttp.web.Response(status=499)

    reads = await create_reads_file(
        pg,
        size,
        name,
        name,
        sample_id,
        key=key,
        cache=True
    )

    headers = {
        "Location": f"/api/samples/{sample_id}/caches/{key}/reads/{reads['id']}"
    }

    return json_response(reads, status=201, headers=headers)


@routes.jobs_api.post("/api/samples/{sample_id}/caches/{key}/artifacts")
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

    cache_path = join_cache_path(
        req.app["config"], key) / name

    if artifact_type and artifact_type not in ArtifactType.to_list():
        raise HTTPBadRequest(text="Unsupported sample artifact type")

    try:
        artifact = await create_artifact_file(pg, name, name, sample_id, artifact_type, key=key)
    except exc.IntegrityError:
        raise HTTPConflict(
            text="Artifact file has already been uploaded for this sample cache")

    upload_id = artifact["id"]

    try:
        size = await virtool.uploads.utils.naive_writer(req, cache_path)
    except asyncio.CancelledError:
        logger.debug(
            f"Artifact file cache upload aborted for sample: {sample_id}")
        await delete_row(pg, upload_id, SampleArtifact)
        await req.app["run_in_thread"](os.remove, cache_path)
        return aiohttp.web.Response(status=499)

    artifact = await virtool.uploads.db.finalize(pg, size, upload_id, SampleArtifactCache)

    headers = {
        "Location": f"/api/samples/{sample_id}/caches/{key}/artifacts/{name}"
    }

    return json_response(artifact, status=201, headers=headers)


@routes.jobs_api.patch("/api/samples/{sample_id}/caches/{key}")
@schema({
    "quality": {
        "type": "dict",
        "required": True
    }
})
async def finalize_cache(req):
    db = req.app["db"]
    data = req["data"]
    key = req.match_info["key"]

    document = await db.caches.find_one_and_update({"key": key}, {
        "$set": {
            "quality": data["quality"],
            "ready": True
        }
    })

    processed = virtool.utils.base_processor(document)

    return json_response(processed)


@routes.get("/api/samples/{sample_id}/reads/reads_{suffix}.fq.gz")
@routes.jobs_api.get("/api/samples/{sample_id}/reads/reads_{suffix}.fq.gz")
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

    headers = {
        "Content-Length": file_stats["size"],
        "Content-Type": "application/gzip"
    }

    return FileResponse(file_path, chunk_size=1024 * 1024, headers=headers)


@routes.jobs_api.get("/api/samples/{sample_id}/artifacts/{filename}")
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
        result = (await session.execute(
            select(SampleArtifact).filter_by(sample=sample_id, name=filename)
        )).scalar()

    if not result:
        raise NotFound()

    artifact = result.to_dict()

    file_path = req.app["config"].data_path / \
        f"samples/{sample_id}/{artifact['name_on_disk']}"

    if not os.path.isfile(file_path):
        raise NotFound()

    file_stats = virtool.utils.file_stats(file_path)

    headers = {
        "Content-Length": file_stats["size"],
        "Content-Type": "application/gzip"
    }

    return FileResponse(file_path, chunk_size=1024 * 1024, headers=headers)


@routes.jobs_api.get("/api/samples/{sample_id}/caches/{key}/reads/reads_{suffix}.fq.gz")
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
            {"_id": sample_id}) or not await db.caches.count_documents({"key": key}):
        raise NotFound()

    existing_reads = await get_existing_reads(pg, sample_id, key=key)

    if file_name not in existing_reads:
        raise NotFound()

    file_path = req.app["config"].data_path / "caches" / key / file_name

    if not os.path.isfile(file_path):
        raise NotFound()

    file_stats = virtool.utils.file_stats(file_path)

    headers = {
        "Content-Length": file_stats["size"],
        "Content-Type": "application/gzip"
    }

    return FileResponse(file_path, chunk_size=1024 * 1024, headers=headers)


@routes.jobs_api.get("/api/samples/{sample_id}/caches/{key}/artifacts/{filename}")
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
            {"_id": sample_id}) or not await db.caches.count_documents({"key": key}):
        raise NotFound()

    async with AsyncSession(pg) as session:
        result = (
            await session.execute(
                select(SampleArtifactCache).filter_by(
                    name=filename, key=key, sample=sample_id)
            )
        ).scalar()

    if not result:
        raise NotFound()

    artifact = result.to_dict()

    file_path = req.app["config"].data_path / \
        "caches" / key / artifact["name_on_disk"]

    if not file_path.exists():
        raise NotFound()

    file_stats = virtool.utils.file_stats(file_path)

    headers = {
        "Content-Length": file_stats["size"],
        "Content-Type": "application/gzip"
    }

    return FileResponse(file_path, chunk_size=1024 * 1024, headers=headers)
