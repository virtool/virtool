import asyncio

import virtool.http.routes
import virtool.otus.db
import virtool.otus.isolates
import virtool.otus.sequences
import virtool.references.db
import virtool.validators
from aiohttp import web
from aiohttp.web_exceptions import HTTPBadRequest, HTTPNoContent
from virtool.api.response import InsufficientRights, NotFound, json_response
from virtool.history.db import LIST_PROJECTION
from virtool.http.schema import schema
from virtool.otus.utils import evaluate_changes, find_isolate
from virtool.utils import base_processor

SCHEMA_VALIDATOR = {
    "type": "list",
    "check_with": virtool.validators.has_unique_segment_names,
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


@routes.get("/otus/{otu_id}.fa")
@routes.jobs_api.get("/otus/{otu_id}.fa")
async def download_otu(req):
    """
    Download a FASTA file containing the sequences for all isolates in a single Virtool otu.

    """
    db = req.app["db"]
    otu_id = req.match_info["otu_id"]

    if not await db.otus.count_documents({"_id": otu_id}):
        raise NotFound("OTU not found")

    filename, fasta = await virtool.otus.db.generate_otu_fasta(db, otu_id)

    return web.Response(text=fasta, headers={
        "Content-Disposition": f"attachment; filename={filename}"
    })


@routes.get("/otus")
async def find(req):
    """
    Find otus.

    """
    db = req.app["db"]

    term = req["query"].get("find")
    verified = req["query"].get("verified")
    names = req["query"].get("names", False)

    data = await virtool.otus.db.find(
        db,
        names,
        term,
        req["query"],
        verified
    )

    return json_response(data)


@routes.get("/otus/{otu_id}")
async def get(req):
    """
    Get a complete otu document. Joins the otu document with its associated sequence documents.

    """
    db = req.app["db"]

    otu_id = req.match_info["otu_id"]

    complete = await virtool.otus.db.join_and_format(db, otu_id)

    if not complete:
        raise NotFound()

    return json_response(complete)


@routes.post("/refs/{ref_id}/otus")
@schema({
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
        raise NotFound()

    if not await virtool.references.db.check_right(req, reference, "modify_otu"):
        raise InsufficientRights()

    name = data["name"].strip()
    abbreviation = data["abbreviation"].strip()

    # Check if either the name or abbreviation are already in use. Send a ``400`` if they are.
    message = await virtool.otus.db.check_name_and_abbreviation(db, ref_id, name, abbreviation)

    if message:
        raise HTTPBadRequest(text=message)

    document = await asyncio.shield(virtool.otus.db.create_otu(
        req.app,
        ref_id,
        name,
        abbreviation,
        req["client"].user_id
    ))

    headers = {
        "Location": "/otus/" + document["id"]
    }

    return json_response(document, status=201, headers=headers)


@routes.patch("/otus/{otu_id}")
@schema({
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
    document = await db.otus.find_one(otu_id, ["abbreviation", "name", "reference", "schema"])

    if not document:
        raise NotFound()

    ref_id = document["reference"]["id"]

    if not await virtool.references.db.check_right(req, ref_id, "modify_otu"):
        raise InsufficientRights()

    name, abbreviation, schema = evaluate_changes(data, document)

    # Send ``200`` with the existing otu record if no change will be made.
    if name is None and abbreviation is None and schema is None:
        return json_response(await virtool.otus.db.join_and_format(db, otu_id))

    # Make sure new name or abbreviation are not already in use.
    message = await virtool.otus.db.check_name_and_abbreviation(db, ref_id, name, abbreviation)

    if message:
        raise HTTPBadRequest(text=message)

    document = await asyncio.shield(virtool.otus.db.edit(
        req.app,
        otu_id,
        name,
        abbreviation,
        schema,
        req["client"].user_id
    ))

    return json_response(document)


@routes.delete("/otus/{otu_id}")
async def remove(req):
    """
    Remove an OTU document and its associated sequence documents.

    """
    db = req.app["db"]

    otu_id = req.match_info["otu_id"]

    document = await db.otus.find_one(otu_id, ["reference"])

    if document is None:
        raise NotFound()

    if not await virtool.references.db.check_right(req, document["reference"]["id"], "modify_otu"):
        raise InsufficientRights()

    await asyncio.shield(virtool.otus.db.remove(
        req.app,
        otu_id,
        req["client"].user_id
    ))

    return web.Response(status=204)


@routes.get("/otus/{otu_id}/isolates")
async def list_isolates(req):
    """
    Return a list of isolate records for a given otu.

    """
    db = req.app["db"]

    otu_id = req.match_info["otu_id"]

    document = await virtool.otus.db.join_and_format(db, otu_id)

    if not document:
        raise NotFound()

    return json_response(document["isolates"])


@routes.get("/otus/{otu_id}/isolates/{isolate_id}")
async def get_isolate(req):
    """
    Get a complete specific isolate sub-document, including its sequences.

    """
    db = req.app["db"]

    otu_id = req.match_info["otu_id"]
    isolate_id = req.match_info["isolate_id"]

    document = await db.otus.find_one({"_id": otu_id, "isolates.id": isolate_id}, ["isolates"])

    if not document:
        raise NotFound()

    isolate = dict(find_isolate(document["isolates"], isolate_id), sequences=[])

    cursor = db.sequences.find({"otu_id": otu_id, "isolate_id": isolate_id}, {"otu_id": False, "isolate_id": False})

    async for sequence in cursor:
        sequence["id"] = sequence.pop("_id")
        isolate["sequences"].append(sequence)

    return json_response(isolate)


@routes.post("/otus/{otu_id}/isolates")
@schema({
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
        raise NotFound()

    if not await virtool.references.db.check_right(req, document["reference"]["id"], "modify_otu"):
        raise InsufficientRights()

        # All source types are stored in lower case.
    data["source_type"] = data["source_type"].lower()

    if not await virtool.references.db.check_source_type(db, document["reference"]["id"], data["source_type"]):
        raise HTTPBadRequest(text="Source type is not allowed")

    isolate = await asyncio.shield(virtool.otus.isolates.add(
        req.app,
        otu_id,
        data,
        req["client"].user_id
    ))

    headers = {
        "Location": f"/otus/{otu_id}/isolates/{isolate['id']}"
    }

    return json_response(
        isolate,
        status=201,
        headers=headers
    )


@routes.patch("/otus/{otu_id}/isolates/{isolate_id}")
@schema({
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
        raise NotFound()

    ref_id = document["reference"]["id"]

    if not await virtool.references.db.check_right(req, ref_id, "modify_otu"):
        raise InsufficientRights()

    # All source types are stored in lower case.
    if "source_type" in data:
        data["source_type"] = data["source_type"].lower()

        if not await virtool.references.db.check_source_type(db, ref_id, data["source_type"]):
            raise HTTPBadRequest(text="Source type is not allowed")

    isolate = await asyncio.shield(virtool.otus.isolates.edit(
        req.app,
        otu_id,
        isolate_id,
        data,
        req["client"].user_id
    ))

    return json_response(isolate, status=200)


@routes.put("/otus/{otu_id}/isolates/{isolate_id}/default")
async def set_as_default(req):
    """
    Set an isolate as default.

    """
    db = req.app["db"]

    otu_id = req.match_info["otu_id"]
    isolate_id = req.match_info["isolate_id"]

    document = await db.otus.find_one({"_id": otu_id, "isolates.id": isolate_id}, ["reference"])

    if not document:
        raise NotFound()

    if not await virtool.references.db.check_right(req, document["reference"]["id"], "modify_otu"):
        raise InsufficientRights()

    isolate = await asyncio.shield(virtool.otus.isolates.set_default(
        req.app,
        otu_id,
        isolate_id,
        req["client"].user_id
    ))

    return json_response(isolate)


@routes.delete("/otus/{otu_id}/isolates/{isolate_id}")
async def remove_isolate(req):
    """
    Remove an isolate and its sequences from a otu.

    """
    db = req.app["db"]

    otu_id = req.match_info["otu_id"]
    isolate_id = req.match_info["isolate_id"]

    document = await db.otus.find_one({"_id": otu_id, "isolates.id": isolate_id}, ["reference"])

    if not document:
        raise NotFound()

    if not await virtool.references.db.check_right(req, document["reference"]["id"], "modify_otu"):
        raise InsufficientRights()

    await asyncio.shield(virtool.otus.isolates.remove(
        req.app,
        otu_id,
        isolate_id,
        req["client"].user_id
    ))

    raise HTTPNoContent


@routes.get("/otus/{otu_id}/isolates/{isolate_id}/sequences")
async def list_sequences(req):
    db = req.app["db"]

    otu_id = req.match_info["otu_id"]
    isolate_id = req.match_info["isolate_id"]

    if not await db.otus.count_documents({"_id": otu_id, "isolates.id": isolate_id}):
        raise NotFound()

    projection = list(virtool.otus.db.SEQUENCE_PROJECTION)

    projection.remove("otu_id")
    projection.remove("isolate_id")

    cursor = db.sequences.find({"otu_id": otu_id, "isolate_id": isolate_id}, projection)

    return json_response([base_processor(d) async for d in cursor])


@routes.get("/otus/{otu_id}/isolates/{isolate_id}/sequences/{sequence_id}")
async def get_sequence(req):
    """
    Get a single sequence document by its ``accession`.

    """
    db = req.app["db"]

    otu_id = req.match_info["otu_id"]
    isolate_id = req.match_info["isolate_id"]
    sequence_id = req.match_info["sequence_id"]

    sequence = await virtool.otus.sequences.get(
        db,
        otu_id,
        isolate_id,
        sequence_id
    )

    if sequence is None:
        raise NotFound()

    return json_response(sequence)


@routes.post("/otus/{otu_id}/isolates/{isolate_id}/sequences")
@schema({
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
    },
    "target": {
        "type": "string"
    }
})
async def create_sequence(req):
    """
    Create a new sequence record for the given isolate.

    """
    db = req.app["db"]
    data = req["data"]

    otu_id = req.match_info["otu_id"]
    isolate_id = req.match_info["isolate_id"]

    # Get the subject otu document. Will be ``None`` if it doesn't exist. This will result in a ``404`` response.
    document = await db.otus.find_one({"_id": otu_id, "isolates.id": isolate_id}, ["reference", "schema"])

    if not document:
        raise NotFound()

    ref_id = document["reference"]["id"]

    if not await virtool.references.db.check_right(req, ref_id, "modify_otu"):
        raise InsufficientRights()

    message = await virtool.otus.sequences.check_segment_or_target(
        db,
        otu_id,
        isolate_id,
        None,
        ref_id,
        data
    )

    if message:
        raise HTTPBadRequest(text=message)

    sequence_document = await asyncio.shield(virtool.otus.sequences.create(
        req.app,
        ref_id,
        otu_id,
        isolate_id,
        data,
        req["client"].user_id
    ))

    headers = {
        "Location": f"/otus/{otu_id}/isolates/{isolate_id}/sequences/{sequence_document['id']}"
    }

    return json_response(sequence_document, status=201, headers=headers)


@routes.patch("/otus/{otu_id}/isolates/{isolate_id}/sequences/{sequence_id}")
@schema({
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
    },
    "target": {
        "type": "string"
    }
})
async def edit_sequence(req):
    db = req.app["db"]
    data = req["data"]

    otu_id = req.match_info["otu_id"]
    isolate_id = req.match_info["isolate_id"]
    sequence_id = req.match_info["sequence_id"]

    document = await db.otus.find_one({"_id": otu_id, "isolates.id": isolate_id}, ["reference", "segment"])

    if not document or not await db.sequences.count_documents({"_id": sequence_id}):
        raise NotFound()

    if not await virtool.references.db.check_right(req, document["reference"]["id"], "modify_otu"):
        raise InsufficientRights()

    message = await virtool.otus.sequences.check_segment_or_target(
        db,
        otu_id,
        isolate_id,
        sequence_id,
        document["reference"]["id"],
        data
    )

    if message:
        raise HTTPBadRequest(text=message)

    sequence_document = await asyncio.shield(virtool.otus.sequences.edit(
        req.app,
        otu_id,
        isolate_id,
        sequence_id,
        data,
        req["client"].user_id
    ))

    return json_response(sequence_document)


@routes.delete("/otus/{otu_id}/isolates/{isolate_id}/sequences/{sequence_id}")
async def remove_sequence(req):
    """
    Remove a sequence from an isolate.

    """
    db = req.app["db"]

    otu_id = req.match_info["otu_id"]
    isolate_id = req.match_info["isolate_id"]
    sequence_id = req.match_info["sequence_id"]

    if not await db.sequences.count_documents({"_id": sequence_id}):
        raise NotFound()

    document = await db.otus.find_one({"_id": otu_id, "isolates.id": isolate_id}, ["reference"])

    if document is None:
        raise NotFound()

    if not await virtool.references.db.check_right(req, document["reference"]["id"], "modify_otu"):
        raise InsufficientRights()

    await asyncio.shield(virtool.otus.sequences.remove(
        req.app,
        otu_id,
        isolate_id,
        sequence_id,
        req["client"].user_id
    ))

    raise HTTPNoContent


@routes.get("/otus/{otu_id}/history")
async def list_history(req):
    db = req.app["db"]

    otu_id = req.match_info["otu_id"]

    if not await db.otus.count_documents({"_id": otu_id}):
        raise NotFound()

    cursor = db.history.find({"otu.id": otu_id}, projection=LIST_PROJECTION)

    return json_response([d async for d in cursor])
