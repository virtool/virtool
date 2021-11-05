import asyncio

import aiohttp
from aiohttp.web_exceptions import HTTPNoContent, HTTPBadRequest, HTTPBadGateway

import virtool.db.utils
import virtool.history.db
import virtool.indexes.db
import virtool.otus.db
import virtool.references.db
import virtool.utils
from virtool.api.response import json_response, InsufficientRights, NotFound
from virtool.api.utils import compose_regex_query, paginate
from virtool.errors import GitHubError, DatabaseError
from virtool.github import format_release
from virtool.http.routes import Routes
from virtool.http.schema import schema
from virtool.pg.utils import get_row
from virtool.references.tasks import CloneReferenceTask, ImportReferenceTask, RemoteReferenceTask, \
    DeleteReferenceTask, UpdateRemoteReferenceTask
from virtool.uploads.models import Upload
from virtool.validators import strip

routes = Routes()

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

    term = req.query.get("find")

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
        projection=virtool.references.db.PROJECTION
    )

    data["documents"] = [await virtool.references.db.processor(db, d) for d in data["documents"]]
    data["official_installed"] = await virtool.references.db.get_official_installed(db)

    return json_response(data)


@routes.get("/api/refs/{ref_id}")
@routes.jobs_api.get("/api/refs/{ref_id}")
async def get(req):
    """
    Get the complete representation of a specific reference.

    """
    db = req.app["db"]

    ref_id = req.match_info["ref_id"]

    document = await db.references.find_one(ref_id)

    if not document:
        raise NotFound()

    document = await asyncio.shield(virtool.references.db.attach_computed(db, document))

    return json_response(await virtool.references.db.processor(db, document))


@routes.get("/api/refs/{ref_id}/release")
async def get_release(req):
    """
    Get the latest update from GitHub and return it. Also updates the reference document. This is the only way of doing
    so without waiting for an automatic refresh every 10 minutes.

    """
    db = req.app["db"]
    ref_id = req.match_info["ref_id"]

    if not await virtool.db.utils.id_exists(db.references, ref_id):
        raise NotFound()

    if not await db.references.count_documents({"_id": ref_id, "remotes_from": {"$exists": True}}):
        raise HTTPBadRequest(text="Not a remote reference")

    try:
        release = await virtool.references.db.fetch_and_update_release(req.app, ref_id)
    except aiohttp.ClientConnectorError:
        raise HTTPBadGateway(text="Could not reach GitHub")

    if release is None:
        raise HTTPBadGateway(text="Release repository does not exist on GitHub")

    return json_response(release)


@routes.get("/api/refs/{ref_id}/updates")
async def list_updates(req):
    """
    List all updates made to the reference.

    """
    db = req.app["db"]
    ref_id = req.match_info["ref_id"]

    if not await virtool.db.utils.id_exists(db.references, ref_id):
        raise NotFound()

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
        raise NotFound()

    if not await virtool.references.db.check_right(req, ref_id, "modify"):
        raise InsufficientRights()

    release = await virtool.db.utils.get_one_field(db.references, "release", ref_id)

    if release is None:
        raise HTTPBadRequest(text="Target release does not exist")

    created_at = virtool.utils.timestamp()

    context = {
        "created_at": created_at,
        "ref_id": ref_id,
        "release": await virtool.db.utils.get_one_field(db.references, "release", ref_id),
        "user_id": user_id
    }

    task = await req.app["tasks"].add(UpdateRemoteReferenceTask, context=context)

    release, update_subdocument = await asyncio.shield(virtool.references.db.update(
        req,
        created_at,
        task["id"],
        ref_id,
        release,
        user_id
    ))

    return json_response(update_subdocument, status=201)


@routes.get("/api/refs/{ref_id}/otus")
async def find_otus(req):
    db = req.app["db"]

    ref_id = req.match_info["ref_id"]

    if not await virtool.db.utils.id_exists(db.references, ref_id):
        raise NotFound()

    term = req.query.get("find")
    verified = req.query.get("verified")
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

    if not await db.references.count_documents({"_id": ref_id}):
        raise NotFound()

    base_query = {
        "reference.id": ref_id
    }

    unbuilt = req.query.get("unbuilt")

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
        raise NotFound()

    data = await virtool.indexes.db.find(
        db,
        req.query,
        ref_id=ref_id
    )

    return json_response(data)


@routes.post("/api/refs", permission="create_ref")
@schema({
    "name": {
        "type": "string",
        "coerce": strip,
        "default": ""
    },
    "description": {
        "type": "string",
        "coerce": strip,
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
    pg = req.app["pg"]
    data = req["data"]
    settings = req.app["settings"]

    user_id = req["client"].user_id

    clone_from = data.get("clone_from")
    import_from = data.get("import_from")
    remote_from = data.get("remote_from")
    release_id = data.get("release_id") or 11447367

    if clone_from:
        if not await db.references.count_documents({"_id": clone_from}):
            raise HTTPBadRequest(text="Source reference does not exist")

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

        task = await req.app["tasks"].add(CloneReferenceTask, context=context)

        document["task"] = {
            "id": task["id"]
        }

    elif import_from:
        if not await get_row(pg, Upload, ("name_on_disk", import_from)):
            raise NotFound("File not found")

        path = req.app["config"].data_path / "files" / import_from

        document = await virtool.references.db.create_import(
            db,
            pg,
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

        task = await req.app["tasks"].add(ImportReferenceTask, context=context)

        document["task"] = {
            "id": task["id"]
        }

    elif remote_from:
        try:
            release = await get_release(
                req.app["config"],
                req.app["client"],
                remote_from,
                release_id=release_id
            )

        except aiohttp.ClientConnectionError:
            raise HTTPBadGateway(text="Could not reach GitHub")

        except GitHubError as err:
            if "404" in str(err):
                raise HTTPBadGateway(text="Could not retrieve latest GitHub release")

            raise

        release = format_release(release)

        document = await virtool.references.db.create_remote(
            db,
            settings,
            release,
            remote_from,
            user_id
        )

        context = {
            "release": release,
            "ref_id": document["_id"],
            "created_at": document["created_at"],
            "user_id": user_id
        }

        task = await req.app["tasks"].add(RemoteReferenceTask, context=context)

        document["task"] = {
            "id": task["id"]
        }

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

    document = await virtool.references.db.attach_computed(db, document)

    return json_response(virtool.utils.base_processor(document), headers=headers, status=201)


@routes.patch("/api/refs/{ref_id}")
@schema({
    "name": {
        "type": "string",
        "coerce": strip,
        "empty": False
    },
    "description": {
        "type": "string",
        "coerce": strip
    },
    "organism": {
        "type": "string",
        "coerce": strip
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
            "coerce": strip,
            "empty": False
        }
    },
    "targets": {
        "type": "list",
        "schema": {
            "type": "dict",
            "schema": {
                "name": {
                    "type": "string",
                    "empty": False,
                    "required": True
                },
                "description": {
                    "type": "string",
                    "default": ""
                },
                "required": {
                    "type": "boolean",
                    "default": False
                },
                "length": {
                    "type": "integer"
                }
            }
        }
    }
})
async def edit(req):
    db = req.app["db"]
    data = req["data"]

    ref_id = req.match_info["ref_id"]

    if not await virtool.db.utils.id_exists(db.references, ref_id):
        raise NotFound()

    if not await virtool.references.db.check_right(req, ref_id, "modify"):
        raise InsufficientRights()

    targets = data.get("targets")

    if targets:
        names = [t["name"] for t in targets]

        if len(names) != len(set(names)):
            raise HTTPBadRequest(text="The targets field may not contain duplicate names")

    document = await virtool.references.db.edit(
        db,
        ref_id,
        data
    )

    return json_response(document)


@routes.delete("/api/refs/{ref_id}")
async def remove(req):
    """
    Delete a reference and its otus, history, and indexes.

    """
    db = req.app["db"]

    ref_id = req.match_info["ref_id"]

    if not await virtool.db.utils.id_exists(db.references, ref_id):
        raise NotFound()

    if not await virtool.references.db.check_right(req, ref_id, "remove"):
        raise InsufficientRights()

    user_id = req["client"].user_id

    context = {
        "ref_id": ref_id,
        "user_id": user_id
    }

    task = await req.app["tasks"].add(DeleteReferenceTask, context=context)

    await db.references.delete_one({
        "_id": ref_id
    })

    headers = {
        "Content-Location": f"/api/tasks/{task['id']}"
    }

    return json_response(task, 202, headers)


@routes.get("/api/refs/{ref_id}/groups")
async def list_groups(req):
    db = req.app["db"]
    ref_id = req.match_info["ref_id"]

    if not await db.references.count_documents({"_id": ref_id}):
        raise NotFound()

    groups = await virtool.db.utils.get_one_field(db.references, "groups", ref_id)

    return json_response(groups)


@routes.get("/api/refs/{ref_id}/groups/{group_id}")
async def get_group(req):
    db = req.app["db"]
    ref_id = req.match_info["ref_id"]
    group_id = req.match_info["group_id"]

    document = await db.references.find_one({"_id": ref_id, "groups.id": group_id}, ["groups", "users"])

    if document is None:
        raise NotFound()

    if document is not None:
        for group in document.get("groups", list()):
            if group["id"] == group_id:
                return json_response(group)


@routes.post("/api/refs/{ref_id}/groups")
@schema({
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
        raise NotFound()

    if not await virtool.references.db.check_right(req, document, "modify"):
        raise InsufficientRights()

    try:
        subdocument = await virtool.references.db.add_group_or_user(db, ref_id, "groups", data)
    except DatabaseError as err:
        if "already exists" in str(err):
            raise HTTPBadRequest(text="Group already exists")

        if "does not exist" in str(err):
            raise HTTPBadRequest(text="Group does not exist")

        raise

    headers = {
        "Location": f"/api/refs/{ref_id}/groups/{subdocument['id']}"
    }

    return json_response(subdocument, headers=headers, status=201)


@routes.post("/api/refs/{ref_id}/users")
@schema({
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
        raise NotFound()

    if not await virtool.references.db.check_right(req, ref_id, "modify"):
        raise InsufficientRights()

    try:
        subdocument = await virtool.references.db.add_group_or_user(db, ref_id, "users", data)
    except DatabaseError as err:
        if "already exists" in str(err):
            raise HTTPBadRequest(text="User already exists")

        if "does not exist" in str(err):
            raise HTTPBadRequest(text="User does not exist")

        raise

    headers = {
        "Location": f"/api/refs/{ref_id}/users/{subdocument['id']}"
    }

    return json_response(subdocument, headers=headers, status=201)


@routes.patch("/api/refs/{ref_id}/groups/{group_id}")
@schema(RIGHTS_SCHEMA)
async def edit_group(req):
    db = req.app["db"]
    data = req["data"]
    ref_id = req.match_info["ref_id"]
    group_id = req.match_info["group_id"]

    document = await db.references.find_one({"_id": ref_id, "groups.id": group_id}, ["groups", "users"])

    if document is None:
        raise NotFound()

    if not await virtool.references.db.check_right(req, ref_id, "modify"):
        raise InsufficientRights()

    subdocument = await virtool.references.db.edit_group_or_user(db, ref_id, group_id, "groups", data)

    return json_response(subdocument)


@routes.patch("/api/refs/{ref_id}/users/{user_id}")
@schema(RIGHTS_SCHEMA)
async def edit_user(req):
    db = req.app["db"]
    data = req["data"]
    ref_id = req.match_info["ref_id"]
    user_id = req.match_info["user_id"]

    document = await db.references.find_one({"_id": ref_id, "users.id": user_id}, ["groups", "users"])

    if document is None:
        raise NotFound()

    if not await virtool.references.db.check_right(req, ref_id, "modify"):
        raise InsufficientRights()

    subdocument = await virtool.references.db.edit_group_or_user(db, ref_id, user_id, "users", data)

    if subdocument is None:
        raise NotFound()

    return json_response(subdocument)


@routes.delete("/api/refs/{ref_id}/groups/{group_id}")
async def delete_group(req):
    db = req.app["db"]
    ref_id = req.match_info["ref_id"]
    group_id = req.match_info["group_id"]

    document = await db.references.find_one({"_id": ref_id, "groups.id": group_id}, ["groups", "users"])

    if document is None:
        raise NotFound()

    if not await virtool.references.db.check_right(req, ref_id, "modify"):
        raise InsufficientRights()

    await virtool.references.db.delete_group_or_user(db, ref_id, group_id, "groups")

    raise HTTPNoContent


@routes.delete("/api/refs/{ref_id}/users/{user_id}")
async def delete_user(req):
    db = req.app["db"]
    ref_id = req.match_info["ref_id"]
    user_id = req.match_info["user_id"]

    document = await db.references.find_one({"_id": ref_id, "users.id": user_id}, ["groups", "users"])

    if document is None:
        raise NotFound()

    if not await virtool.references.db.check_right(req, ref_id, "modify"):
        raise InsufficientRights()

    await virtool.references.db.delete_group_or_user(db, ref_id, user_id, "users")

    raise HTTPNoContent
