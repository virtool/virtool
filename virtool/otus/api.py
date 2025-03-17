from aiohttp import web
from virtool_core.models.otu import OTU, OTUIsolate, OTUSequence, Sequence

import virtool.otus.db
import virtool.references.db
from virtool.api.custom_json import json_response
from virtool.api.errors import (
    APIBadRequest,
    APIInsufficientRights,
    APINoContent,
    APINotFound,
)
from virtool.api.routes import Routes
from virtool.api.status import R200, R201, R204, R400, R401, R403, R404
from virtool.api.view import APIView
from virtool.data.errors import ResourceNotFoundError
from virtool.data.transforms import apply_transforms
from virtool.data.utils import get_data_from_req
from virtool.history.db import HISTORY_LIST_PROJECTION
from virtool.mongo.utils import get_mongo_from_req, get_one_field
from virtool.otus.db import SEQUENCE_PROJECTION
from virtool.otus.oas import (
    IsolateCreateRequest,
    IsolateUpdateRequest,
    OTUUpdateRequest,
    SequenceCreateRequest,
    SequenceUpdateRequest,
)
from virtool.otus.utils import evaluate_changes, find_isolate
from virtool.users.transforms import AttachUserTransform
from virtool.utils import base_processor
from virtool.validation import is_set

routes = Routes()


@routes.web.view("/otus/{otu_id}")
class OTUView(APIView):
    async def get(self, otu_id: str, /) -> R200[OTU] | R403 | R404:
        """Get an OTU.

        Fetches the details of an OTU.

        A FASTA file containing all sequences in the OTU can be downloaded by appending
        `.fa` to the path.

        """
        if self.request.path.endswith(".fa"):
            otu_id = otu_id.rstrip(".fa")

            try:
                filename, fasta = await self.data.otus.get_fasta(
                    otu_id,
                )
            except ResourceNotFoundError:
                raise APINotFound()

            return web.Response(
                text=fasta,
                headers={"Content-Disposition": f"attachment; filename={filename}"},
            )

        try:
            otu = await self.data.otus.get(otu_id)
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(otu)

    async def patch(
        self,
        otu_id: str,
        /,
        data: OTUUpdateRequest,
    ) -> R200[OTU] | R400 | R403 | R404:
        """Update an OTU.

        Checks to make sure the supplied OTU name and abbreviation don't already exist
        in the parent reference.

        """
        mongo = get_mongo_from_req(self.request)

        # Get existing complete otu record, at the same time ensuring it exists. Send a
        # ``404`` if not.
        document = await mongo.otus.find_one(
            otu_id,
            ["abbreviation", "name", "reference", "schema"],
        )

        if not document:
            raise APINotFound()

        ref_id = document["reference"]["id"]

        if not await virtool.references.db.check_right(
            self.request,
            ref_id,
            "modify_otu",
        ):
            raise APIInsufficientRights()

        name, abbreviation, otu_schema = evaluate_changes(
            data.dict(by_alias=True, exclude_unset=True),
            document,
        )

        # Send ``200`` with the existing otu record if no change will be made.
        if name is None and abbreviation is None and otu_schema is None:
            otu = await self.data.otus.get(otu_id)
            return json_response(otu)

        # Make sure new name or abbreviation are not already in use.
        if message := await virtool.otus.db.check_name_and_abbreviation(
            mongo,
            ref_id,
            name,
            abbreviation,
        ):
            raise APIBadRequest(message)

        otu = await self.data.otus.update(
            otu_id,
            data,
            self.request["client"].user_id,
        )

        return json_response(otu)

    async def delete(self, otu_id: str, /) -> R204 | R401 | R403 | R404:
        """Delete an OTU.

        Deletes and OTU and its associated isolates and sequences.

        """
        mongo = get_mongo_from_req(self.request)

        document = await mongo.otus.find_one(otu_id, ["reference"])

        if document is None:
            raise APINotFound()

        if not await virtool.references.db.check_right(
            self.request,
            document["reference"]["id"],
            "modify_otu",
        ):
            raise APIInsufficientRights()

        await self.data.otus.remove(
            otu_id,
            self.request["client"].user_id,
        )

        return web.Response(status=204)


@routes.web.view("/otus/{otu_id}/isolates")
class IsolatesView(APIView):
    async def get(self, otu_id: str, /) -> R200[list[OTUIsolate]] | R404:
        """List isolates.

        Lists all the isolates and sequences for an OTU.

        """
        mongo = get_mongo_from_req(self.request)

        document = await virtool.otus.db.join_and_format(mongo, otu_id)

        if not document:
            raise APINotFound()

        return json_response(document["isolates"])

    async def post(
        self,
        otu_id: str,
        /,
        data: IsolateCreateRequest,
    ) -> R201[OTUIsolate] | R401 | R404:
        """Create an isolate.

        Creates an isolate on the OTU specified by `otu_id`.

        """
        mongo = get_mongo_from_req(self.request)

        reference = await get_one_field(mongo.otus, "reference", otu_id)

        if not reference:
            raise APINotFound()

        if not await virtool.references.db.check_right(
            self.request,
            reference["id"],
            "modify_otu",
        ):
            raise APIInsufficientRights()

        source_type = data.source_type.lower()

        # All source types are stored in lower case.
        if not await virtool.references.db.check_source_type(
            mongo,
            reference["id"],
            source_type,
        ):
            raise APIBadRequest("Source type is not allowed")

        isolate = await self.data.otus.add_isolate(
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


@routes.web.view("/otus/{otu_id}/isolates/{isolate_id}")
class IsolateView(APIView):
    async def get(
        self,
        otu_id: str,
        isolate_id: str,
        /,
    ) -> R200[OTUIsolate] | R404:
        """Get an isolate.

        Fetches the details of an isolate.

        A FASTA file containing all sequences in the isolate can be downloaded by
        appending `.fa` to the path.
        """
        mongo = get_mongo_from_req(self.request)

        isolate_id = isolate_id.rstrip(".fa")

        if self.request.path.endswith(".fa"):
            try:
                filename, fasta = await get_data_from_req(
                    self.request,
                ).otus.get_isolate_fasta(otu_id, isolate_id)
            except ResourceNotFoundError as err:
                if "does not exist" in str(err):
                    raise APINotFound()

                raise

            return web.Response(
                text=fasta,
                headers={"Content-Disposition": f"attachment; filename={filename}"},
            )

        document = await mongo.otus.find_one(
            {"_id": otu_id, "isolates.id": isolate_id},
            ["isolates"],
        )

        if not document:
            raise APINotFound()

        isolate = find_isolate(document["isolates"], isolate_id)

        isolate["sequences"] = [
            base_processor(sequence)
            async for sequence in mongo.sequences.find(
                {"otu_id": otu_id, "isolate_id": isolate_id},
                {"otu_id": False, "isolate_id": False},
            )
        ]

        return json_response(isolate)

    async def patch(
        self,
        otu_id: str,
        isolate_id: str,
        /,
        data: IsolateUpdateRequest,
    ) -> R200[OTUIsolate] | R401 | R404:
        """Update an isolate.

        Updates an isolate using 'otu_id' and 'isolate_id'.

        """
        mongo = get_mongo_from_req(self.request)

        reference = await get_one_field(
            mongo.otus,
            "reference",
            {"_id": otu_id, "isolates.id": isolate_id},
        )

        if not reference:
            raise APINotFound()

        ref_id = reference["id"]

        if not await virtool.references.db.check_right(
            self.request,
            ref_id,
            "modify_otu",
        ):
            raise APIInsufficientRights()

        if is_set(
            data.source_type,
        ) and not await virtool.references.db.check_source_type(
            mongo,
            ref_id,
            data.source_type,
        ):
            raise APIBadRequest("Source type is not allowed")

        isolate = await self.data.otus.update_isolate(
            otu_id,
            isolate_id,
            self.request["client"].user_id,
            data,
        )

        return json_response(isolate, status=200)

    async def delete(
        self,
        otu_id: str,
        isolate_id: str,
        /,
    ) -> R204 | R401 | R403 | R404:
        """Delete an isolate.

        Deletes an isolate using its 'otu id' and 'isolate id'.

        """
        mongo = get_mongo_from_req(self.request)

        reference = await get_one_field(
            mongo.otus,
            "reference",
            {"_id": otu_id, "isolates.id": isolate_id},
        )

        if not reference:
            raise APINotFound()

        if not await virtool.references.db.check_right(
            self.request,
            reference["id"],
            "modify_otu",
        ):
            raise APIInsufficientRights()

        await self.data.otus.remove_isolate(
            otu_id,
            isolate_id,
            self.request["client"].user_id,
        )

        raise APINoContent()


@routes.view("/otus/{otu_id}/isolates/{isolate_id}/default")
class IsolateDefaultView(APIView):
    async def put(
        self,
        otu_id: str,
        isolate_id: str,
    ) -> R200[OTUIsolate] | R401 | R403 | R404:
        """Set default isolate.

        Sets an isolate as default.
        """
        document = await get_mongo_from_req(self.request).otus.find_one(
            {"_id": otu_id, "isolates.id": isolate_id},
            ["reference"],
        )

        if not document:
            raise APINotFound()

        if not await virtool.references.db.check_right(
            self.request,
            document["reference"]["id"],
            "modify_otu",
        ):
            raise APIInsufficientRights()

        isolate = await self.data.otus.set_isolate_as_default(
            otu_id,
            isolate_id,
            self.client.user_id,
        )

        return json_response(isolate)


@routes.web.view("/otus/{otu_id}/isolates/{isolate_id}/sequences")
class SequencesView(APIView):
    async def get(
        self,
        otu_id: str,
        isolate_id: str,
        /,
    ) -> R200[list[OTUSequence]] | R401 | R403 | R404:
        """List sequences.

        Lists the sequences for an isolate.

        """
        mongo = get_mongo_from_req(self.request)

        if not await mongo.otus.count_documents(
            {"_id": otu_id, "isolates.id": isolate_id},
            limit=1,
        ):
            raise APINotFound()

        return json_response(
            [
                OTUSequence(**d)
                async for d in mongo.sequences.find(
                    {"otu_id": otu_id, "isolate_id": isolate_id},
                    SEQUENCE_PROJECTION,
                )
            ],
        )

    async def post(
        self,
        otu_id: str,
        isolate_id: str,
        /,
        data: SequenceCreateRequest,
    ) -> R201[Sequence] | R400 | R403 | R404:
        """Create a sequence.

        Creates a new sequence for an isolate identified by `otu_id` and `isolate_id`.

        """
        mongo = get_mongo_from_req(self.request)

        document = await mongo.otus.find_one(
            {"_id": otu_id, "isolates.id": isolate_id},
            ["reference", "schema"],
        )

        if not document:
            raise APINotFound()

        ref_id = document["reference"]["id"]

        if not await virtool.references.db.check_right(
            self.request,
            ref_id,
            "modify_otu",
        ):
            raise APIInsufficientRights()

        if message := await virtool.otus.db.check_sequence_segment_or_target(
            mongo,
            otu_id,
            isolate_id,
            None,
            ref_id,
            data.dict(),
        ):
            raise APIBadRequest(message)

        sequence_document = await self.data.otus.create_sequence(
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
                "Location": f"/otus/{otu_id}/isolates/{isolate_id}/sequences/{sequence_document['id']}",
            },
        )


@routes.web.view("/otus/{otu_id}/isolates/{isolate_id}/sequences/{sequence_id}")
class SequenceView(APIView):
    async def get(
        self,
        otu_id: str,
        isolate_id: str,
        sequence_id: str,
        /,
    ) -> R200[Sequence] | R404:
        """Get a sequence.

        Fetches the details for a sequence.

        A FASTA file containing the nucelotide sequence can be downloaded by appending
        `.fa` to the path.

        """
        if self.request.path.endswith(".fa"):
            sequence_id = sequence_id.rstrip(".fa")

            try:
                filename, fasta = await get_data_from_req(
                    self.request,
                ).otus.get_sequence_fasta(sequence_id)
            except ResourceNotFoundError as err:
                if "does not exist" in str(err):
                    raise APINotFound()

                raise

            if fasta is None:
                raise APINotFound()

            return web.Response(
                text=fasta,
                headers={"Content-Disposition": f"attachment; filename={filename}"},
            )

        try:
            sequence = await self.data.otus.get_sequence(
                otu_id,
                isolate_id,
                sequence_id,
            )
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(sequence)

    async def patch(
        self,
        otu_id: str,
        isolate_id: str,
        sequence_id: str,
        /,
        data: SequenceUpdateRequest,
    ) -> R200[Sequence] | R400 | R401 | R403 | R404:
        """Update a sequence.

        Updates a sequence using its 'otu id', 'isolate id' and 'sequence id'.

        """
        mongo = get_mongo_from_req(self.request)

        document = await mongo.otus.find_one(
            {"_id": otu_id, "isolates.id": isolate_id},
            ["reference", "segment"],
        )

        if not document or not await mongo.sequences.count_documents(
            {"_id": sequence_id},
            limit=1,
        ):
            raise APINotFound()

        if not await virtool.references.db.check_right(
            self.request,
            document["reference"]["id"],
            "modify_otu",
        ):
            raise APIInsufficientRights()

        if message := await virtool.otus.db.check_sequence_segment_or_target(
            mongo,
            otu_id,
            isolate_id,
            sequence_id,
            document["reference"]["id"],
            data.dict(exclude_unset=True),
        ):
            raise APIBadRequest(message)

        sequence_document = await self.data.otus.update_sequence(
            otu_id,
            isolate_id,
            sequence_id,
            self.request["client"].user_id,
            data,
        )

        return json_response(sequence_document)

    async def delete(
        self,
        otu_id: str,
        isolate_id: str,
        sequence_id: str,
        /,
    ) -> R204 | R401 | R403 | R404:
        """Delete a sequence.

        Deletes the specified sequence.

        """
        mongo = get_mongo_from_req(self.request)

        if not await mongo.sequences.count_documents({"_id": sequence_id}, limit=1):
            raise APINotFound()

        document = await mongo.otus.find_one(
            {"_id": otu_id, "isolates.id": isolate_id},
            ["reference"],
        )

        if document is None:
            raise APINotFound()

        if not await virtool.references.db.check_right(
            self.request,
            document["reference"]["id"],
            "modify_otu",
        ):
            raise APIInsufficientRights()

        await self.data.otus.delete_sequence(
            otu_id,
            isolate_id,
            sequence_id,
            self.request["client"].user_id,
        )

        raise APINoContent()


@routes.web.view("/otus/{otu_id}/history")
class OTUHistoryView(APIView):
    async def get(self, otu_id: str) -> R200 | R404:
        """List history.

        Lists an OTU's history.
        """
        mongo = get_mongo_from_req(self.request)

        if not await mongo.otus.count_documents({"_id": otu_id}, limit=1):
            raise APINotFound()

        documents = await mongo.history.find(
            {"otu.id": otu_id},
            projection=HISTORY_LIST_PROJECTION,
        ).to_list(None)

        return json_response(
            await apply_transforms(
                [base_processor(d) for d in documents],
                [AttachUserTransform(mongo, ignore_errors=True)],
            ),
        )
