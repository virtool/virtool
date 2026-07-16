from aiohttp import web
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r201, r204, r400, r401, r403, r404

from virtool.api.custom_json import json_response
from virtool.api.errors import (
    APIBadRequest,
    APIInsufficientRights,
    APINoContent,
    APINotFound,
)
from virtool.api.routes import Routes
from virtool.data.errors import (
    ResourceConflictError,
    ResourceError,
    ResourceNotFoundError,
)
from virtool.data.utils import get_data_from_req
from virtool.models.roles import AdministratorRole
from virtool.otus.models import OTU, OTUIsolate, OTUSequence, Sequence
from virtool.otus.oas import (
    CreateIsolateRequest,
    CreateSequenceRequest,
    UpdateIsolateRequest,
    UpdateOTURequest,
    UpdateSequenceRequest,
)

routes = Routes()


async def check_otu_right(
    request,
    otu_id: str,
    isolate_id: str | None = None,
) -> None:
    """Raise unless the requesting client may modify the OTU's parent reference.

    Every OTU handler but the reads guards on ``modify_otu`` against the reference the
    OTU belongs to, so the lookup of that reference and the translation of its absence
    into a ``404`` are shared here rather than repeated per handler. The authorization
    decision itself stays in the API layer.

    :param request: the request
    :param otu_id: the ID of the OTU being addressed
    :param isolate_id: the ID of an isolate the OTU must carry
    :raises APINotFound: the OTU, or the named isolate, does not exist
    :raises APIInsufficientRights: the client may not modify the OTU
    """
    try:
        reference_id = await get_data_from_req(request).otus.get_reference_id(
            otu_id,
            isolate_id=isolate_id,
        )
    except ResourceNotFoundError:
        raise APINotFound()

    client = request["client"]

    if not await get_data_from_req(request).references.check_right(
        reference_id,
        "modify_otu",
        user_id=client.user_id,
        group_ids=client.groups,
        administrator=client.administrator_role == AdministratorRole.FULL,
    ):
        raise APIInsufficientRights()


@routes.view("/otus/{otu_id}")
class OTUView(PydanticView):
    async def get(self, otu_id: str, /) -> r200[OTU] | r403 | r404:
        """Get an OTU.

        Fetches the details of an OTU.

        A FASTA file containing all sequences in the OTU can be downloaded by appending
        `.fa` to the path.

        """
        if self.request.path.endswith(".fa"):
            otu_id = otu_id.removesuffix(".fa")

            try:
                filename, fasta = await get_data_from_req(self.request).otus.get_fasta(
                    otu_id,
                )
            except ResourceNotFoundError:
                raise APINotFound()

            return web.Response(
                text=fasta,
                headers={"Content-Disposition": f"attachment; filename={filename}"},
            )

        try:
            otu = await get_data_from_req(self.request).otus.get(otu_id)
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(otu)

    async def patch(
        self,
        otu_id: str,
        /,
        data: UpdateOTURequest,
    ) -> r200[OTU] | r400 | r403 | r404:
        """Update an OTU.

        Checks to make sure the supplied OTU name and abbreviation don't already exist
        in the parent reference.

        """
        await check_otu_right(self.request, otu_id)

        try:
            otu = await get_data_from_req(self.request).otus.update(
                otu_id,
                data,
                self.request["client"].user_id,
            )
        except ResourceNotFoundError:
            raise APINotFound()
        except ResourceError as err:
            raise APIBadRequest(str(err))

        return json_response(otu)

    async def delete(self, otu_id: str, /) -> r204 | r401 | r403 | r404:
        """Delete an OTU.

        Deletes and OTU and its associated isolates and sequences.

        """
        await check_otu_right(self.request, otu_id)

        await get_data_from_req(self.request).otus.remove(
            otu_id,
            self.request["client"].user_id,
        )

        return web.Response(status=204)


@routes.view("/otus/{otu_id}/isolates")
class IsolatesView(PydanticView):
    async def get(self, otu_id: str, /):
        """List isolates.

        Lists all the isolates and sequences for an OTU.

        """
        try:
            isolates = await get_data_from_req(self.request).otus.list_isolates(otu_id)
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(isolates)

    async def post(
        self,
        otu_id: str,
        /,
        data: CreateIsolateRequest,
    ) -> r201[OTUIsolate] | r401 | r404:
        """Create an isolate.

        Creates an isolate on the OTU specified by `otu_id`.

        """
        await check_otu_right(self.request, otu_id)

        try:
            isolate = await get_data_from_req(self.request).otus.add_isolate(
                otu_id,
                data.source_type,
                data.source_name,
                self.request["client"].user_id,
                data.default,
            )
        except ResourceConflictError as err:
            raise APIBadRequest(str(err))

        return json_response(
            isolate,
            status=201,
            headers={"Location": f"/otus/{otu_id}/isolates/{isolate.id}"},
        )


@routes.view("/otus/{otu_id}/isolates/{isolate_id}")
class IsolateView(PydanticView):
    async def get(
        self,
        otu_id: str,
        isolate_id: str,
        /,
    ) -> r200[OTUIsolate] | r404:
        """Get an isolate.

        Fetches the details of an isolate.

        A FASTA file containing all sequences in the isolate can be downloaded by
        appending `.fa` to the path.
        """
        isolate_id = isolate_id.removesuffix(".fa")

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

        try:
            isolate = await get_data_from_req(self.request).otus.get_isolate(
                otu_id,
                isolate_id,
            )
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(isolate)

    async def patch(
        self,
        otu_id: str,
        isolate_id: str,
        /,
        data: UpdateIsolateRequest,
    ) -> r200[OTUIsolate] | r401 | r404:
        """Update an isolate.

        Updates an isolate using 'otu_id' and 'isolate_id'.

        """
        await check_otu_right(self.request, otu_id, isolate_id=isolate_id)

        data = data.dict(exclude_unset=True)

        try:
            isolate = await get_data_from_req(self.request).otus.update_isolate(
                otu_id,
                isolate_id,
                self.request["client"].user_id,
                source_type=data.get("source_type"),
                source_name=data.get("source_name"),
            )
        except ResourceConflictError as err:
            raise APIBadRequest(str(err))

        return json_response(isolate, status=200)

    async def delete(self, otu_id: str, isolate_id: str, /):
        """Delete an isolate.

        Deletes an isolate using its 'otu id' and 'isolate id'.

        """
        await check_otu_right(self.request, otu_id, isolate_id=isolate_id)

        await get_data_from_req(self.request).otus.remove_isolate(
            otu_id,
            isolate_id,
            self.request["client"].user_id,
        )

        raise APINoContent()


@routes.view("/otus/{otu_id}/isolates/{isolate_id}/sequences")
class SequencesView(PydanticView):
    async def get(
        self,
        otu_id: str,
        isolate_id: str,
        /,
    ) -> r200[list[OTUSequence]] | r401 | r403 | r404:
        """List sequences.

        Lists the sequences for an isolate.

        """
        try:
            sequences = await get_data_from_req(
                self.request,
            ).otus.list_isolate_sequences(otu_id, isolate_id)
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(sequences)

    async def post(
        self,
        otu_id: str,
        isolate_id: str,
        /,
        data: CreateSequenceRequest,
    ) -> r201[Sequence] | r400 | r403 | r404:
        """Create a sequence.

        Creates a new sequence for an isolate identified by `otu_id` and `isolate_id`.

        """
        await check_otu_right(self.request, otu_id, isolate_id=isolate_id)

        try:
            sequence = await get_data_from_req(self.request).otus.create_sequence(
                otu_id,
                isolate_id,
                data.accession,
                data.definition,
                data.sequence,
                self.request["client"].user_id,
                host=data.host,
                segment=data.segment,
            )
        except ResourceError as err:
            raise APIBadRequest(str(err))

        location = f"/otus/{otu_id}/isolates/{isolate_id}/sequences/{sequence.id}"

        return json_response(
            sequence,
            status=201,
            headers={"Location": location},
        )


@routes.view("/otus/{otu_id}/isolates/{isolate_id}/sequences/{sequence_id}")
class SequenceView(PydanticView):
    async def get(self, otu_id: str, isolate_id: str, sequence_id: str, /):
        """Get a sequence.

        Fetches the details for a sequence.

        A FASTA file containing the nucelotide sequence can be downloaded by appending
        `.fa` to the path.

        """
        if self.request.path.endswith(".fa"):
            sequence_id = sequence_id.removesuffix(".fa")

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
            sequence = await get_data_from_req(self.request).otus.get_sequence(
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
        data: UpdateSequenceRequest,
    ) -> r200[Sequence] | r400 | r401 | r403 | r404:
        """Update a sequence.

        Updates a sequence using its 'otu id', 'isolate id' and 'sequence id'.

        """
        if not await get_data_from_req(self.request).otus.sequence_exists(sequence_id):
            raise APINotFound()

        await check_otu_right(self.request, otu_id, isolate_id=isolate_id)

        try:
            sequence_document = await get_data_from_req(
                self.request,
            ).otus.update_sequence(
                otu_id,
                isolate_id,
                sequence_id,
                self.request["client"].user_id,
                data,
            )
        except ResourceError as err:
            raise APIBadRequest(str(err))

        return json_response(sequence_document)

    async def delete(self, otu_id: str, isolate_id: str, sequence_id: str, /):
        """Delete a sequence.

        Deletes the specified sequence.

        """
        if not await get_data_from_req(self.request).otus.sequence_exists(sequence_id):
            raise APINotFound()

        await check_otu_right(self.request, otu_id, isolate_id=isolate_id)

        await get_data_from_req(self.request).otus.remove_sequence(
            otu_id,
            isolate_id,
            sequence_id,
            self.request["client"].user_id,
        )

        raise APINoContent()


@routes.get("/otus/{otu_id}/history")
async def list_history(req):
    """List history.

    Lists an OTU's history.
    """
    otu_id = req.match_info["otu_id"]

    try:
        changes = await get_data_from_req(req).history.list_by_otu(otu_id)
    except ResourceNotFoundError:
        raise APINotFound()

    return json_response(changes)


@routes.put("/otus/{otu_id}/isolates/{isolate_id}/default")
async def set_as_default(req):
    """Set default isolate.

    Sets an isolate as default.

    """
    otu_id = req.match_info["otu_id"]
    isolate_id = req.match_info["isolate_id"]

    await check_otu_right(req, otu_id, isolate_id=isolate_id)

    isolate = await get_data_from_req(req).otus.set_isolate_as_default(
        otu_id,
        isolate_id,
        req["client"].user_id,
    )

    return json_response(isolate)
