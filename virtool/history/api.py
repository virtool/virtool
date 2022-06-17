from typing import Union, List, Dict, Any

from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r204, r403, r404, r409, r422

import virtool.history.db
import virtool.http.routes
import virtool.references.db
from aiohttp.web import HTTPConflict, HTTPNoContent
from virtool.api.response import InsufficientRights, NotFound, json_response
from virtool.errors import DatabaseError
from virtool_core.models.history import History, HistoryMinimal

routes = virtool.http.routes.Routes()


@routes.view("/history")
class ChangesView(PydanticView):

    async def get(self) -> Union[Dict[str, Union[Any, List[HistoryMinimal]]], r422]:
        """
        Get a list of change documents.

        Status Codes:
        200: Successful Operation
        422: Invalid query
        """
        db = self.request.app["db"]

        data = await virtool.history.db.find(db, self.request.query)

        return json_response(data)


@routes.view("/history/{change_id}")
class ChangeView(PydanticView):

    async def get(self) -> Union[r200[History], r404]:
        """
        Get a specific change document by its ``change_id``.

        Status Codes:
        200: Successful Operation
        404: Not found
        """
        change_id = self.request.match_info["change_id"]

        document = await virtool.history.db.get(self.request.app, change_id)

        if document:
            return json_response(document)

        raise NotFound()

    async def delete(self) -> Union[r204, r403, r404, r409]:
        """
        Remove the change document with the given ``change_id`` and
        any subsequent changes.

        Status Codes:
        204: Successful Operation
        403: Insufficient Rights
        404: Not found
        409: Not unbuilt
        """
        db = self.request.app["db"]

        change_id = self.request.match_info["change_id"]

        document = await db.history.find_one(change_id, ["reference"])

        if not document:
            raise NotFound()

        if not await virtool.references.db.check_right(
                self.request, document["reference"]["id"], "modify_otu"
        ):
            raise InsufficientRights()

        try:
            await virtool.history.db.revert(self.request.app, change_id)
        except DatabaseError:
            raise HTTPConflict(text="Change is already built")

        raise HTTPNoContent
