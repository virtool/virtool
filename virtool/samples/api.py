import asyncio.tasks
import logging
import os
from pathlib import Path

import aiohttp.web
import pymongo.errors
from aiohttp.web_fileresponse import FileResponse
from cerberus import Validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import virtool.analyses.db
import virtool.analyses.utils
import virtool.api.utils
import virtool.caches.db
import virtool.caches.utils
import virtool.db.utils
import virtool.errors
import virtool.http.routes
import virtool.jobs.db
import virtool.pg.utils
import virtool.samples.db
import virtool.samples.files
import virtool.samples.utils
import virtool.subtractions.db
import virtool.uploads.db
import virtool.uploads.utils
import virtool.utils
import virtool.validators
from virtool.api.response import bad_request, conflict, insufficient_rights, invalid_query, \
    json_response, no_content, not_found
from virtool.http.schema import schema
from virtool.jobs.utils import JobRights
from virtool.samples.models import ArtifactType, SampleArtifact, SampleArtifactCache
from virtool.samples.utils import bad_labels_response, check_labels
from virtool.uploads.utils import is_gzip_compressed

logger = logging.getLogger("samples")

QUERY_SCHEMA = {
    "find": {
        "type": "string",
        "default": "",
        "coerce": (str, virtool.validators.strip)
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
    },
    "filter": {
        "type": "string",
        "default": ""
    }
}

routes = virtool.http.routes.Routes()


@routes.get("/api/samples")
async def find(req):
    """
    Find samples, filtering by data passed as URL parameters.

    """
    db = req.app["db"]

    workflow_query = virtool.samples.db.compose_analysis_query(req.query)

    v = Validator(QUERY_SCHEMA, allow_unknown=True)

    if not v.validate(dict(req.query)):
        return invalid_query(v.errors)

    query = v.document

    filter_query = dict()
    if "filter" in req.query:
        filter_query = {
            "labels": {"$in": req.query.getall("filter")}
        }

    rights_filter = [
        # The requesting user is the sample owner
        {"user.id": req["client"].user_id},

        # The sample rights allow all users to view the sample.
        {"all_read": True}
    ]

    if req["client"].groups:
        # The sample rights allow owner group members to view the sample and the requesting user is a member of
        # the owner group.
        rights_filter.append({
            "group_read": True,
            "group": {"$in": req["client"].groups}
        })

    base_query = {
        "$or": rights_filter
    }

    db_query = dict()

    term = query.get("find")

    if term:
        db_query = virtool.api.utils.compose_regex_query(term, ["name", "user.id"])

    if workflow_query:
        if db_query:
            db_query = {
                "$and": [
                    db_query,
                    workflow_query
                ]
            }
        else:
            db_query = workflow_query

    if filter_query:
        db_query = {
            "$and": [
                db_query,
                filter_query
            ]
        }

    data = await virtool.api.utils.paginate(
        db.samples,
        db_query,
        req.query,
        sort="created_at",
        projection=virtool.samples.db.LIST_PROJECTION,
        base_query=base_query,
        reverse=True
    )

    for i in range(len(data["documents"])):
        data["documents"][i] = await virtool.samples.db.attach_labels(req.app["pg"], data["documents"][i])

    return json_response(data)


@routes.get("/api/samples/{sample_id}")
@routes.jobs_api.get("/api/samples/{sample_id}")
async def get(req):
    """
    Get a complete sample document.

    """
    db = req.app["db"]
    pg = req.app["pg"]

    sample_id = req.match_info["sample_id"]

    document = await db.samples.find_one(sample_id)

    if not document:
        return not_found()

    if not virtool.samples.utils.get_sample_rights(document, req["client"])[0]:
        return insufficient_rights()

    caches = list()

    async for cache in db.caches.find({"sample.id": sample_id}):
        caches.append(virtool.utils.base_processor(cache))

    document["caches"] = caches

    document = await virtool.subtractions.db.attach_subtractions(db, document)
    document = await virtool.samples.db.attach_labels(pg, document)
    document = await virtool.samples.db.attach_artifacts_and_reads(pg, document)

    if document["ready"]:
        for file in document["reads"]:
            file.update({
                "download_url": f"/api/samples/{sample_id}/reads/{file['name']}"
            })

    return json_response(virtool.utils.base_processor(document))


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
        return not_found()

    return json_response(virtool.utils.base_processor(document))


@routes.post("/api/samples", permission="create_sample")
@schema({
    "name": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "empty": False,
        "required": True
    },
    "host": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "default": ''
    },
    "isolate": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "default": ''
    },
    "group": {
        "type": "string"
    },
    "locale": {
        "type": "string",
        "coerce": virtool.validators.strip,
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

    name_error_message = await virtool.samples.db.check_name(db, req.app["settings"], data["name"])

    if name_error_message:
        return bad_request(name_error_message)

    subtractions = data.get("subtractions", list())

    # Make sure each subtraction host was submitted and it exists.
    non_existent_subtractions = await virtool.db.utils.check_missing_ids(
        db.subtraction,
        subtractions
    )

    if non_existent_subtractions:
        return bad_request(f"Subtractions do not exist: {','.join(non_existent_subtractions)}")

    if "labels" in data:
        non_existent_labels = await check_labels(pg, data["labels"])

        if non_existent_labels:
            return bad_labels_response(non_existent_labels)

    # Make sure all of the passed file ids exist.
    for file in data["files"]:
        upload = await virtool.uploads.db.get(pg, file)

        if not upload:
            return bad_request("File does not exist")

    sample_group_setting = settings["sample_group"]

    # Require a valid ``group`` field if the ``sample_group`` setting is ``users_primary_group``.
    if sample_group_setting == "force_choice":
        force_choice_error_message = await virtool.samples.db.validate_force_choice_group(db, data)

        if force_choice_error_message:
            if "not found" in force_choice_error_message:
                return bad_request(force_choice_error_message)

            return bad_request(force_choice_error_message)

        group = data["group"]

    # Assign the user"s primary group as the sample owner group if the setting is
    # ``users_primary_group``.
    elif sample_group_setting == "users_primary_group":
        group = await virtool.db.utils.get_one_field(db.users, "primary_group", user_id)

    # Make the owner group none if the setting is none.
    elif sample_group_setting == "none":
        group = "none"

    uploads = [(await virtool.uploads.db.get(pg, upload_id)).to_dict() for upload_id in data["files"]]

    files = list()
    for upload in uploads:
        file = {
            "id": upload["id"],
            "name": upload["name"],
            "size": upload["size"]
        }
        files.append(file)

    document = await virtool.samples.db.create_sample(db, data["name"], data["host"], data["isolate"], group,
                                                      data["locale"], data["library_type"], data["subtractions"],
                                                      files, data["notes"], data["labels"], user_id, settings)

    sample_id = document["_id"]

    await virtool.uploads.db.reserve(pg, data["files"])

    document = await virtool.samples.db.attach_labels(pg, document)

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
        "Location": "/api/samples/" + sample_id
    }

    return json_response(virtool.utils.base_processor(document), status=201, headers=headers)


@routes.patch("/api/samples/{sample_id}")
@schema({
    "name": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "empty": False
    },
    "host": {
        "type": "string",
        "coerce": virtool.validators.strip,
    },
    "isolate": {
        "type": "string",
        "coerce": virtool.validators.strip,
    },
    "locale": {
        "type": "string",
        "coerce": virtool.validators.strip,
    },
    "notes": {
        "type": "string",
        "coerce": virtool.validators.strip,
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

    if not await virtool.samples.db.check_rights(db, sample_id, req["client"]):
        return insufficient_rights()

    if "name" in data:
        message = await virtool.samples.db.check_name(
            db,
            req.app["settings"],
            data["name"],
            sample_id=sample_id
        )

        if message:
            return bad_request(message)

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
            return bad_request(f"Subtractions do not exist: {','.join(non_existent_subtractions)}")

    document = await db.samples.find_one_and_update({"_id": sample_id}, {
        "$set": data
    }, projection=virtool.samples.db.LIST_PROJECTION)

    document = await virtool.samples.db.attach_labels(pg, document)

    processed = virtool.utils.base_processor(document)

    return json_response(processed)


@routes.jobs_api.patch("/api/samples/{sample_id}")
@schema({
    "quality": {
        "type": "dict",
        "required": True
    }
})
async def finalize(req):
    """
    Finalize a sample that is being created using the Jobs API by setting a sample's quality field and `ready` to `True`

    """
    data = req["data"]

    sample_id = req.match_info["sample_id"]

    document = await virtool.samples.db.finalize(
        req.app["db"],
        req.app["pg"],
        sample_id,
        data["quality"],
        req.app["run_in_thread"],
        req.app["settings"]["data_path"])

    return json_response(virtool.utils.base_processor(document))


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
        return not_found()

    user_id = req["client"].user_id

    # Only update the document if the connected user owns the samples or is an administrator.
    if not req["client"].administrator and user_id != await virtool.samples.db.get_sample_owner(db, sample_id):
        return insufficient_rights("Must be administrator or sample owner")

    group = data.get("group")

    if group:
        existing_group_ids = await db.groups.distinct("_id") + ["none"]

        if group not in existing_group_ids:
            return bad_request("Group does not exist")

    # Update the sample document with the new rights.
    document = await db.samples.find_one_and_update({"_id": sample_id}, {
        "$set": data
    }, projection=virtool.samples.db.RIGHTS_PROJECTION)

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
        if not await virtool.samples.db.check_rights(db, sample_id, client):
            return insufficient_rights()
    except virtool.errors.DatabaseError as err:
        if "Sample does not exist" in str(err):
            return not_found()

        raise

    await virtool.samples.db.remove_samples(
        db,
        req.app["settings"],
        [sample_id]
    )

    return no_content()


@routes.jobs_api.delete("/api/samples/{sample_id}")
async def job_remove(req):
    """
    Remove a sample document and all associated analyses. Only usable in the Jobs API and when samples are unfinalized.

    """
    db = req.app["db"]

    sample_id = req.match_info["sample_id"]

    ready = await virtool.db.utils.get_one_field(db.samples, "ready", sample_id)

    if ready is None:
        return not_found()

    if ready is True:
        return bad_request("Only unfinalized samples can be deleted")

    upload_ids = await virtool.db.utils.get_one_field(db.samples, "files", sample_id)

    if upload_ids:
        await virtool.uploads.db.release(req.app["pg"], upload_ids)

    await virtool.samples.db.remove_samples(
        db,
        req.app["settings"],
        [sample_id]
    )

    return no_content()


@routes.get("/api/samples/{sample_id}/analyses")
async def find_analyses(req):
    """
    List the analyses associated with the given ``sample_id``.

    """
    db = req.app["db"]

    sample_id = req.match_info["sample_id"]

    try:
        if not await virtool.samples.db.check_rights(db, sample_id, req["client"], write=False):
            return insufficient_rights()
    except virtool.errors.DatabaseError as err:
        if "Sample does not exist" in str(err):
            return not_found()

        raise

    term = req.query.get("term")

    db_query = dict()

    if term:
        db_query.update(virtool.api.utils.compose_regex_query(term, ["reference.name", "user.id"]))

    base_query = {
        "sample.id": sample_id
    }

    data = await virtool.api.utils.paginate(
        db.analyses,
        db_query,
        req.query,
        base_query=base_query,
        projection=virtool.analyses.db.PROJECTION,
        sort=[("created_at", -1)]
    )

    data["documents"] = await asyncio.tasks.gather(
        *[virtool.subtractions.db.attach_subtractions(db, d) for d in data["documents"]]
    )

    return json_response(data)


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
        "allowed": virtool.analyses.utils.WORKFLOW_NAMES
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
        if not await virtool.samples.db.check_rights(db, sample_id, req["client"]):
            return insufficient_rights()
    except virtool.errors.DatabaseError as err:
        if "Sample does not exist" in str(err):
            return not_found()

        raise

    if not await db.references.count_documents({"_id": ref_id}):
        return bad_request("Reference does not exist")

    if not await db.indexes.count_documents({"reference.id": ref_id, "ready": True}):
        return bad_request("No ready index")

    subtractions = data.get("subtractions")

    if subtractions is None:
        subtractions = []
    else:
        non_existent_subtractions = await virtool.db.utils.check_missing_ids(
            db.subtraction, subtractions
        )

        if non_existent_subtractions:
            return bad_request(f"Subtractions do not exist: {','.join(non_existent_subtractions)}")

    # Generate a unique _id for the analysis entry
    document = await virtool.analyses.db.create(
        req.app,
        sample_id,
        ref_id,
        subtractions,
        req["client"].user_id,
        data["workflow"]
    )

    document = virtool.utils.base_processor(document)

    sample = await virtool.samples.db.recalculate_workflow_tags(db, sample_id)

    analysis_id = document["id"]

    return json_response(
        document,
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
        return not_found()

    if "ready" in document and document["ready"]:
        return conflict("Jobs cannot delete finalized caches")

    await virtool.caches.db.remove(req.app, document["_id"])

    return no_content()


@routes.jobs_api.post("/api/samples/{sample_id}/artifacts")
async def upload_artifact(req):
    """
    Upload artifact created during sample creation using the Jobs API.

    """
    db = req.app["db"]
    pg = req.app["pg"]

    sample_id = req.match_info["sample_id"]
    artifact_type = req.query.get("type")

    artifact_file_path = Path(virtool.samples.utils.join_sample_path(req.app["settings"], sample_id))

    if not await db.samples.find_one(sample_id):
        return not_found()

    errors = virtool.uploads.utils.naive_validator(req)

    if errors:
        return invalid_query(errors)

    name = req.query.get("name")

    if artifact_type and artifact_type not in ArtifactType.to_list():
        return bad_request("Unsupported sample artifact type")

    artifact = await virtool.samples.files.create_artifact_file(pg, name, sample_id, artifact_type)

    file_id = artifact["id"]

    artifact_file_path = artifact_file_path / artifact["name_on_disk"]

    try:
        size = await virtool.uploads.utils.naive_writer(req, artifact_file_path)
    except asyncio.CancelledError:
        logger.debug(f"Artifact file upload aborted: {file_id}")
        await req.app["run_in_thread"](os.remove, artifact_file_path)
        await virtool.pg.utils.delete_row(pg, file_id, SampleArtifact)

        return aiohttp.web.Response(status=499)

    artifact = await virtool.uploads.db.finalize(pg, size, file_id, SampleArtifact)

    headers = {
        "Location": f"/api/samples/{sample_id}/artifact/{file_id}"
    }

    return json_response(artifact, status=201, headers=headers)


@routes.jobs_api.put("/api/samples/{sample_id}/reads/{name}")
async def upload_reads(req):
    """
    Upload sample reads using the Jobs API.

    """
    db = req.app["db"]
    pg = req.app["pg"]

    name = req.match_info["name"]
    sample_id = req.match_info["sample_id"]

    try:
        upload = int(req.query.get("upload"))
    except TypeError:
        upload = None

    if name not in ["reads_1.fq.gz", "reads_2.fq.gz"]:
        return bad_request("File name is not an accepted reads file")

    reads_path = Path(virtool.samples.utils.join_sample_path(req.app["settings"], sample_id)) / name

    if not await db.samples.find_one(sample_id):
        return not_found()

    existing_reads = await virtool.samples.files.get_existing_reads(pg, sample_id)

    if name in existing_reads:
        return conflict("Reads file is already associated with this sample")

    try:
        size = await virtool.uploads.utils.naive_writer(req, reads_path, is_gzip_compressed)
    except OSError:
        return bad_request("File is not compressed")
    except asyncio.CancelledError:
        logger.debug(f"Reads file upload aborted for {sample_id}")
        return aiohttp.web.Response(status=499)

    reads = await virtool.samples.files.create_reads_file(pg, size, name, name, sample_id, upload_id=upload)

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
        return not_found("Sample does not exist")

    try:
        document = await virtool.caches.db.create(db, sample_id, key, sample["paired"])
    except pymongo.errors.DuplicateKeyError:
        return conflict(f"Cache with key {key} already exists for this sample")

    headers = {
        "Location": f"/api/samples/{sample_id}/caches/{document['id']}"
    }

    return json_response(document, status=201, headers=headers)


@routes.jobs_api.post("/api/samples/{sample_id}/caches/{key}/artifacts")
async def upload_artifacts_cache(req):
    """
    Upload sample artifacts to cache using the Jobs API.

    """
    db = req.app["db"]
    pg = req.app["pg"]

    sample_id = req.match_info["sample_id"]
    key = req.match_info["key"]
    artifact_type = req.query.get("type")

    cache_path = Path(virtool.caches.utils.join_cache_path(req.app["settings"], key))

    if not await db.caches.count_documents({"key": key, "sample.id": sample_id}):
        return not_found()

    errors = virtool.uploads.utils.naive_validator(req)

    if errors:
        return invalid_query(errors)

    name = req.query.get("name")

    if artifact_type and artifact_type not in ArtifactType.to_list():
        return bad_request("Unsupported sample artifact type")

    artifact = await virtool.samples.files.create_artifact_file(pg, name, sample_id, artifact_type, cache=True)

    upload_id = artifact["id"]

    cache_path = cache_path / artifact["name_on_disk"]

    try:
        size = await virtool.uploads.utils.naive_writer(req, cache_path)
    except asyncio.CancelledError:
        logger.debug(f"Artifact file upload aborted: {upload_id}")
        await req.app["run_in_thread"](os.remove, cache_path)
        await virtool.pg.utils.delete_row(pg, upload_id, SampleArtifactCache)
        return aiohttp.web.Response(status=499)

    artifact = await virtool.uploads.db.finalize(pg, size, upload_id, SampleArtifactCache)

    headers = {
        "Location": f"/api/samples/{sample_id}/caches/{key}/{upload_id}"
    }

    return json_response(artifact, status=201, headers=headers)


@routes.jobs_api.put("/api/samples/{sample_id}/caches/{key}/reads/{name}")
async def upload_reads_cache(req):
    """
    Upload reads files to cache using the Jobs API.

    """
    db = req.app["db"]
    pg = req.app["pg"]

    name = req.match_info["name"]
    sample_id = req.match_info["sample_id"]
    key = req.match_info["key"]

    if name not in ["reads_1.fq.gz", "reads_2.fq.gz"]:
        return bad_request("File name is not an accepted reads file")

    cache_path = Path(virtool.caches.utils.join_cache_path(req.app["settings"], key)) / name

    if not await db.caches.count_documents({"key": key, "sample.id": sample_id}):
        return not_found("Cache doesn't exist with given key")

    existing_reads = await virtool.samples.files.get_existing_reads(pg, sample_id, cache=True)

    if name in existing_reads:
        return conflict("Reads file is already associated with this sample")

    try:
        size = await virtool.uploads.utils.naive_writer(req, cache_path, is_gzip_compressed)
    except OSError:
        return bad_request("File is not compressed")
    except asyncio.CancelledError:
        logger.debug(f"Reads cache file upload aborted for {key}")
        return aiohttp.web.Response(status=499)

    reads = await virtool.samples.files.create_reads_file(pg, size, name, name, sample_id)

    headers = {
        "Location": f"/api/samples/{sample_id}/caches/{key}/reads/{reads['id']}"
    }

    return json_response(reads, status=201, headers=headers)


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
        return not_found()

    existing_reads = await virtool.samples.files.get_existing_reads(pg, sample_id)

    if file_name not in existing_reads:
        return not_found()

    file_path = os.path.join(req.app["settings"]["data_path"], "samples", sample_id, file_name)

    if not os.path.isfile(file_path):
        return virtool.api.response.not_found()

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
        return not_found()

    async with AsyncSession(pg) as session:
        result = (await session.execute(select(SampleArtifact).filter_by(sample=sample_id, name=filename))).scalar()

    if not result:
        return not_found()

    artifact = result.to_dict()

    file_path = os.path.join(req.app["settings"]["data_path"], "samples", sample_id, artifact["name_on_disk"])

    if not os.path.isfile(file_path):
        return virtool.api.response.not_found()

    file_stats = virtool.utils.file_stats(file_path)

    headers = {
        "Content-Length": file_stats["size"],
        "Content-Type": "application/gzip"
    }

    return FileResponse(file_path, chunk_size=1024 * 1024, headers=headers)


@routes.jobs_api.get("/api/samples/{sample_id}/caches/{key}/reads/reads_{suffix}.fq.gz")
async def download_reads_cache(req):
    """
    Download sample reads cache for a given key.

    """
    db = req.app["db"]
    pg = req.app["pg"]

    sample_id = req.match_info["sample_id"]
    key = req.match_info["key"]
    suffix = req.match_info["suffix"]

    file_name = f"reads_{suffix}.fq.gz"

    if not await db.samples.count_documents({"_id": sample_id}) or not await db.caches.count_documents({"key": key}):
        return not_found()

    existing_reads = await virtool.samples.files.get_existing_reads(pg, sample_id, cache=True)

    if file_name not in existing_reads:
        return not_found()

    file_path = Path(req.app["settings"]["data_path"]) / "caches" / key / file_name

    if not os.path.isfile(file_path):
        return not_found()

    file_stats = virtool.utils.file_stats(file_path)

    headers = {
        "Content-Length": file_stats["size"],
        "Content-Type": "application/gzip"
    }

    return FileResponse(file_path, chunk_size=1024 * 1024, headers=headers)


@routes.jobs_api.get("/api/samples/{sample_id}/caches/{key}/artifacts/{filename}")
async def download_artifact_cache(req):
    """
    Download sample artifact cache for a given key.

    """
    db = req.app["db"]
    pg = req.app["pg"]

    sample_id = req.match_info["sample_id"]
    key = req.match_info["key"]
    filename = req.match_info["filename"]

    if not await db.samples.count_documents({"_id": sample_id}) or not await db.caches.count_documents({"key": key}):
        return not_found()

    async with AsyncSession(pg) as session:
        result = (
            await session.execute(select(SampleArtifactCache).filter_by(sample=sample_id, name=filename))).scalar()

    if not result:
        return not_found()

    artifact = result.to_dict()

    file_path = Path(req.app["settings"]["data_path"]) / "caches" / key / artifact["name_on_disk"]

    if not file_path.exists():
        return not_found()

    file_stats = virtool.utils.file_stats(file_path)

    headers = {
        "Content-Length": file_stats["size"],
        "Content-Type": "application/gzip"
    }

    return FileResponse(file_path, chunk_size=1024 * 1024, headers=headers)
