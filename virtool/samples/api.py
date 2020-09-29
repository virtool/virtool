import asyncio.tasks
from copy import deepcopy
from cerberus import Validator

import virtool.analyses.utils
import virtool.analyses.db
import virtool.api.utils
import virtool.files.db
import virtool.jobs.db
import virtool.samples.db
import virtool.db.utils
import virtool.errors
import virtool.http.routes
import virtool.samples.utils
import virtool.subtractions.db
import virtool.utils
import virtool.validators
from virtool.api.response import bad_request, insufficient_rights, invalid_query, \
    json_response, no_content, not_found

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

    return json_response(data)


@routes.get("/api/samples/{sample_id}")
async def get(req):
    """
    Get a complete sample document.

    """
    db = req.app["db"]

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

    if document["ready"] is True:
        # Only update file fields if sample creation is complete.
        for index, file in enumerate(document["files"]):
            snake_case = document["name"].replace(" ", "_")

            file.update({
                "name": file["name"].replace("reads_", f"{snake_case}_"),
                "download_url": file["download_url"].replace("reads_", f"{snake_case}_"),
                "replace_url": f"/upload/samples/{sample_id}/files/{index + 1}"
            })

    await virtool.subtractions.db.attach_subtraction(db, document)

    return json_response(virtool.utils.base_processor(document))


@routes.post("/api/samples", permission="create_sample", schema={
    "name": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "empty": False,
        "required": True
    },
    "host": {
        "type": "string",
        "coerce": virtool.validators.strip,
    },
    "isolate": {
        "type": "string",
        "coerce": virtool.validators.strip,
    },
    "group": {
        "type": "string"
    },
    "locale": {
        "type": "string",
        "coerce": virtool.validators.strip,
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
    "subtraction": {
        "type": "string",
        "required": True
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
        "type": "list"
    }
})
async def create(req):
    db = req.app["db"]
    data = req["data"]
    user_id = req["client"].user_id
    settings = req.app["settings"]

    name_error_message = await virtool.samples.db.check_name(db, req.app["settings"], data["name"])

    if name_error_message:
        return bad_request(name_error_message)

    # Make sure a subtraction host was submitted and it exists.
    if not await db.subtraction.count_documents({"_id": data["subtraction"], "is_host": True}):
        return bad_request("Subtraction does not exist")

    # Make sure all of the passed file ids exist.
    if not await virtool.db.utils.ids_exist(db.files, data["files"]):
        return bad_request("File does not exist")

    sample_id = await virtool.db.utils.get_new_id(db.samples)

    document = deepcopy(data)

    sample_group_setting = settings["sample_group"]

    # Require a valid ``group`` field if the ``sample_group`` setting is ``users_primary_group``.
    if sample_group_setting == "force_choice":
        force_choice_error_message = await virtool.samples.db.validate_force_choice_group(db, data)

        if force_choice_error_message:
            if "not found" in force_choice_error_message:
                return bad_request(force_choice_error_message)

            return bad_request(force_choice_error_message)

    # Assign the user"s primary group as the sample owner group if the setting is ``users_primary_group``.
    elif sample_group_setting == "users_primary_group":
        document["group"] = await virtool.db.utils.get_one_field(db.users, "primary_group", user_id)

    # Make the owner group none if the setting is none.
    elif sample_group_setting == "none":
        document["group"] = "none"

    document.update({
        "_id": sample_id,
        "nuvs": False,
        "pathoscope": False,
        "created_at": virtool.utils.timestamp(),
        "format": "fastq",
        "ready": False,
        "quality": None,
        "hold": True,
        "group_read": settings["sample_group_read"],
        "group_write": settings["sample_group_write"],
        "all_read": settings["sample_all_read"],
        "all_write": settings["sample_all_write"],
        "library_type": data["library_type"],
        "subtraction": {
            "id": data["subtraction"]
        },
        "user": {
            "id": user_id
        },
        "paired": len(data["files"]) == 2
    })

    files = [await db.files.find_one(file_id, ["_id", "name", "size"]) for file_id in data["files"]]

    files = [virtool.utils.base_processor(file) for file in files]

    document["files"] = files

    await db.samples.insert_one(document)

    await virtool.files.db.reserve(db, data["files"])

    task_args = {
        "sample_id": sample_id,
        "files": files
    }

    # Create job document.
    job = await virtool.jobs.db.create(
        db,
        "create_sample",
        task_args,
        user_id
    )

    await req.app["jobs"].enqueue(job["_id"])

    headers = {
        "Location": "/api/samples/" + sample_id
    }

    return json_response(virtool.utils.base_processor(document), status=201, headers=headers)


@routes.patch("/api/samples/{sample_id}", schema={
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
    }
})
async def edit(req):
    """
    Update specific fields in the sample document.

    """
    db = req.app["db"]
    data = req["data"]

    sample_id = req.match_info["sample_id"]

    if not await virtool.samples.db.check_rights(db, sample_id, req["client"]):
        return insufficient_rights()

    message = await virtool.samples.db.check_name(db, req.app["settings"], data["name"], sample_id=sample_id)

    if message:
        return bad_request(message)

    document = await db.samples.find_one_and_update({"_id": sample_id}, {
        "$set": data
    }, projection=virtool.samples.db.LIST_PROJECTION)

    processed = virtool.utils.base_processor(document)

    return json_response(processed)


@routes.put("/api/samples/{sample_id}/update_job")
async def replace(req):
    sample_id = req.match_info["sample_id"]

    await virtool.samples.db.attempt_file_replacement(
        req.app,
        sample_id,
        req["client"].user_id
    )

    document = await req.app["db"].samples.find_one(sample_id, virtool.samples.db.PROJECTION)

    return json_response(virtool.utils.base_processor(document))


@routes.patch("/api/samples/{sample_id}/rights", schema={
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

    sample_id = req.match_info["sample_id"]

    try:
        if not await virtool.samples.db.check_rights(db, sample_id, req["client"]):
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

    await asyncio.tasks.gather(*[virtool.subtractions.db.attach_subtraction(db, d) for d in data["documents"]])

    return json_response(data)


@routes.post("/api/samples/{sample_id}/analyses", schema={
    "ref_id": {
        "type": "string",
        "required": True
    },
    "subtraction_id": {
        "type": "string"
    },
    "workflow": {
        "type": "string",
        "required": True,
        "allowed": virtool.analyses.utils.WORKFLOW_NAMES
    },
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

    subtraction_id = data.get("subtraction_id")

    if subtraction_id is None:
        subtraction = await virtool.db.utils.get_one_field(db.samples, "subtraction", sample_id)
        subtraction_id = subtraction["id"]

    # Generate a unique _id for the analysis entry
    document = await virtool.analyses.db.new(
        req.app,
        sample_id,
        ref_id,
        subtraction_id,
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
