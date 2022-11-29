from pathlib import Path
from typing import Any

from virtool_core.models.history import HistorySearchResult, History

import virtool.otus.utils
import virtool.utils
from virtool.data.errors import ResourceNotFoundError, ResourceConflictError
from virtool.errors import DatabaseError
from virtool.history.db import DiffTransform, PROJECTION, patch_to_version
from virtool.mongo.core import DB
from virtool.mongo.transforms import apply_transforms
from virtool.references.transforms import AttachReferenceTransform
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

    async def get(self, change_id: str) -> History:
        """
        Get a document given its ID.
        :param change_id: the ID of the document to get
        """
        document = await self._db.history.find_one(change_id, PROJECTION)

        if document:
            document = await apply_transforms(
                virtool.utils.base_processor(document),
                [
                    AttachReferenceTransform(self._db),
                    AttachUserTransform(self._db),
                    DiffTransform(self.data_path),
                ],
            )
            return History(**document)

        raise ResourceNotFoundError()

    async def delete(self, change_id: str):
        """
        Delete a document given its ID.
        :param change_id: the ID of the document to delete
        """
        document = await self._db.history.find_one(change_id, ["reference"])

        if not document:
            raise ResourceNotFoundError()

        try:
            change = await self._db.history.find_one({"_id": change_id}, ["index"])

            if (
                change["index"]["id"] != "unbuilt"
                or change["index"]["version"] != "unbuilt"
            ):
                raise virtool.errors.DatabaseError(
                    "Change is included in a build an not revertible"
                )

            otu_id, otu_version = change_id.split(".")

            if otu_version != "removed":
                otu_version = int(otu_version)

            _, patched, history_to_delete = await patch_to_version(
                self.data_path, self._db, otu_id, otu_version - 1
            )

            # Remove the old sequences from the collection.
            await self._db.sequences.delete_many({"otu_id": otu_id})

            if patched is None:
                await self._db.otus.delete_one({"_id": otu_id})
            else:
                patched_otu, sequences = virtool.otus.utils.split(patched)

                # Add the reverted sequences to the collection.
                for sequence in sequences:
                    await self._db.sequences.insert_one(sequence)

                # Replace existing otu with patched one. If it doesn't exist, insert it.
                await self._db.otus.replace_one(
                    {"_id": otu_id}, patched_otu, upsert=True
                )

            await self._db.history.delete_many({"_id": {"$in": history_to_delete}})
        except DatabaseError:
            raise ResourceConflictError()
