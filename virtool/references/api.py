import asyncio
import os

import aiohttp
import aiojobs.aiohttp

import virtool.history.db
import virtool.indexes.db
import virtool.otus.db
import virtool.processes.db
import virtool.references.db
import virtool.users.db
import virtool.db.utils
import virtool.errors
import virtool.github
import virtool.http.routes
import virtool.otus.utils
import virtool.references.utils
import virtool.utils
import virtool.validators
from virtool.api import bad_gateway, bad_request, compose_regex_query, insufficient_rights, json_response, \
    no_content, not_found, paginate

routes = virtool.http.routes.Routes()

RIGHTS_SCHEMA = {
    "build": {
        "type": "boolean"
    },
    "modify": {
        "type": "boolean"
    },
    "modify_otu": {
        "type": "boolean"
    },
    "remove": {
        "type": "boolean"
    }
}


@routes.get("/api/refs")
async def find(req):
    db = req.app["db"]

    term = req.query.get("find", None)

    db_query = dict()

    if term:
        db_query = compose_regex_query(term, ["name", "data_type"])

    base_query = virtool.references.db.compose_base_find_query(
        req["client"].user_id,
        req["client"].administrator,
        req["client"].groups
    )

    data = await paginate(
        db.references,
        db_query,
        req.query,
        sort="name",
        base_query=base_query,
        processor=virtool.utils.base_processor,
        projection=virtool.references.db.PROJECTION
    )

    for d in data["documents"]:
        latest_build, otu_count, unbuilt_count = await asyncio.gather(
            virtool.references.db.get_latest_build(db, d["id"]),
            virtool.references.db.get_otu_count(db, d["id"]),
            virtool.references.db.get_unbuilt_count(db, d["id"])
        )

        d.update({
            "latest_build": latest_build,
            "otu_count": otu_count,
            "unbuilt_change_count": unbuilt_count
        })

    return json_response(data)


@routes.get("/api/refs/{ref_id}")
async def get(req):
    """
    Get the complete representation of a specific reference.

    """
    db = req.app["db"]

    ref_id = req.match_info["ref_id"]

    document = await db.references.find_one(ref_id)

    if not document:
        return not_found()

    try:
        internal_control_id = document["internal_control"]["id"]
    except (KeyError, TypeError):
        internal_control_id = None

    computed = await asyncio.shield(virtool.references.db.get_computed(db, ref_id, internal_control_id))

    users = await asyncio.shield(virtool.users.db.attach_identicons(db, document["users"]))

    document.update({
        **computed,
        "users": users
    })

    return json_response(virtool.utils.base_processor(document))


@routes.get("/api/refs/{ref_id}/release")
async def get_release(req):
    """
    Get the latest update from GitHub and return it. Also updates the reference document. This is the only way of doing
    so without waiting for an automatic refresh every 10 minutes.

    """
    db = req.app["db"]
    ref_id = req.match_info["ref_id"]

    if not await virtool.db.utils.id_exists(db.references, ref_id):
        return not_found()

    try:
        release = await virtool.references.db.fetch_and_update_release(req.app, ref_id)
    except aiohttp.ClientConnectorError:
        return bad_gateway("Could not reach GitHub")

    if release is None:
        return bad_gateway("Release repository does not exist on GitHub")

    return json_response(release)


@routes.get("/api/refs/{ref_id}/updates")
async def list_updates(req):
    """
    List all updates made to the reference.

    """
    db = req.app["db"]
    ref_id = req.match_info["ref_id"]

    if not await virtool.db.utils.id_exists(db.references, ref_id):
        return not_found()

    updates = await virtool.db.utils.get_one_field(db.references, "updates", ref_id)

    if updates is not None:
        updates.reverse()

    return json_response(updates or list())


@routes.post("/api/refs/{ref_id}/updates")
async def update(req):
    app = req.app
    db = app["db"]

    ref_id = req.match_info["ref_id"]
    user_id = req["client"].user_id

    if not await virtool.db.utils.id_exists(db.references, ref_id):
        return not_found()

    if not await virtool.references.db.check_right(req, ref_id, "modify"):
        return insufficient_rights()

    release = await virtool.db.utils.get_one_field(db.references, "release", ref_id)

    if release is None:
        return bad_request("Target release does not exist")

    created_at = virtool.utils.timestamp()

    context = {
        "created_at": created_at,
        "ref_id": ref_id,
        "release": await virtool.db.utils.get_one_field(db.references, "release", ref_id),
        "user_id": user_id
    }

    process = await virtool.processes.db.register(db, "update_remote_reference", context=context)

    release, update_subdocument = await virtool.references.db.update(
        req.app,
        created_at,
        process["id"],
        ref_id,
        release,
        user_id
    )

    p = virtool.references.db.UpdateRemoteReferenceProcess(req.app, process["id"])

    await aiojobs.aiohttp.spawn(req, p.run())

    return json_response(update_subdocument, status=201)


@routes.get("/api/refs/{ref_id}/otus")
async def find_otus(req):
    db = req.app["db"]

    ref_id = req.match_info["ref_id"]

    if not await virtool.db.utils.id_exists(db.references, ref_id):
        return not_found()

    term = req.query.get("find", None)
    verified = req.query.get("verified", None)
    names = req.query.get("names", False)

    data = await virtool.otus.db.find(
        db,
        names,
        term,
        req.query,
        verified,
        ref_id
    )

    return json_response(data)


@routes.get("/api/refs/{ref_id}/history")
async def find_history(req):
    db = req.app["db"]

    ref_id = req.match_info["ref_id"]

    if not await db.references.count({"_id": ref_id}):
        return not_found()

    base_query = {
        "reference.id": ref_id
    }

    unbuilt = req.query.get("unbuilt", None)

    if unbuilt == "true":
        base_query["index.id"] = "unbuilt"

    elif unbuilt == "false":
        base_query["index.id"] = {
            "$ne": "unbuilt"
        }

    data = await virtool.history.db.find(
        db,
        req.query,
        base_query
    )

    return json_response(data)


@routes.get("/api/refs/{ref_id}/indexes")
async def find_indexes(req):
    db = req.app["db"]

    ref_id = req.match_info["ref_id"]

    if not await virtool.db.utils.id_exists(db.references, ref_id):
        return not_found()

    data = await virtool.indexes.db.find(
        db,
        req.query,
        ref_id=ref_id
    )

    return json_response(data)


@routes.post("/api/refs", permission="create_ref", schema={
    "name": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "default": ""
    },
    "description": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "default": ""
    },
    "data_type": {
        "type": "string",
        "allowed": [
            "barcode",
            "genome"
        ],
        "default": "genome"
    },
    "clone_from": {
        "type": "string",
        "excludes": [
            "import_from",
            "remote_from"
        ]
    },
    "import_from": {
        "type": "string",
        "excludes": [
            "clone_from",
            "remote_from"
        ]
    },
    "remote_from": {
        "type": "string",
        "allowed": ["virtool/ref-plant-viruses"],
        "excludes": [
            "clone_from",
            "import_from"
        ]
    },
    "organism": {
        "type": "string",
        "default": ""
    },
    "release_id": {
        "type": "string"
    }
})
async def create(req):
    db = req.app["db"]
    data = req["data"]
    settings = req.app["settings"]

    user_id = req["client"].user_id

    clone_from = data.get("clone_from", None)
    import_from = data.get("import_from", None)
    remote_from = data.get("remote_from", None)
    release_id = data.get("release_id", None) or 11447367

    if clone_from:

        if not await db.references.count({"_id": clone_from}):
            return bad_request("Source reference does not exist")

        manifest = await virtool.references.db.get_manifest(db, clone_from)

        document = await virtool.references.db.create_clone(
            db,
            settings,
            data["name"],
            clone_from,
            data["description"],
            user_id
        )

        context = {
            "created_at": document["created_at"],
            "manifest": manifest,
            "ref_id": document["_id"],
            "user_id": user_id
        }

        process = await virtool.processes.db.register(db, "clone_reference", context=context)

        p = virtool.references.db.CloneReferenceProcess(req.app, process["id"])

        document["process"] = {
            "id": p.id
        }

        await aiojobs.aiohttp.spawn(req, p.run())

    elif import_from:
        if not await db.files.count({"_id": import_from}):
            return not_found("File not found")

        path = os.path.join(req.app["settings"]["data_path"], "files", import_from)

        document = await virtool.references.db.create_import(
            db,
            settings,
            data["name"],
            data["description"],
            import_from,
            user_id
        )

        context = {
            "created_at": document["created_at"],
            "path": path,
            "ref_id": document["_id"],
            "user_id": user_id
        }

        process = await virtool.processes.db.register(db, "import_reference", context=context)

        p = virtool.references.db.ImportReferenceProcess(req.app, process["id"])

        document["process"] = {
            "id": p.id
        }

        await aiojobs.aiohttp.spawn(req, p.run())

    elif remote_from:
        try:
            release = await virtool.github.get_release(
                settings,
                req.app["client"],
                remote_from,
                release_id=release_id
            )

        except aiohttp.ClientConnectionError:
            return bad_gateway("Could not reach GitHub")

        except virtool.errors.GitHubError as err:
            if "404" in str(err):
                return bad_gateway("Could not retrieve latest GitHub release")

            raise

        release = virtool.github.format_release(release)

        document = await virtool.references.db.create_remote(
            db,
            settings,
            release,
            remote_from,
            user_id
        )

        process = await virtool.processes.db.register(db, "remote_reference")

        document["process"] = {
            "id": process["id"]
        }

        await aiojobs.aiohttp.spawn(req, virtool.references.db.finish_remote(
            req.app,
            release,
            document["_id"],
            document["created_at"],
            process["id"],
            user_id
        ))

    else:
        document = await virtool.references.db.create_document(
            db,
            settings,
            data["name"],
            data["organism"],
            data["description"],
            data["data_type"],
            user_id=req["client"].user_id
        )

    await db.references.insert_one(document)

    headers = {
        "Location": "/api/refs/" + document["_id"]
    }

    document.update(await virtool.references.db.get_computed(db, document["_id"], None))

    return json_response(virtool.utils.base_processor(document), headers=headers, status=201)


@routes.patch("/api/refs/{ref_id}", schema={
    "name": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "empty": False
    },
    "description": {
        "type": "string",
        "coerce": virtool.validators.strip
    },
    "data_type": {
        "type": "string",
        "allowed": ["genome", "barcode"]
    },
    "organism": {
        "type": "string",
        "coerce": virtool.validators.strip
    },
    "internal_control": {
        "type": "string"
    },
    "restrict_source_types": {
        "type": "boolean"
    },
    "source_types": {
        "type": "list",
        "schema": {
            "type": "string",
            "coerce": virtool.validators.strip,
            "empty": False
        }
    }
})
async def edit(req):
    db = req.app["db"]
    data = req["data"]

    ref_id = req.match_info["ref_id"]

    if not await virtool.db.utils.id_exists(db.references, ref_id):
        return not_found()

    if not await virtool.references.db.check_right(req, ref_id, "modify"):
        return insufficient_rights()

    internal_control_id = data.get("internal_control", None)

    if internal_control_id == "":
        data["internal_control"] = None

    elif internal_control_id:
        internal_control = await virtool.references.db.get_internal_control(db, internal_control_id, ref_id)

        if internal_control is None:
            data["internal_control"] = None
        else:
            data["internal_control"] = {
                "id": internal_control_id
            }

    document = await db.references.find_one_and_update({"_id": ref_id}, {
        "$set": data
    })

    document = virtool.utils.base_processor(document)

    document.update(await virtool.references.db.get_computed(db, ref_id, internal_control_id))

    if "name" in data:
        await db.analyses.update_many({"reference.id": ref_id}, {
            "$set": {
                "reference.name": document["name"]
            }
        })

    users = await virtool.db.utils.get_one_field(db.references, "users", ref_id)

    document["users"] = await virtool.users.db.attach_identicons(db, users)

    return json_response(document)


@routes.delete("/api/refs/{ref_id}")
async def remove(req):
    """
    Remove a reference and its otus, history, and indexes.

    """
    db = req.app["db"]

    ref_id = req.match_info["ref_id"]

    if not await virtool.db.utils.id_exists(db.references, ref_id):
        return not_found()

    if not await virtool.references.db.check_right(req, ref_id, "remove"):
        return insufficient_rights()

    user_id = req["client"].user_id

    context = {
        "ref_id": ref_id,
        "user_id": user_id
    }

    process = await virtool.processes.db.register(db, "delete_reference", context=context)

    await db.references.delete_one({
        "_id": ref_id
    })

    p = virtool.references.db.RemoveReferenceProcess(req.app, process["id"])

    await aiojobs.aiohttp.spawn(req, p.run())

    headers = {
        "Content-Location": f"/api/processes/{process['id']}"
    }

    return json_response(process, 202, headers)


@routes.get("/api/refs/{ref_id}/groups")
async def list_groups(req):
    db = req.app["db"]
    ref_id = req.match_info["ref_id"]

    if not await db.references.count({"_id": ref_id}):
        return not_found()

    groups = await virtool.db.utils.get_one_field(db.references, "groups", ref_id)

    return json_response(groups)


@routes.get("/api/refs/{ref_id}/groups/{group_id}")
async def get_group(req):
    db = req.app["db"]
    ref_id = req.match_info["ref_id"]
    group_id = req.match_info["group_id"]

    document = await db.references.find_one({"_id": ref_id, "groups.id": group_id}, ["groups", "users"])

    if document is None:
        return not_found()

    if document is not None:
        for group in document.get("groups", list()):
            if group["id"] == group_id:
                return json_response(group)


@routes.post("/api/refs/{ref_id}/groups", schema={
    **RIGHTS_SCHEMA, "group_id": {
        "type": "string",
        "required": True
    }
})
async def add_group(req):
    db = req.app["db"]
    data = req["data"]
    ref_id = req.match_info["ref_id"]

    document = await db.references.find_one(ref_id, ["groups", "users"])

    if document is None:
        return not_found()

    if not await virtool.references.db.check_right(req, document, "modify"):
        return insufficient_rights()

    try:
        subdocument = await virtool.references.db.add_group_or_user(db, ref_id, "groups", data)
    except virtool.errors.DatabaseError as err:
        if "already exists" in str(err):
            return bad_request("Group already exists")

        if "does not exist" in str(err):
            return bad_request("Group does not exist")

        raise

    headers = {
        "Location": f"/api/refs/{ref_id}/groups/{subdocument['id']}"
    }

    return json_response(subdocument, headers=headers, status=201)


@routes.post("/api/refs/{ref_id}/users", schema={
    **RIGHTS_SCHEMA, "user_id": {
        "type": "string",
        "required": True
    }
})
async def add_user(req):
    db = req.app["db"]
    data = req["data"]
    ref_id = req.match_info["ref_id"]

    document = await db.references.find_one(ref_id, ["groups", "users"])

    if document is None:
        return not_found()

    if not await virtool.references.db.check_right(req, ref_id, "modify"):
        return insufficient_rights()

    try:
        subdocument = await virtool.references.db.add_group_or_user(db, ref_id, "users", data)
    except virtool.errors.DatabaseError as err:
        if "already exists" in str(err):
            return bad_request("User already exists")

        if "does not exist" in str(err):
            return bad_request("User does not exist")

        raise

    headers = {
        "Location": f"/api/refs/{ref_id}/users/{subdocument['id']}"
    }

    subdocument = await virtool.users.db.attach_identicons(db, subdocument)

    return json_response(subdocument, headers=headers, status=201)


@routes.patch("/api/refs/{ref_id}/groups/{group_id}", schema=RIGHTS_SCHEMA)
async def edit_group(req):
    db = req.app["db"]
    data = req["data"]
    ref_id = req.match_info["ref_id"]
    group_id = req.match_info["group_id"]

    document = await db.references.find_one({"_id": ref_id, "groups.id": group_id}, ["groups", "users"])

    if document is None:
        return not_found()

    if not await virtool.references.db.check_right(req, ref_id, "modify"):
        return insufficient_rights()

    subdocument = await virtool.references.db.edit_group_or_user(db, ref_id, group_id, "groups", data)

    return json_response(subdocument)


@routes.patch("/api/refs/{ref_id}/users/{user_id}", schema=RIGHTS_SCHEMA)
async def edit_user(req):
    db = req.app["db"]
    data = req["data"]
    ref_id = req.match_info["ref_id"]
    user_id = req.match_info["user_id"]

    document = await db.references.find_one({"_id": ref_id, "users.id": user_id}, ["groups", "users"])

    if document is None:
        return not_found()

    if not await virtool.references.db.check_right(req, ref_id, "modify"):
        return insufficient_rights()

    subdocument = await virtool.references.db.edit_group_or_user(db, ref_id, user_id, "users", data)

    if subdocument is None:
        return not_found()

    subdocument = await virtool.users.db.attach_identicons(db, subdocument)

    return json_response(subdocument)


@routes.delete("/api/refs/{ref_id}/groups/{group_id}")
async def delete_group(req):
    db = req.app["db"]
    ref_id = req.match_info["ref_id"]
    group_id = req.match_info["group_id"]

    document = await db.references.find_one({"_id": ref_id, "groups.id": group_id}, ["groups", "users"])

    if document is None:
        return not_found()

    if not await virtool.references.db.check_right(req, ref_id, "modify"):
        return insufficient_rights()

    await virtool.references.db.delete_group_or_user(db, ref_id, group_id, "groups")

    return no_content()


@routes.delete("/api/refs/{ref_id}/users/{user_id}")
async def delete_user(req):
    db = req.app["db"]
    ref_id = req.match_info["ref_id"]
    user_id = req.match_info["user_id"]

    document = await db.references.find_one({"_id": ref_id, "users.id": user_id}, ["groups", "users"])

    if document is None:
        return not_found()

    if not await virtool.references.db.check_right(req, ref_id, "modify"):
        return insufficient_rights()

    await virtool.references.db.delete_group_or_user(db, ref_id, user_id, "users")

    return no_content()
