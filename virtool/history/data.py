from pathlib import Path
from typing import Any

from sqlalchemy.ext.asyncio import AsyncEngine

import virtool.otus.utils
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.transforms import apply_transforms
from virtool.errors import DatabaseError
from virtool.history.db import HISTORY_PROJECTION, patch_to_version
from virtool.history.models import History, HistorySearchResult
from virtool.history.transforms import AttachDiffTransform
from virtool.mongo.core import Mongo
from virtool.references.transforms import AttachReferenceTransform
from virtool.users.transforms import AttachUserTransform
from virtool.utils import base_processor


class HistoryData:
    name = "history"

    def __init__(self, data_path: Path, mongo: Mongo, pg: AsyncEngine):
        self._data_path = data_path
        self._mongo = mongo
        self._pg = pg

    async def find(self, req_query: Any) -> HistorySearchResult:
        """List all change documents.

        :param req_query: the request query
        :return: a list of all documents
        """
        documents = await virtool.history.db.find(self._mongo, self._pg, {}, req_query)

        return HistorySearchResult(**documents)

    async def get(self, change_id: str) -> History:
        """Get a change by its ID.

        :param change_id: the ID of the change.
        :return: the change
        """
        document = await self._mongo.history.find_one(change_id, HISTORY_PROJECTION)

        if document:
            document = await apply_transforms(
                base_processor(document),
                [
                    AttachDiffTransform(self._data_path, self._pg),
                    AttachReferenceTransform(self._mongo),
                    AttachUserTransform(self._pg),
                ],
            )
            return History(**document)

        raise ResourceNotFoundError()

    async def delete(self, change_id: str) -> None:
        """Delete a change given its ID.

        Deleting the change will revert the changes make to the associated OTU.

        :param change_id: the ID of the document to delete
        """
        document = await self._mongo.history.find_one(change_id, ["reference"])

        if not document:
            raise ResourceNotFoundError()

        try:
            change = await self._mongo.history.find_one({"_id": change_id}, ["index"])

            if (
                change["index"]["id"] != "unbuilt"
                or change["index"]["version"] != "unbuilt"
            ):
                raise DatabaseError(
                    "Change is included in a build an not revertible",
                )

            otu_id, otu_version = change_id.split(".")

            if otu_version != "removed":
                otu_version = int(otu_version)

            _, patched, history_to_delete = await patch_to_version(
                self._data_path,
                self._mongo,
                otu_id,
                otu_version - 1,
            )

            # Remove the old sequences from the collection.
            await self._mongo.sequences.delete_many({"otu_id": otu_id})

            if patched is None:
                await self._mongo.otus.delete_one({"_id": otu_id})
            else:
                patched_otu, sequences = virtool.otus.utils.split(patched)

                # Add the reverted sequences to the collection.
                for sequence in sequences:
                    await self._mongo.sequences.insert_one(sequence)

                # Replace existing otu with patched one. If it doesn't exist, insert it.
                await self._mongo.otus.replace_one(
                    {"_id": otu_id},
                    patched_otu,
                    upsert=True,
                )

            await self._mongo.history.delete_many({"_id": {"$in": history_to_delete}})
        except DatabaseError:
            raise ResourceConflictError()
