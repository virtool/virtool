from aiohttp import web
from aiohttp.web_exceptions import HTTPBadRequest, HTTPNoContent

import virtool.otus.db
import virtool.references.db
from virtool.api.response import InsufficientRights, NotFound, json_response
from virtool.data.utils import get_data_from_req
from virtool.db.transforms import apply_transforms
from virtool.history.db import LIST_PROJECTION
from virtool.http.routes import Routes
from virtool.http.schema import schema
from virtool.otus.utils import evaluate_changes, find_isolate
from virtool.users.db import AttachUserTransform
from virtool.utils import base_processor
from virtool.validators import has_unique_segment_names

SCHEMA_VALIDATOR = {
    "type": "list",
    "check_with": has_unique_segment_names,
    "schema": {
        "type": "dict",
        "allow_unknown": False,
        "schema": {
            "name": {"type": "string", "required": True},
            "required": {"type": "boolean", "default": True},
            "molecule": {
                "type": "string",
                "default": "",
                "allowed": ["", "ssDNA", "dsDNA", "ssRNA", "ssRNA+", "ssRNA-", "dsRNA"],
            },
        },
    },
}

routes = Routes()


@routes.get("/otus/{otu_id}.fa")
@routes.jobs_api.get("/otus/{otu_id}.fa")
async def download_otu(req):
    """
    Download a FASTA file containing the sequences for all isolates in a single Virtool
    otu.

    """
    db = req.app["db"]
    otu_id = req.match_info["otu_id"]

    if not await db.otus.count_documents({"_id": otu_id}, limit=1):
        raise NotFound("OTU not found")

    filename, fasta = await get_data_from_req(req).otus.get_fasta(otu_id)

    return web.Response(
        text=fasta, headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@routes.get("/otus")
async def find(req):
    """
    Find otus.

    """
    db = req.app["db"]

    term = req["query"].get("find")
    verified = req["query"].get("verified")
    names = req["query"].get("names", False)

    data = await virtool.otus.db.find(db, names, term, req["query"], verified)

    return json_response(data)


@routes.get("/otus/{otu_id}")
async def get(req):
    """
    Get a complete otu document. Joins the otu document with its associated sequence
    documents.

    """
    complete = await get_data_from_req(req).otus.get(req.match_info["otu_id"])

    if not complete:
        raise NotFound()

    return json_response(complete)


@routes.post("/refs/{ref_id}/otus")
@schema(
    {
        "name": {
            "type": "string",
            "coerce": virtool.validators.strip,
            "empty": False,
            "required": True,
        },
        "abbreviation": {
            "type": "string",
            "coerce": virtool.validators.strip,
            "default": "",
        },
        "schema": SCHEMA_VALIDATOR,
    }
)
async def create(req):
    """
    Add a new otu to the collection.

    Checks to make sure the supplied otu name and abbreviation are not already in use in
    the collection. Any errors are sent back to the client.

    """
    db = req.app["db"]

    ref_id = req.match_info["ref_id"]

    reference = await db.references.find_one(ref_id, ["groups", "users"])

    if reference is None:
        raise NotFound()

    if not await virtool.references.db.check_right(req, reference, "modify_otu"):
        raise InsufficientRights()

    name = req["data"]["name"].strip()
    abbreviation = req["data"]["abbreviation"].strip()

    # Check if either the name or abbreviation are already in use. Send a ``400`` if
    # they are.
    if message := await virtool.otus.db.check_name_and_abbreviation(
        db, ref_id, name, abbreviation
    ):
        raise HTTPBadRequest(text=message)

    document = await get_data_from_req(req).otus.create(
        ref_id, name, user_id=req["client"].user_id, abbreviation=abbreviation
    )

    return json_response(
        document, status=201, headers={"Location": f"/otus/{document['id']}"}
    )


@routes.patch("/otus/{otu_id}")
@schema(
    {
        "name": {"type": "string", "coerce": virtool.validators.strip, "empty": False},
        "abbreviation": {"type": "string", "coerce": virtool.validators.strip},
        "schema": SCHEMA_VALIDATOR,
    }
)
async def edit(req):
    """
    Edit an existing OTU. Checks to make sure the supplied OTU name and abbreviation are
    not already in use in the collection.

    """
    data = get_data_from_req(req)
    db = req.app["db"]
    payload = req["data"]

    otu_id = req.match_info["otu_id"]

    # Get existing complete otu record, at the same time ensuring it exists. Send a
    # ``404`` if not.
    document = await db.otus.find_one(
        otu_id, ["abbreviation", "name", "reference", "schema"]
    )

    if not document:
        raise NotFound()

    ref_id = document["reference"]["id"]

    if not await virtool.references.db.check_right(req, ref_id, "modify_otu"):
        raise InsufficientRights()

    name, abbreviation, otu_schema = evaluate_changes(payload, document)

    # Send ``200`` with the existing otu record if no change will be made.
    if name is None and abbreviation is None and otu_schema is None:
        return json_response(await virtool.otus.db.join_and_format(db, otu_id))

    # Make sure new name or abbreviation are not already in use.
    message = await virtool.otus.db.check_name_and_abbreviation(
        db, ref_id, name, abbreviation
    )

    if message:
        raise HTTPBadRequest(text=message)

    document = await data.otus.edit(
        otu_id, name, abbreviation, otu_schema, req["client"].user_id
    )

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

    if not await virtool.references.db.check_right(
        req, document["reference"]["id"], "modify_otu"
    ):
        raise InsufficientRights()

    await get_data_from_req(req).otus.remove(otu_id, req["client"].user_id)

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

    document = await db.otus.find_one(
        {"_id": otu_id, "isolates.id": isolate_id}, ["isolates"]
    )

    if not document:
        raise NotFound()

    isolate = dict(find_isolate(document["isolates"], isolate_id), sequences=[])

    cursor = db.sequences.find(
        {"otu_id": otu_id, "isolate_id": isolate_id},
        {"otu_id": False, "isolate_id": False},
    )

    async for sequence in cursor:
        sequence["id"] = sequence.pop("_id")
        isolate["sequences"].append(sequence)

    return json_response(isolate)


@routes.post("/otus/{otu_id}/isolates")
@schema(
    {
        "source_type": {
            "type": "string",
            "coerce": virtool.validators.strip,
            "default": "",
        },
        "source_name": {
            "type": "string",
            "coerce": virtool.validators.strip,
            "default": "",
        },
        "default": {"type": "boolean", "default": False},
    }
)
async def add_isolate(req):
    """
    Add a new isolate to an OTU.

    """
    db = req.app["db"]
    data = req["data"]

    otu_id = req.match_info["otu_id"]

    document = await db.otus.find_one(otu_id, ["reference"])

    if not document:
        raise NotFound()

    if not await virtool.references.db.check_right(
        req, document["reference"]["id"], "modify_otu"
    ):
        raise InsufficientRights()

    # All source types are stored in lower case.
    source_type = data["source_type"].lower()

    if not await virtool.references.db.check_source_type(
        db, document["reference"]["id"], source_type
    ):
        raise HTTPBadRequest(text="Source type is not allowed")

    isolate = await get_data_from_req(req).otus.add_isolate(
        otu_id, source_type, data["source_name"], req["client"].user_id, data["default"]
    )

    headers = {"Location": f"/otus/{otu_id}/isolates/{isolate['id']}"}

    return json_response(isolate, status=201, headers=headers)


@routes.patch("/otus/{otu_id}/isolates/{isolate_id}")
@schema(
    {
        "source_type": {
            "type": "string",
            "coerce": virtool.validators.strip,
        },
        "source_name": {
            "type": "string",
            "coerce": virtool.validators.strip,
        },
    }
)
async def edit_isolate(req):
    """
    Edit an existing isolate.

    """
    db = req.app["db"]
    data = req["data"]

    otu_id = req.match_info["otu_id"]
    isolate_id = req.match_info["isolate_id"]

    document = await db.otus.find_one(
        {"_id": otu_id, "isolates.id": isolate_id}, ["reference"]
    )

    if not document:
        raise NotFound()

    ref_id = document["reference"]["id"]

    if not await virtool.references.db.check_right(req, ref_id, "modify_otu"):
        raise InsufficientRights()

    source_type = None

    # All source types are stored in lower case.
    if "source_type" in data:
        source_type = data["source_type"].lower()

        if not await virtool.references.db.check_source_type(db, ref_id, source_type):
            raise HTTPBadRequest(text="Source type is not allowed")

    isolate = await get_data_from_req(req).otus.edit_isolate(
        otu_id,
        isolate_id,
        req["client"].user_id,
        source_type=source_type,
        source_name=data.get("source_name"),
    )

    return json_response(isolate, status=200)


@routes.put("/otus/{otu_id}/isolates/{isolate_id}/default")
async def set_as_default(req):
    """
    Set an isolate as default.

    """
    otu_id = req.match_info["otu_id"]
    isolate_id = req.match_info["isolate_id"]

    document = await req.app["db"].otus.find_one(
        {"_id": otu_id, "isolates.id": isolate_id}, ["reference"]
    )

    if not document:
        raise NotFound()

    if not await virtool.references.db.check_right(
        req, document["reference"]["id"], "modify_otu"
    ):
        raise InsufficientRights()

    isolate = await get_data_from_req(req).otus.set_isolate_as_default(
        otu_id, isolate_id, req["client"].user_id
    )

    return json_response(isolate)


@routes.delete("/otus/{otu_id}/isolates/{isolate_id}")
async def remove_isolate(req):
    """
    Remove an isolate and its sequences from a otu.

    """
    db = req.app["db"]

    otu_id = req.match_info["otu_id"]
    isolate_id = req.match_info["isolate_id"]

    document = await db.otus.find_one(
        {"_id": otu_id, "isolates.id": isolate_id}, ["reference"]
    )

    if not document:
        raise NotFound()

    if not await virtool.references.db.check_right(
        req, document["reference"]["id"], "modify_otu"
    ):
        raise InsufficientRights()

    await get_data_from_req(req).otus.remove_isolate(
        otu_id, isolate_id, req["client"].user_id
    )

    raise HTTPNoContent


@routes.get("/otus/{otu_id}/isolates/{isolate_id}/sequences")
async def list_sequences(req):
    db = req.app["db"]

    otu_id = req.match_info["otu_id"]
    isolate_id = req.match_info["isolate_id"]

    if not await db.otus.count_documents(
        {"_id": otu_id, "isolates.id": isolate_id}, limit=1
    ):
        raise NotFound()

    projection = list(virtool.otus.db.SEQUENCE_PROJECTION)

    projection.remove("otu_id")
    projection.remove("isolate_id")

    return json_response(
        [
            base_processor(d)
            async for d in db.sequences.find(
                {"otu_id": otu_id, "isolate_id": isolate_id}, projection
            )
        ]
    )


@routes.get("/otus/{otu_id}/isolates/{isolate_id}/sequences/{sequence_id}")
async def get_sequence(req):
    """
    Get a single sequence document by its ``accession`.

    """
    sequence = await get_data_from_req(req).otus.get_sequence(
        req.match_info["otu_id"],
        req.match_info["isolate_id"],
        req.match_info["sequence_id"],
    )

    if sequence is None:
        raise NotFound()

    return json_response(sequence)


@routes.post("/otus/{otu_id}/isolates/{isolate_id}/sequences")
@schema(
    {
        "accession": {
            "type": "string",
            "coerce": virtool.validators.strip,
            "empty": False,
            "required": True,
        },
        "definition": {
            "type": "string",
            "coerce": virtool.validators.strip,
            "empty": False,
            "required": True,
        },
        "host": {
            "type": "string",
            "coerce": virtool.validators.strip,
        },
        "segment": {
            "type": "string", "nullable": True, "default": None
        },
        "sequence": {
            "type": "string",
            "coerce": virtool.validators.strip,
            "empty": False,
            "required": True,
        },
        "target": {"type": "string"},
    }
)
async def create_sequence(req):
    """
    Create a new sequence record for the given isolate.

    """
    db = req.app["db"]
    data = req["data"]

    otu_id = req.match_info["otu_id"]
    isolate_id = req.match_info["isolate_id"]

    document = await db.otus.find_one(
        {"_id": otu_id, "isolates.id": isolate_id}, ["reference", "schema"]
    )

    if not document:
        raise NotFound()

    ref_id = document["reference"]["id"]

    if not await virtool.references.db.check_right(req, ref_id, "modify_otu"):
        raise InsufficientRights()

    if message := await virtool.otus.db.check_sequence_segment_or_target(
        db, otu_id, isolate_id, None, ref_id, data
    ):
        raise HTTPBadRequest(text=message)

    sequence_document = await get_data_from_req(req).otus.create_sequence(
        otu_id,
        isolate_id,
        data["accession"],
        data["definition"],
        data["sequence"],
        req["client"].user_id,
        host=data["host"],
        segment=data.get("segment"),
        target=data.get("target"),
    )

    sequence_id = sequence_document["id"]

    headers = {
        "Location": f"/otus/{otu_id}/isolates/{isolate_id}/sequences/{sequence_id}"
    }

    return json_response(sequence_document, status=201, headers=headers)


@routes.patch("/otus/{otu_id}/isolates/{isolate_id}/sequences/{sequence_id}")
@schema(
    {
        "accession": {
            "type": "string",
            "coerce": virtool.validators.strip,
            "empty": False,
        },
        "host": {"type": "string", "coerce": virtool.validators.strip},
        "definition": {
            "type": "string",
            "coerce": virtool.validators.strip,
            "empty": False,
        },
        "segment": {"type": "string", "nullable": True, "default": None},
        "sequence": {
            "type": "string",
            "coerce": virtool.validators.strip,
            "empty": False,
        },
        "target": {"type": "string"},
    }
)
async def edit_sequence(req):
    db = req.app["db"]
    data = req["data"]

    otu_id = req.match_info["otu_id"]
    isolate_id = req.match_info["isolate_id"]
    sequence_id = req.match_info["sequence_id"]

    document = await db.otus.find_one(
        {"_id": otu_id, "isolates.id": isolate_id}, ["reference", "segment"]
    )

    if not document or not await db.sequences.count_documents(
        {"_id": sequence_id}, limit=1
    ):
        raise NotFound()

    if not await virtool.references.db.check_right(
        req, document["reference"]["id"], "modify_otu"
    ):
        raise InsufficientRights()

    if message := await virtool.otus.db.check_sequence_segment_or_target(
        db, otu_id, isolate_id, sequence_id, document["reference"]["id"], data
    ):
        raise HTTPBadRequest(text=message)

    sequence_document = await get_data_from_req(req).otus.edit_sequence(
        otu_id,
        isolate_id,
        sequence_id,
        req["client"].user_id,
        data.get("accession"),
        data.get("definition"),
        data.get("host"),
        data.get("segment"),
        data.get("sequence"),
        data.get("target"),
    )

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

    if not await db.sequences.count_documents({"_id": sequence_id}, limit=1):
        raise NotFound()

    document = await db.otus.find_one(
        {"_id": otu_id, "isolates.id": isolate_id}, ["reference"]
    )

    if document is None:
        raise NotFound()

    if not await virtool.references.db.check_right(
        req, document["reference"]["id"], "modify_otu"
    ):
        raise InsufficientRights()

    await get_data_from_req(req).otus.remove_sequence(
        otu_id, isolate_id, sequence_id, req["client"].user_id
    )

    raise HTTPNoContent


@routes.get("/otus/{otu_id}/history")
async def list_history(req):
    db = req.app["db"]

    otu_id = req.match_info["otu_id"]

    if not await db.otus.count_documents({"_id": otu_id}, limit=1):
        raise NotFound()

    documents = await db.history.find(
        {"otu.id": otu_id}, projection=LIST_PROJECTION
    ).to_list(None)

    return json_response(
        await apply_transforms(documents, [AttachUserTransform(db, ignore_errors=True)])
    )
