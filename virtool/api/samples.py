from cerberus import Validator

import virtool.db.analyses
import virtool.db.files
import virtool.db.jobs
import virtool.db.samples
import virtool.db.utils
import virtool.errors
import virtool.http.routes
import virtool.samples
import virtool.utils
from virtool.api.utils import bad_request, compose_regex_query, insufficient_rights, invalid_query, \
    json_response, no_content, not_found, paginate

QUERY_SCHEMA = {
    "find": {
        "type": "string",
        "default": "",
        "coerce": str
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

routes = virtool.http.routes.Routes()


@routes.get("/api/samples")
async def find(req):
    """
    Find samples, filtering by data passed as URL parameters.

    """
    db = req.app["db"]

    v = Validator(QUERY_SCHEMA, allow_unknown=True)

    if not v.validate(dict(req.query)):
        return invalid_query(v.errors)

    query = v.document

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

    term = query.get("find", None)

    if term:
        db_query = compose_regex_query(term, ["name", "user.id"])

    data = await paginate(
        db.samples,
        db_query,
        req.query,
        sort="created_at",
        projection=virtool.db.samples.LIST_PROJECTION,
        base_query=base_query,
        reverse=True
    )

    return json_response(data)


@routes.get("/api/samples/{sample_id}")
async def get(req):
    """
    Get a complete sample document.

    """
    document = await req.app["db"].samples.find_one(req.match_info["sample_id"])

    if not document:
        return not_found()

    if not virtool.samples.get_sample_rights(document, req["client"])[0]:
        return insufficient_rights()

    return json_response(virtool.utils.base_processor(document))


@routes.post("/api/samples", permission="create_sample", schema={
    "name": {
        "type": "string",
        "empty": False,
        "required": True
    },
    "host": {
        "type": "string"
    },
    "isolate": {
        "type": "string"
    },
    "group": {
        "type": "string"
    },
    "locale": {
        "type": "string"
    },
    "srna": {
        "type": "boolean",
        "coerce": virtool.utils.to_bool,
        "default": False
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
    }
})
async def create(req):
    db = req.app["db"]
    data = req["data"]
    user_id = req["client"].user_id
    settings = req.app["settings"]

    name_error_message = await virtool.db.samples.check_name(db, req.app["settings"], data["name"])

    if name_error_message:
        return bad_request(name_error_message)

    # Make sure a subtraction host was submitted and it exists.
    if not await db.subtraction.count({"_id": data["subtraction"], "is_host": True}):
        return bad_request("Subtraction does not exist")

    # Make sure all of the passed file ids exist.
    if not await virtool.db.utils.ids_exist(db.files, data["files"]):
        return bad_request("File does not exist")

    sample_id = await virtool.db.utils.get_new_id(db.samples)

    document = data

    sample_group_setting = settings.get("sample_group")

    # Require a valid ``group`` field if the ``sample_group`` setting is ``users_primary_group``.
    if sample_group_setting == "force_choice":
        force_choice_error_message = await virtool.db.samples.validate_force_choice_group(db, data)

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
        "imported": "ip",
        "quality": None,
        "analyzed": False,
        "hold": True,
        "archived": False,
        "group_read": settings["sample_group_read"],
        "group_write": settings["sample_group_write"],
        "all_read": settings["sample_all_read"],
        "all_write": settings["sample_all_write"],
        "srna": data["srna"],
        "subtraction": {
            "id": data["subtraction"]
        },
        "user": {
            "id": user_id
        }
    })

    await db.samples.insert_one(document)

    await virtool.db.files.reserve(db, data["files"])

    task_args = {
        "sample_id": sample_id,
        "files": document["files"],
        "srna": data["srna"]
    }

    # Create job document.
    job = await virtool.db.jobs.create(
        db,
        req.app["settings"],
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
    "name": {"type": "string", "minlength": 1},
    "host": {"type": "string"},
    "isolate": {"type": "string"},
    "locale": {"type": "string"}
})
async def edit(req):
    """
    Update specific fields in the sample document.

    """
    db = req.app["db"]
    data = req["data"]

    sample_id = req.match_info["sample_id"]

    if not await virtool.db.samples.check_rights(db, sample_id, req["client"]):
        return insufficient_rights()

    message = await virtool.db.samples.check_name(db, req.app["settings"], data["name"], sample_id=sample_id)

    if message:
        return bad_request(message)

    document = await db.samples.find_one_and_update({"_id": sample_id}, {
        "$set": data
    }, projection=virtool.db.samples.LIST_PROJECTION)

    processed = virtool.utils.base_processor(document)

    return json_response(processed)


@routes.patch("/api/samples/{sample_id}/rights", schema={
    "group": {"type": "string"},
    "all_read": {"type": "boolean"},
    "all_write": {"type": "boolean"},
    "group_read": {"type": "boolean"},
    "group_write": {"type": "boolean"}
})
async def set_rights(req):
    """
    Change rights settings for the specified sample document.

    """
    db = req.app["db"]
    data = req["data"]

    sample_id = req.match_info["sample_id"]

    if not await db.samples.count({"_id": sample_id}):
        return not_found()

    user_id = req["client"].user_id

    print(req["client"].administrator)

    # Only update the document if the connected user owns the samples or is an administrator.
    if not req["client"].administrator and user_id != await virtool.db.samples.get_sample_owner(db, sample_id):
        return insufficient_rights("Must be administrator or sample owner")

    group = data.get("group", None)

    if group:
        existing_group_ids = await db.groups.distinct("_id") + ["none"]

        if group not in existing_group_ids:
            return bad_request("Group does not exist")

    # Update the sample document with the new rights.
    document = await db.samples.find_one_and_update({"_id": sample_id}, {
        "$set": data
    }, projection=virtool.db.samples.RIGHTS_PROJECTION)

    return json_response(document)


@routes.delete("/api/samples/{sample_id}")
async def remove(req):
    """
    Remove a sample document and all associated analyses.

    """
    db = req.app["db"]

    sample_id = req.match_info["sample_id"]

    try:
        if not await virtool.db.samples.check_rights(db, sample_id, req["client"]):
            return insufficient_rights()
    except virtool.errors.DatabaseError as err:
        if "Sample does not exist" in str(err):
            return not_found()

        raise

    await virtool.db.samples.remove_samples(
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
        if not await virtool.db.samples.check_rights(db, sample_id, req["client"], write=False):
            return insufficient_rights()
    except virtool.errors.DatabaseError as err:
        if "Sample does not exist" in str(err):
            return not_found()

        raise

    term = req.query.get("term", None)

    db_query = dict()

    if term:
        db_query.update(compose_regex_query(term, ["reference.name", "user.id"]))

    base_query = {
        "sample.id": sample_id
    }

    data = await paginate(
        db.analyses,
        db_query,
        req.query,
        base_query=base_query,
        projection=virtool.db.analyses.PROJECTION,
        sort=[("created_at", -1)]
    )

    return json_response(data)


@routes.post("/api/samples/{sample_id}/analyses", schema={
    "algorithm": {"type": "string", "required": True, "allowed": ["pathoscope_bowtie", "nuvs"]},
    "ref_id": {"type": "string", "required": True}
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
        if not await virtool.db.samples.check_rights(db, sample_id, req["client"]):
            return insufficient_rights()
    except virtool.errors.DatabaseError as err:
        if "Sample does not exist" in str(err):
            return not_found()

        raise

    if not await db.references.count({"_id": ref_id}):
        return bad_request("Reference does not exist")

    if not await db.indexes.count({"reference.id": ref_id, "ready": True}):
        return bad_request("No ready index")

    # Generate a unique _id for the analysis entry
    document = await virtool.db.analyses.new(
        req.app,
        sample_id,
        ref_id,
        req["client"].user_id,
        data["algorithm"]
    )

    document = virtool.utils.base_processor(document)

    sample = await virtool.db.samples.recalculate_algorithm_tags(db, sample_id)

    await req.app["dispatcher"].dispatch("samples", "update", virtool.utils.base_processor(sample))

    return json_response(
        document,
        status=201,
        headers={
            "Location": "/api/analyses/{}".format(document["id"])
        }
    )
