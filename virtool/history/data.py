from typing import List, Any, Dict, Union

import virtool.history.db
from virtool.data.errors import ResourceNotFoundError
from virtool_core.models.history import HistoryMinimal
from virtool.mongo.core import DB


class HistoryData:
    def __init__(self, db: DB):
        self._db = db

    async def find(self, req_query: Any) -> List[HistoryMinimal]:
        """
        List all change documents.
        :param req_query: the request query
        :return: a list of all documents
        """
        documents = await virtool.history.db.find(db=self._db, req_query=req_query)

        return [
            HistoryMinimal(**change_document)
            for change_document in documents["documents"]
        ]

    async def delete(self, change_id: str) -> Dict[str, Union[str, dict]]:
        """
        Delete a document given its ID.
        :param change_id: the ID of the document to delete
        :return: the document
        """
        document = await self._db.history.find_one(change_id, ["reference"])

        if not document:
            raise ResourceNotFoundError()

        return document
