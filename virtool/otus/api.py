from typing import List, Union, Optional

from aiohttp import web
from aiohttp.web_exceptions import HTTPBadRequest, HTTPNoContent
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r201, r404, r204, r401, r403, r400
from virtool_core.models.otu import OTU, OTUIsolate, Sequence

import virtool.otus.db
import virtool.references.db
from virtool.api.response import InsufficientRights, NotFound, json_response
from virtool.data.errors import ResourceNotFoundError
from virtool.data.utils import get_data_from_req
from virtool.history.db import LIST_PROJECTION
from virtool.http.routes import Routes
from virtool.mongo.transforms import apply_transforms
from virtool.mongo.utils import get_one_field
from virtool.otus.oas import (
    UpdateOTURequest,
    CreateIsolateRequest,
    UpdateIsolateRequest,
    CreateSequenceRequest,
    UpdateSequenceRequest,
)
from virtool.otus.utils import evaluate_changes, find_isolate
from virtool.users.db import AttachUserTransform
from virtool.utils import base_processor

routes = Routes()


@routes.view("/otus/{otu_id}")
class OTUView(PydanticView):
    async def get(self, otu_id: str, /) -> Union[r200[OTU], r403, r404]:
        """
        Get an OTU.

        Fetches the details of an OTU.

        A FASTA file containing all sequences in the OTU can be downloaded by appending
        `.fa` to the path.

        """
        if self.request.path.endswith(".fa"):
            otu_id = otu_id.rstrip(".fa")

            try:
                filename, fasta = await get_data_from_req(self.request).otus.get_fasta(
                    otu_id
                )
            except ResourceNotFoundError:
                raise NotFound

            return web.Response(
                text=fasta,
                headers={"Content-Disposition": f"attachment; filename={filename}"},
            )

        try:
            otu = await get_data_from_req(self.request).otus.get(otu_id)
        except ResourceNotFoundError:
            raise NotFound

        return json_response(otu)

    async def patch(
        self, otu_id: str, /, data: UpdateOTURequest
    ) -> Union[r200[OTU], r400, r403, r404]:
        """
        Update an OTU.

        Checks to make sure the supplied OTU name and abbreviation don't already exist
        in the parent reference.

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
            raise InsufficientRights

        name, abbreviation, otu_schema = evaluate_changes(
            data.dict(by_alias=True, exclude_unset=True), document
        )

        # Send ``200`` with the existing otu record if no change will be made.
        if name is None and abbreviation is None and otu_schema is None:
            otu = await get_data_from_req(self.request).otus.get(otu_id)
            return json_response(otu)

        # Make sure new name or abbreviation are not already in use.
        if message := await virtool.otus.db.check_name_and_abbreviation(
            db, ref_id, name, abbreviation
        ):
            raise HTTPBadRequest(text=message)

        otu = await get_data_from_req(self.request).otus.update(
            otu_id, data, self.request["client"].user_id
        )

        return json_response(otu)

    async def delete(self, otu_id: str, /) -> Union[r204, r401, r403, r404]:
        """
        Delete an OTU.

        Deletes and OTU and its associated isolates and sequences.

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
        """
        List isolates.

        Fetches all the isolates and sequences for an OTU.

        """
        db = self.request.app["db"]

        document = await virtool.otus.db.join_and_format(db, otu_id)

        if not document:
            raise NotFound()

        return json_response(document["isolates"])

    async def post(
        self, otu_id: str, /, data: CreateIsolateRequest
    ) -> Union[r201[OTUIsolate], r401, r404]:
        """
        Create an isolate.

        Creates an isolate on the OTU specified by `otu_id`.

        """
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
        """
        Get an isolate.

        Fetches the details of an isolate.

        A FASTA file containing all sequences in the isolate can be downloaded by
        appending `.fa` to the path.
        """
        db = self.request.app["db"]

        isolate_id = isolate_id.rstrip(".fa")

        if self.request.path.endswith(".fa"):
            try:
                filename, fasta = await get_data_from_req(
                    self.request
                ).otus.get_isolate_fasta(otu_id, isolate_id)
            except ResourceNotFoundError as err:
                if "does not exist" in str(err):
                    raise NotFound

                raise

            return web.Response(
                text=fasta,
                headers={"Content-Disposition": f"attachment; filename={filename}"},
            )

        document = await db.otus.find_one(
            {"_id": otu_id, "isolates.id": isolate_id}, ["isolates"]
        )

        if not document:
            raise NotFound()

        isolate = find_isolate(document["isolates"], isolate_id)

        isolate["sequences"] = [
            base_processor(sequence)
            async for sequence in db.sequences.find(
                {"otu_id": otu_id, "isolate_id": isolate_id},
                {"otu_id": False, "isolate_id": False},
            )
        ]

        return json_response(isolate)

    async def patch(
        self, otu_id: str, isolate_id: str, /, data: UpdateIsolateRequest
    ) -> Union[r200[OTUIsolate], r401, r404]:
        """
        Update isolate.

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

        isolate = await get_data_from_req(self.request).otus.update_isolate(
            otu_id,
            isolate_id,
            self.request["client"].user_id,
            source_type=source_type,
            source_name=data.get("source_name"),
        )

        return json_response(isolate, status=200)

    async def delete(self, otu_id: str, isolate_id: str, /):
        """
        Delete isolate.

        Deletes an isolate using its 'otu id' and 'isolate id'.

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


@routes.view("/otus/{otu_id}/isolates/{isolate_id}/sequences")
class SequencesView(PydanticView):
    async def get(
        self, otu_id: str, isolate_id: str, /
    ) -> Union[r200[List[OTUIsolate]], r401, r403, r404]:
        """
        List sequences.

        Fetches the sequences for an isolate.

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
    ) -> Union[r201[Sequence], r400, r403, r404]:
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

        return json_response(
            sequence_document,
            status=201,
            headers={
                "Location": f"/otus/{otu_id}/isolates/{isolate_id}/sequences/{sequence_document['id']}"
            },
        )


@routes.view("/otus/{otu_id}/isolates/{isolate_id}/sequences/{sequence_id}")
class SequenceView(PydanticView):
    async def get(self, otu_id: str, isolate_id: str, sequence_id: str, /):
        """
        Get a sequence.

        Fetches the details for a sequence.

        A FASTA file containing the nucelotide sequence can be downloaded by appending
        `.fa` to the path.

        """
        if self.request.path.endswith(".fa"):
            sequence_id = sequence_id.rstrip(".fa")

            try:
                filename, fasta = await get_data_from_req(
                    self.request
                ).otus.get_sequence_fasta(sequence_id)
            except ResourceNotFoundError as err:
                if "does not exist" in str(err):
                    raise NotFound

                raise

            if fasta is None:
                raise NotFound

            return web.Response(
                text=fasta,
                headers={"Content-Disposition": f"attachment; filename={filename}"},
            )

        try:
            sequence = await get_data_from_req(self.request).otus.get_sequence(
                otu_id,
                isolate_id,
                sequence_id,
            )
        except ResourceNotFoundError:
            raise NotFound

        return json_response(sequence)

    async def patch(
        self,
        otu_id: str,
        isolate_id: str,
        sequence_id: str,
        /,
        data: UpdateSequenceRequest,
    ) -> Union[r200[Sequence], r400, r401, r403, r404]:
        """
        Update sequence.

        Updates a sequence using its 'otu id', 'isolate id' and 'sequence id'.

        """
        db = self.request.app["db"]

        document = await db.otus.find_one(
            {"_id": otu_id, "isolates.id": isolate_id}, ["reference", "segment"]
        )

        if not document or not await db.sequences.count_documents(
            {"_id": sequence_id}, limit=1
        ):
            raise NotFound()

        if not await virtool.references.db.check_right(
            self.request, document["reference"]["id"], "modify_otu"
        ):
            raise InsufficientRights()

        if message := await virtool.otus.db.check_sequence_segment_or_target(
            db,
            otu_id,
            isolate_id,
            sequence_id,
            document["reference"]["id"],
            data.dict(exclude_unset=True),
        ):
            raise HTTPBadRequest(text=message)

        sequence_document = await get_data_from_req(self.request).otus.update_sequence(
            otu_id,
            isolate_id,
            sequence_id,
            self.request["client"].user_id,
            data,
        )

        return json_response(sequence_document)

    async def delete(self, otu_id: str, isolate_id: str, sequence_id: str, /):
        """
        Delete sequence.

        Deletes the specified sequence.

        """
        db = self.request.app["db"]

        if not await db.sequences.count_documents({"_id": sequence_id}, limit=1):
            raise NotFound()

        document = await db.otus.find_one(
            {"_id": otu_id, "isolates.id": isolate_id}, ["reference"]
        )

        if document is None:
            raise NotFound()

        if not await virtool.references.db.check_right(
            self.request, document["reference"]["id"], "modify_otu"
        ):
            raise InsufficientRights()

        await get_data_from_req(self.request).otus.remove_sequence(
            otu_id, isolate_id, sequence_id, self.request["client"].user_id
        )

        raise HTTPNoContent


@routes.get("/otus/{otu_id}/history")
async def list_history(req):
    """
    List history.

    Lists an OTU's history.
    """
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
