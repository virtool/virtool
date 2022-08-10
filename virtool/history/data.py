from typing import List, Any

from aiohttp.web_app import Application
from virtool_core.models.history import HistorySearchResult, History

import virtool
from virtool.data.errors import ResourceNotFoundError, ResourceConflictError
from virtool.errors import DatabaseError
from virtool.history.db import LIST_PROJECTION
from virtool.mongo.core import DB


class HistoryData:
    def __init__(self, db: DB):
        self._db = db

    async def find(self, req_query: Any) -> HistorySearchResult:
        """
        List all change documents.
        :param req_query: the request query
        :return: a list of all documents
        """

        documents = await virtool.history.db.find(db=self._db, req_query=req_query)

        return HistorySearchResult(**documents)

    async def get(self, app: Application, change_id: str) -> History:
        """
        Get a document given its ID.
        :param app: the application object
        :param change_id: the ID of the document to delete
        """

        document = await virtool.history.db.get(app, change_id)

        if not document:
            raise ResourceNotFoundError()

        return History(**document)

    async def delete(self, app: Application, change_id: str):
        """
        Delete a document given its ID.
        :param app: the application object
        :param change_id: the ID of the document to delete
        """
        document = await self._db.history.find_one(change_id, ["reference"])

        if not document:
            raise ResourceNotFoundError()

        try:
            await virtool.history.db.revert(app, change_id)
        except DatabaseError:
            raise ResourceConflictError()
