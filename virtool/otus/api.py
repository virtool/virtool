from ctypes import Union
from typing import List, Union

from aiohttp import web
from aiohttp.web_exceptions import HTTPBadRequest, HTTPNoContent
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r201, r404, r204, r401, r403
from virtool_core.models.otu import OTU, OTUMinimal, OTUIsolate, OTUSequence

import virtool.otus.db
import virtool.references.db
from virtool.api.response import InsufficientRights, NotFound, json_response
from virtool.data.errors import ResourceNotFoundError
from virtool.data.utils import get_data_from_req
from virtool.downloads.db import generate_isolate_fasta, generate_sequence_fasta
from virtool.errors import DatabaseError
from virtool.mongo.transforms import apply_transforms
from virtool.history.db import LIST_PROJECTION
from virtool.http.routes import Routes
from virtool.http.schema import schema
from virtool.mongo.utils import get_one_field
from virtool.otus.oas import (
    UpdateOTURequest,
    CreateIsolateRequest,
    UpdateIsolateRequest,
    CreateSequenceRequest,
)
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


@routes.view("/otus")
class OTUsView(PydanticView):
    async def get(self, find: str, names: bool, verified: bool) -> List[OTUMinimal]:
        """
        Find OTUs.

        """
        db = self.request.app["db"]

        search_result = await virtool.otus.db.find(
            db, names, find, self.request.query, verified
        )

        return json_response(search_result)


@routes.view("/otus/{otu_id}")
class OTUView(PydanticView):
    async def get(self, otu_id: str, /) -> OTU:
        try:
            otu = await get_data_from_req(self.request).otus.get(otu_id)
        except ResourceNotFoundError:
            raise NotFound

        return json_response(otu)

    async def patch(
        self, otu_id: str, /, data: UpdateOTURequest
    ) -> Union[r200[OTU], r404]:
        """
        Edit an existing OTU. Checks to make sure the supplied OTU name and abbreviation are
        not already in use in the collection.

        """
        db = self.request.app["db"]

        # Get existing complete otu record, at the same time ensuring it exists. Send a
        # ``404`` if not.
        document = await db.otus.find_one(
            otu_id, ["abbreviation", "name", "reference", "schema"]
        )

        if not document:
            raise NotFound()

        ref_id = document["reference"]["id"]

        if not await virtool.references.db.check_right(
            self.request, ref_id, "modify_otu"
        ):
            raise InsufficientRights()

        name, abbreviation, otu_schema = evaluate_changes(
            data.dict(exclude_unset=True), document
        )

        # Send ``200`` with the existing otu record if no change will be made.
        if name is None and abbreviation is None and otu_schema is None:
            return json_response(await virtool.otus.db.join_and_format(db, otu_id))

        # Make sure new name or abbreviation are not already in use.
        message = await virtool.otus.db.check_name_and_abbreviation(
            db, ref_id, name, abbreviation
        )

        if message:
            raise HTTPBadRequest(text=message)

        document = await get_data_from_req(self.request).otus.edit(
            otu_id, name, abbreviation, otu_schema, self.request["client"].user_id
        )

        return json_response(document)

    async def delete(self, otu_id: str, /) -> Union[r204, r404]:
        """
        Remove an OTU document and its associated sequence documents.

        """
        db = self.request.app["db"]

        document = await db.otus.find_one(otu_id, ["reference"])

        if document is None:
            raise NotFound()

        if not await virtool.references.db.check_right(
            self.request, document["reference"]["id"], "modify_otu"
        ):
            raise InsufficientRights()

        await get_data_from_req(self.request).otus.remove(
            otu_id, self.request["client"].user_id
        )

        return web.Response(status=204)


@routes.view("/otus/{otu_id}/isolates")
class IsolatesView(PydanticView):
    async def get(self, otu_id: str, /):
        db = self.request.app["db"]

        document = await virtool.otus.db.join_and_format(db, otu_id)

        if not document:
            raise NotFound()

        return json_response(document["isolates"])

    async def post(
        self, otu_id: str, /, data: CreateIsolateRequest
    ) -> Union[r201[OTUIsolate], r401, r404]:
        db = self.request.app["db"]

        reference = await get_one_field(db.otus, "reference", otu_id)

        if not reference:
            raise NotFound()

        if not await virtool.references.db.check_right(
            self.request, reference["id"], "modify_otu"
        ):
            raise InsufficientRights()

        source_type = data.source_type.lower()

        # All source types are stored in lower case.
        if not await virtool.references.db.check_source_type(
            db, reference["id"], source_type
        ):
            raise HTTPBadRequest(text="Source type is not allowed")

        isolate = await get_data_from_req(self.request).otus.add_isolate(
            otu_id,
            source_type,
            data.source_name,
            self.request["client"].user_id,
            data.default,
        )

        return json_response(
            isolate,
            status=201,
            headers={"Location": f"/otus/{otu_id}/isolates/{isolate['id']}"},
        )


@routes.view("/otus/{otu_id}/isolates/{isolate_id}")
class IsolateView(PydanticView):
    async def get(
        self, otu_id: str, isolate_id: str, /
    ) -> Union[r200[OTUIsolate], r404]:
        db = self.request.app["db"]

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

    async def patch(
        self, otu_id: str, isolate_id: str, /, data: UpdateIsolateRequest
    ) -> Union[r200[OTUIsolate], r401, r404]:
        """
        Update an isolate.

        Updates an isolate.

        """
        db = self.request.app["db"]

        reference = await get_one_field(
            db.otus, "reference", {"_id": otu_id, "isolates.id": isolate_id}
        )

        if not reference:
            raise NotFound()

        ref_id = reference["id"]

        if not await virtool.references.db.check_right(
            self.request, ref_id, "modify_otu"
        ):
            raise InsufficientRights()

        data = data.dict(exclude_unset=True)

        source_type = None

        # All source types are stored in lower case.
        if "source_type" in data:
            source_type = data["source_type"].lower()

            if not await virtool.references.db.check_source_type(
                db, ref_id, source_type
            ):
                raise HTTPBadRequest(text="Source type is not allowed")

        isolate = await get_data_from_req(self.request).otus.edit_isolate(
            otu_id,
            isolate_id,
            self.request["client"].user_id,
            source_type=source_type,
            source_name=data.get("source_name"),
        )

        return json_response(isolate, status=200)

    async def delete(self, otu_id: str, isolate_id: str, /):
        """
        Delete an isolate.

        Deletes and isolate.

        """
        db = self.request.app["db"]

        reference = await get_one_field(
            db.otus, "reference", {"_id": otu_id, "isolates.id": isolate_id}
        )

        if not reference:
            raise NotFound()

        if not await virtool.references.db.check_right(
            self.request, reference["id"], "modify_otu"
        ):
            raise InsufficientRights()

        await get_data_from_req(self.request).otus.remove_isolate(
            otu_id, isolate_id, self.request["client"].user_id
        )

        raise HTTPNoContent


@routes.view("/otus/")
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


@routes.get("/otus/{otu_id}/isolates/{isolate_id}.fa")
async def download_isolate(req):
    """
    Download a FASTA file containing the sequences for a single Virtool isolate.

    """
    db = req.app["db"]

    otu_id = req.match_info["otu_id"]
    isolate_id = req.match_info["isolate_id"]

    try:
        filename, fasta = await generate_isolate_fasta(db, otu_id, isolate_id)
    except DatabaseError as err:
        if "OTU does not exist" in str(err):
            raise NotFound("OTU not found")

        if "Isolate does not exist" in str(err):
            raise NotFound("Isolate not found")

        raise

    return web.Response(
        text=fasta, headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@routes.put("/otus/{otu_id}/isolates/{isolate_id}/default")
async def set_as_default(req):
    """
    Set default isolate.

    Sets an isolate as default.

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


@routes.view("/otus/{otu_id}/isolates/{isolate_id}/sequences")
class SequencesView(PydanticView):
    async def get(
        self, otu_id: str, isolate_id: str, /
    ) -> Union[r200[List[OTUIsolate]], r401, r403, r404]:
        """
        List sequences.

        Lists the sequences for an isolate.

        """
        db = self.request.app["db"]

        if not await db.otus.count_documents(
            {"_id": otu_id, "isolates.id": isolate_id}, limit=1
        ):
            raise NotFound

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

    async def post(
        self, otu_id: str, isolate_id: str, /, data: CreateSequenceRequest
    ) -> Union[r201[OTUSequence], r401, r403, r404]:
        """
        Create a sequence.

        Creates a new sequence for an isolate identified by `otu_id` and `isolate_id`.

        """
        db = self.request.app["db"]

        document = await db.otus.find_one(
            {"_id": otu_id, "isolates.id": isolate_id}, ["reference", "schema"]
        )

        if not document:
            raise NotFound

        ref_id = document["reference"]["id"]

        if not await virtool.references.db.check_right(
            self.request, ref_id, "modify_otu"
        ):
            raise InsufficientRights()

        if message := await virtool.otus.db.check_sequence_segment_or_target(
            db, otu_id, isolate_id, None, ref_id, data.dict()
        ):
            raise HTTPBadRequest(text=message)

        sequence_document = await get_data_from_req(self.request).otus.create_sequence(
            otu_id,
            isolate_id,
            data.accession,
            data.definition,
            data.sequence,
            self.request["client"].user_id,
            host=data.host,
            segment=data.segment,
            target=data.target,
        )

        sequence_id = sequence_document["id"]

        return json_response(
            sequence_document,
            status=201,
            headers={
                "Location": f"/otus/{otu_id}/isolates/{isolate_id}/sequences/{sequence_id}"
            },
        )


@routes.get("/otus/{otu_id}/isolates/{isolate_id}/sequences/{sequence_id}.fa")
async def download_sequence(req):
    """
    Download a FASTA file containing a single Virtool sequence.

    """
    db = req.app["db"]

    sequence_id = req.match_info["sequence_id"]

    try:
        filename, fasta = await generate_sequence_fasta(db, sequence_id)
    except DatabaseError as err:
        if "Sequence does not exist" in str(err):
            raise NotFound("Sequence not found")

        if "Isolate does not exist" in str(err):
            raise NotFound("Isolate not found")

        if "OTU does not exist" in str(err):
            raise NotFound("OTU not found")

        raise

    if fasta is None:
        return web.Response(status=404)

    return web.Response(
        text=fasta, headers={"Content-Disposition": f"attachment; filename={filename}"}
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
        "segment": {"type": "string", "nullable": True},
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
