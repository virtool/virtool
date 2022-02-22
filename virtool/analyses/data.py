from typing import Optional

import virtool.analyses.format
from virtool.types import Document


class AnalysisData:
    def __init__(self, app):
        self._app = app
        self._db = app["db"]

    async def get_by_id(self, analysis_id: str) -> Optional[Document]:
        document = await self._db.analyses.find_one(analysis_id)

        if document is None:
            return None

        if "updated_at" not in document:
            document["updated_at"] = document["created_at"]

        if document["ready"]:
            return await virtool.analyses.format.format_analysis(self._app, document)

        return document
