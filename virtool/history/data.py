from pathlib import Path
from typing import Any, Optional

from aiohttp.web_app import Application
from virtool_core.models.history import HistorySearchResult

import virtool.utils
from virtool.data.errors import ResourceNotFoundError, ResourceConflictError
from virtool.errors import DatabaseError
from virtool.history.db import DiffTransform, PROJECTION
from virtool.mongo.core import DB
from virtool.mongo.transforms import apply_transforms
from virtool.types import Document
from virtool.users.db import AttachUserTransform


class HistoryData:
    def __init__(self, data_path: Path, db: DB):
        self.data_path = data_path
        self._db = db

    async def find(self, req_query: Any) -> HistorySearchResult:
        """
        List all change documents.
        :param req_query: the request query
        :return: a list of all documents
        """

        documents = await virtool.history.db.find(self._db, req_query)

        return HistorySearchResult(**documents)

    async def get(self, change_id: str) -> Optional[Document]:
        """
        Get a document given its ID.
        :param app: the application object
        :param change_id: the ID of the document to delete
        """
        document = await self._db.history.find_one(change_id, PROJECTION)

        if document:
            document = await apply_transforms(
                virtool.utils.base_processor(document),
                [AttachUserTransform(self._db), DiffTransform(self.data_path)],
            )

            return document

        return None

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
