import asyncio
from copy import deepcopy

from aiohttp import web

import virtool.history.db
import virtool.otus.db
import virtool.references.db
import virtool.db.utils
import virtool.history.utils
import virtool.http.routes
import virtool.otus.utils
import virtool.references.utils
import virtool.utils
import virtool.validators
from virtool.api import bad_request, insufficient_rights, json_response, no_content, not_found

SCHEMA_VALIDATOR = {
    "type": "list",
    "validator": virtool.validators.has_unique_segment_names,
    "schema": {
        "type": "dict",
        "allow_unknown": False,
        "schema": {
            "name": {"type": "string", "required": True},
            "required": {"type": "boolean", "default": True},
            "molecule": {"type": "string", "default": "", "allowed": [
                "",
                "ssDNA",
                "dsDNA",
                "ssRNA",
                "ssRNA+",
                "ssRNA-",
                "dsRNA"
            ]}
        }
    }
}

routes = virtool.http.routes.Routes()


@routes.get("/api/otus")
async def find(req):
    """
    Find otus.

    """
    db = req.app["db"]

    term = req["query"].get("find", None)
    verified = req["query"].get("verified", None)
    names = req["query"].get("names", False)

    data = await virtool.otus.db.find(
        db,
        names,
        term,
        req["query"],
        verified
    )

    return json_response(data)


@routes.get("/api/otus/{otu_id}")
async def get(req):
    """
    Get a complete otu document. Joins the otu document with its associated sequence documents.

    """
    db = req.app["db"]

    otu_id = req.match_info["otu_id"]

    complete = await virtool.otus.db.join_and_format(db, otu_id)

    if not complete:
        return not_found()

    return json_response(complete)


@routes.post("/api/refs/{ref_id}/otus", schema={
    "name": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "empty": False,
        "required": True
    },
    "abbreviation": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "default": ""
    },
    "schema": SCHEMA_VALIDATOR
})
async def create(req):
    """
    Add a new otu to the collection. Checks to make sure the supplied otu name and abbreviation are not already in
    use in the collection. Any errors are sent back to the client.

    """
    db = req.app["db"]
    data = req["data"]

    ref_id = req.match_info["ref_id"]

    reference = await db.references.find_one(ref_id, ["groups", "users"])

    if reference is None:
        return not_found()

    if not await virtool.references.db.check_right(req, reference, "modify_otu"):
        return insufficient_rights()

    name = data["name"].strip()
    abbreviation = data["abbreviation"].strip()

    # Check if either the name or abbreviation are already in use. Send a ``400`` if they are.
    message = await virtool.otus.db.check_name_and_abbreviation(db, ref_id, name, abbreviation)

    if message:
        return bad_request(message)

    document = await asyncio.shield(virtool.otus.db.create(
        db,
        ref_id,
        name,
        abbreviation,
        req["client"].user_id
    ))

    headers = {
        "Location": "/api/otus/" + document["id"]
    }

    return json_response(document, status=201, headers=headers)


@routes.patch("/api/otus/{otu_id}", schema={
    "name": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "empty": False
    },
    "abbreviation": {
        "type": "string",
        "coerce": virtool.validators.strip
    },
    "schema": SCHEMA_VALIDATOR
})
async def edit(req):
    """
    Edit an existing OTU. Checks to make sure the supplied OTU name and abbreviation are not already in use in
    the collection.

    """
    db = req.app["db"]
    data = req["data"]

    otu_id = req.match_info["otu_id"]

    # Get existing complete otu record, at the same time ensuring it exists. Send a ``404`` if not.
    old = await virtool.otus.db.join(db, otu_id)

    if not old:
        return not_found()

    ref_id = old["reference"]["id"]

    if not await virtool.references.db.check_right(req, ref_id, "modify_otu"):
        return insufficient_rights()

    name, abbreviation, schema = virtool.otus.utils.evaluate_changes(data, old)

    # Send ``200`` with the existing otu record if no change will be made.
    if name is None and abbreviation is None and schema is None:
        return json_response(await virtool.otus.db.join_and_format(db, otu_id))

    # Make sure new name or abbreviation are not already in use.
    message = await virtool.otus.db.check_name_and_abbreviation(db, ref_id, name, abbreviation)

    if message:
        return bad_request(message)

    document = await asyncio.shield(virtool.otus.db.edit(
        db,
        otu_id,
        old,
        data,
        name,
        abbreviation,
        schema,
        req["client"].user_id
    ))

    return json_response(document)


@routes.delete("/api/otus/{otu_id}")
async def remove(req):
    """
    Remove an OTU document and its associated sequence documents.

    """
    db = req.app["db"]

    otu_id = req.match_info["otu_id"]

    document = await db.otus.find_one(otu_id, ["reference"])

    if document is None:
        return not_found()

    if not await virtool.references.db.check_right(req, document["reference"]["id"], "modify_otu"):
        return insufficient_rights()

    await asyncio.shield(virtool.otus.db.remove(
        db,
        otu_id,
        req["client"].user_id
    ))

    return web.Response(status=204)


@routes.get("/api/otus/{otu_id}/isolates")
async def list_isolates(req):
    """
    Return a list of isolate records for a given otu.

    """
    db = req.app["db"]

    otu_id = req.match_info["otu_id"]

    document = await virtool.otus.db.join_and_format(db, otu_id)

    if not document:
        return not_found()

    return json_response(document["isolates"])


@routes.get("/api/otus/{otu_id}/isolates/{isolate_id}")
async def get_isolate(req):
    """
    Get a complete specific isolate sub-document, including its sequences.

    """
    db = req.app["db"]

    otu_id = req.match_info["otu_id"]
    isolate_id = req.match_info["isolate_id"]

    document = await db.otus.find_one({"_id": otu_id, "isolates.id": isolate_id}, ["isolates"])

    if not document:
        return not_found()

    isolate = dict(virtool.otus.utils.find_isolate(document["isolates"], isolate_id), sequences=[])

    cursor = db.sequences.find({"otu_id": otu_id, "isolate_id": isolate_id}, {"otu_id": False, "isolate_id": False})

    async for sequence in cursor:
        sequence["id"] = sequence.pop("_id")
        isolate["sequences"].append(sequence)

    return json_response(isolate)


@routes.post("/api/otus/{otu_id}/isolates", schema={
    "source_type": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "default": ""
    },
    "source_name": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "default": ""
    },
    "default": {
        "type": "boolean",
        "default": False
    }
})
async def add_isolate(req):
    """
    Add a new isolate to a otu.

    """
    db = req.app["db"]
    data = req["data"]

    otu_id = req.match_info["otu_id"]

    document = await db.otus.find_one(otu_id, ["reference"])

    if not document:
        return not_found()

    if not await virtool.references.db.check_right(req, document["reference"]["id"], "modify_otu"):
        return insufficient_rights()

        # All source types are stored in lower case.
    data["source_type"] = data["source_type"].lower()

    if not await virtool.references.db.check_source_type(db, document["reference"]["id"], data["source_type"]):
        return bad_request("Source type is not allowed")

    isolate = await asyncio.shield(virtool.otus.db.add_isolate(
        db,
        otu_id,
        data,
        req["client"].user_id
    ))

    headers = {
        "Location": f"/api/otus/{otu_id}/isolates/{isolate['id']}"
    }

    return json_response(
        isolate,
        status=201,
        headers=headers
    )


@routes.patch("/api/otus/{otu_id}/isolates/{isolate_id}", schema={
    "source_type": {
        "type": "string",
        "coerce": virtool.validators.strip,
    },
    "source_name": {
        "type": "string",
        "coerce": virtool.validators.strip,
    }
})
async def edit_isolate(req):
    """
    Edit an existing isolate.

    """
    db = req.app["db"]
    data = req["data"]

    otu_id = req.match_info["otu_id"]
    isolate_id = req.match_info["isolate_id"]

    document = await db.otus.find_one({"_id": otu_id, "isolates.id": isolate_id})

    if not document:
        return not_found()

    ref_id = document["reference"]["id"]

    if not await virtool.references.db.check_right(req, ref_id, "modify_otu"):
        return insufficient_rights()

    # All source types are stored in lower case.
    if "source_type" in data:
        data["source_type"] = data["source_type"].lower()

        if not await virtool.references.db.check_source_type(db, ref_id, data["source_type"]):
            return bad_request("Source type is not allowed")

    isolate = await asyncio.shield(virtool.otus.db.edit_isolate(
        db,
        otu_id,
        isolate_id,
        data,
        req["client"].user_id
    ))

    return json_response(isolate, status=200)


@routes.put("/api/otus/{otu_id}/isolates/{isolate_id}/default")
async def set_as_default(req):
    """
    Set an isolate as default.

    """
    db = req.app["db"]

    otu_id = req.match_info["otu_id"]
    isolate_id = req.match_info["isolate_id"]

    document = await db.otus.find_one({"_id": otu_id, "isolates.id": isolate_id}, ["reference"])

    if not document:
        return not_found()

    if not await virtool.references.db.check_right(req, document["reference"]["id"], "modify_otu"):
        return insufficient_rights()

    isolate = await asyncio.shield(virtool.otus.db.set_default_isolate(
        db,
        otu_id,
        isolate_id,
        req["client"].user_id
    ))

    return json_response(isolate)


@routes.delete("/api/otus/{otu_id}/isolates/{isolate_id}")
async def remove_isolate(req):
    """
    Remove an isolate and its sequences from a otu.

    """
    db = req.app["db"]

    otu_id = req.match_info["otu_id"]
    isolate_id = req.match_info["isolate_id"]

    document = await db.otus.find_one({"_id": otu_id, "isolates.id": isolate_id}, ["reference"])

    if not document:
        return not_found()

    if not await virtool.references.db.check_right(req, document["reference"]["id"], "modify_otu"):
        return insufficient_rights()

    await asyncio.shield(virtool.otus.db.remove_isolate(
        db,
        otu_id,
        isolate_id,
        req["client"].user_id
    ))

    return no_content()


@routes.get("/api/otus/{otu_id}/isolates/{isolate_id}/sequences")
async def list_sequences(req):
    db = req.app["db"]

    otu_id = req.match_info["otu_id"]
    isolate_id = req.match_info["isolate_id"]

    if not await db.otus.find({"_id": otu_id, "isolates.id": isolate_id}).count():
        return not_found()

    projection = list(virtool.otus.db.SEQUENCE_PROJECTION)

    projection.remove("otu_id")
    projection.remove("isolate_id")

    cursor = db.sequences.find({"otu_id": otu_id, "isolate_id": isolate_id}, projection)

    return json_response([virtool.utils.base_processor(d) async for d in cursor])


@routes.get("/api/otus/{otu_id}/isolates/{isolate_id}/sequences/{sequence_id}")
async def get_sequence(req):
    """
    Get a single sequence document by its ``accession`.

    """
    db = req.app["db"]

    otu_id = req.match_info["otu_id"]
    isolate_id = req.match_info["isolate_id"]
    sequence_id = req.match_info["sequence_id"]

    sequence = await virtool.otus.db.get_sequence(
        db,
        otu_id,
        isolate_id,
        sequence_id
    )

    if sequence is None:
        return not_found()

    return json_response(sequence)


@routes.post("/api/otus/{otu_id}/isolates/{isolate_id}/sequences", schema={
    "accession": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "empty": False,
        "required": True
    },
    "definition": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "empty": False,
        "required": True
    },
    "host": {
        "type": "string",
        "coerce": virtool.validators.strip,
    },
    "segment": {
        "type": "string",
    },
    "sequence": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "empty": False,
        "required": True
    }
})
async def create_sequence(req):
    """
    Create a new sequence record for the given isolate.

    """
    db, data = req.app["db"], req["data"]

    # Extract variables from URL path.
    otu_id, isolate_id = (req.match_info[key] for key in ["otu_id", "isolate_id"])

    # Get the subject otu document. Will be ``None`` if it doesn't exist. This will result in a ``404`` response.
    document = await db.otus.find_one({"_id": otu_id, "isolates.id": isolate_id}, ["reference", "schema"])

    if not document:
        return not_found()

    ref_id = document["reference"]["id"]

    if not await virtool.references.db.check_right(req, ref_id, "modify_otu"):
        return insufficient_rights()

    segment = data.get("segment")

    if segment and segment not in {s["name"] for s in document.get("schema", {})}:
        return bad_request("Segment does not exist")

    sequence_document = await asyncio.shield(virtool.otus.db.create_sequence(
        db,
        ref_id,
        otu_id,
        isolate_id,
        data,
        req["client"].user_id
    ))

    headers = {
        "Location": f"/api/otus/{otu_id}/isolates/{isolate_id}/sequences/{sequence_document['id']}"
    }

    return json_response(sequence_document, status=201, headers=headers)


@routes.patch("/api/otus/{otu_id}/isolates/{isolate_id}/sequences/{sequence_id}", schema={
    "accession": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "empty": False
    },
    "host": {
        "type": "string",
        "coerce": virtool.validators.strip
    },
    "definition": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "empty": False
    },
    "segment": {
        "type": "string"
    },
    "sequence": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "empty": False
    }
})
async def edit_sequence(req):
    db = req.app["db"]
    data = req["data"]

    otu_id = req.match_info["otu_id"]
    isolate_id = req.match_info["isolate_id"]
    sequence_id = req.match_info["sequence_id"]

    document = await db.otus.find_one({"_id": otu_id, "isolates.id": isolate_id}, ["reference", "segment"])

    if not document or not await db.sequences.count({"_id": sequence_id}):
        return not_found()

    if not await virtool.references.db.check_right(req, document["reference"]["id"], "modify_otu"):
        return insufficient_rights()

    segment = data.get("segment")

    if segment and segment not in {s["name"] for s in document.get("schema", {})}:
        return not_found("Segment does not exist")

    sequence_document = await asyncio.shield(virtool.otus.db.edit_sequence(
        db,
        otu_id,
        isolate_id,
        sequence_id,
        data,
        req["client"].user_id
    ))

    return json_response(sequence_document)


@routes.delete("/api/otus/{otu_id}/isolates/{isolate_id}/sequences/{sequence_id}")
async def remove_sequence(req):
    """
    Remove a sequence from an isolate.

    """
    db = req.app["db"]

    otu_id = req.match_info["otu_id"]
    isolate_id = req.match_info["isolate_id"]
    sequence_id = req.match_info["sequence_id"]

    if not await db.sequences.count({"_id": sequence_id}):
        return not_found()

    document = await db.otus.find_one({"_id": otu_id, "isolates.id": isolate_id}, ["reference"])

    if document is None:
        return not_found()

    if not await virtool.references.db.check_right(req, document["reference"]["id"], "modify_otu"):
        return insufficient_rights()

    await asyncio.shield(virtool.otus.db.remove_sequence(
        db,
        otu_id,
        isolate_id,
        sequence_id,
        req["client"].user_id
    ))

    return no_content()


@routes.get("/api/otus/{otu_id}/history")
async def list_history(req):
    db = req.app["db"]

    otu_id = req.match_info["otu_id"]

    if not await db.otus.find({"_id": otu_id}).count():
        return not_found()

    cursor = db.history.find({"otu.id": otu_id})

    return json_response([d async for d in cursor])
