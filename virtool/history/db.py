"""
Work with OTU history in the database.

"""
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import dictdiffer
import pymongo.errors

import virtool.errors
import virtool.history.utils
import virtool.otus.db
import virtool.otus.utils
import virtool.utils
from virtool.api.utils import paginate
from virtool.db.transforms import AbstractTransform, apply_transforms
from virtool.history.utils import (
    calculate_diff,
    derive_otu_information,
    write_diff_file,
)
from virtool.types import Document
from virtool.users.db import ATTACH_PROJECTION, AttachUserTransform

MOST_RECENT_PROJECTION = [
    "_id",
    "description",
    "method_name",
    "user",
    "otu",
    "created_at",
]

LIST_PROJECTION = [
    "_id",
    "description",
    "method_name",
    "created_at",
    "index",
    "otu",
    "reference",
    "user",
]

PROJECTION = LIST_PROJECTION + ["diff"]


class DiffTransform(AbstractTransform):
    def __init__(self, data_path: Path):
        self._data_path = data_path

    async def attach_one(self, document: Document, prepared: Any) -> Document:
        return {**document, "diff": prepared}

    async def prepare_one(self, document: Document) -> Any:

        if document["diff"] == "file":
            otu_id, otu_version = document["id"].split(".")

            document["diff"] = await virtool.history.utils.read_diff_file(
                self._data_path, otu_id, otu_version
            )

        return document["diff"]


async def processor(db, document: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process a history document before it is returned to the client.

    :param db: the application object
    :param document: the document to process
    :return: the processed document
    """
    return await apply_transforms(
        virtool.utils.base_processor(document),
        [AttachUserTransform(db, ignore_errors=True)],
    )


async def add(
    app,
    method_name: str,
    old: Optional[dict],
    new: Optional[dict],
    description: str,
    user_id: str,
    silent: bool = False,
) -> dict:
    """
    Add a change document to the history collection.

    :param app: the application object
    :param method_name: the name of the handler method that executed the change
    :param old: the otu document prior to the change
    :param new: the otu document after the change
    :param description: a human readable description of the change
    :param user_id: the id of the requesting user
    :param silent: don't dispatch a message
    :return: the change document

    """
    db = app["db"]

    otu_id, otu_name, otu_version, ref_id = derive_otu_information(old, new)

    document = {
        "_id": ".".join([str(otu_id), str(otu_version)]),
        "method_name": method_name,
        "description": description,
        "created_at": virtool.utils.timestamp(),
        "otu": {"id": otu_id, "name": otu_name, "version": otu_version},
        "reference": {"id": ref_id},
        "index": {"id": "unbuilt", "version": "unbuilt"},
        "user": {"id": user_id},
    }

    if method_name == "create":
        document["diff"] = new

    elif method_name == "remove":
        document["diff"] = old

    else:
        document["diff"] = calculate_diff(old, new)

    try:
        await db.history.insert_one(document, silent=silent)
    except pymongo.errors.DocumentTooLarge:
        await write_diff_file(
            app["config"].data_path, otu_id, otu_version, document["diff"]
        )

        await db.history.insert_one(dict(document, diff="file"), silent=silent)

    return document


async def find(db, req_query, base_query=None):
    data = await paginate(
        db.history,
        {},
        req_query,
        base_query=base_query,
        sort="otu.version",
        projection=LIST_PROJECTION,
        reverse=True,
    )

    return {
        **data,
        "documents": await apply_transforms(
            data["documents"], [AttachUserTransform(db)]
        ),
    }


async def get(app, change_id: str) -> Optional[Document]:
    """
    Get a complete history document identified by the passed `changed_id`.

    Loads diff field from file if necessary. Returns `None` if the document does not
    exist.

    :param app: the application object
    :param change_id: the ID of the change to get
    :return: the change

    """
    db = app["db"]

    document = await db.history.find_one(change_id, PROJECTION)

    if document:
        return await apply_transforms(
            virtool.utils.base_processor(document),
            [AttachUserTransform(db), DiffTransform(app["config"].data_path)],
        )

    return None


async def get_contributors(db, query: dict) -> List[dict]:
    """
    Return list of contributors and their contribution count for a specific set of
    history.

    :param db: the application database client
    :param query: a query to filter scanned history by
    :return: a list of contributors to the scanned history changes

    """
    cursor = db.history.aggregate(
        [{"$match": query}, {"$group": {"_id": "$user.id", "count": {"$sum": 1}}}]
    )

    contributors = [{"id": c["_id"], "count": c["count"]} async for c in cursor]

    users = await db.users.find(
        {"_id": {"$in": [c["id"] for c in contributors]}}, projection=ATTACH_PROJECTION
    ).to_list(None)

    users = {u.pop("_id"): u for u in users}

    return [{**u, **users[u["id"]]} for u in contributors]


async def get_most_recent_change(db, otu_id: str) -> dict:
    """
    Get the most recent change for the otu identified by the passed ``otu_id``.

    :param db: the application database client
    :param otu_id: the target otu_id
    :return: the most recent change document

    """
    return await db.history.find_one(
        {"otu.id": otu_id, "index.id": "unbuilt"},
        MOST_RECENT_PROJECTION,
        sort=[("otu.version", -1)],
    )


async def patch_to_version(app, otu_id: str, version: Union[str, int]) -> tuple:
    """
    Take a joined otu back in time to the passed ``version``.

    Uses the diffs in the change documents associated with the otu.

    :param app: the application object
    :param otu_id: the id of the otu to patch
    :param version: the version to patch to
    :return: the current joined otu, patched otu, and the ids of reverted changes

    """
    db = app["db"]

    reverted_history_ids = list()

    current = await virtool.otus.db.join(db, otu_id) or dict()

    if "version" in current and current["version"] == version:
        return current, deepcopy(current), reverted_history_ids

    patched = deepcopy(current)

    # Sort the changes by descending timestamp.
    async for change in db.history.find({"otu.id": otu_id}, sort=[("otu.version", -1)]):
        if change["otu"]["version"] == "removed" or change["otu"]["version"] > version:
            reverted_history_ids.append(change["_id"])

            if change["diff"] == "file":
                change["diff"] = await virtool.history.utils.read_diff_file(
                    app["config"].data_path, otu_id, change["otu"]["version"]
                )

            if change["method_name"] == "remove":
                patched = change["diff"]

            elif change["method_name"] == "create":
                patched = None

            else:
                diff = dictdiffer.swap(change["diff"])
                patched = dictdiffer.patch(diff, patched)
        else:
            break

    if current == {}:
        current = None

    return current, patched, reverted_history_ids


async def revert(app, change_id: str) -> dict:
    """
    Revert a history change given by the passed ``change_id``.

    :param app: the application object
    :param change_id: a unique id for the change
    :return: the updated OTU

    """
    db = app["db"]

    change = await db.history.find_one({"_id": change_id}, ["index"])

    if change["index"]["id"] != "unbuilt" or change["index"]["version"] != "unbuilt":
        raise virtool.errors.DatabaseError(
            "Change is included in a build an not revertible"
        )

    otu_id, otu_version = change_id.split(".")

    if otu_version != "removed":
        otu_version = int(otu_version)

    _, patched, history_to_delete = await patch_to_version(app, otu_id, otu_version - 1)

    # Remove the old sequences from the collection.
    await db.sequences.delete_many({"otu_id": otu_id})

    if patched is not None:
        patched_otu, sequences = virtool.otus.utils.split(patched)

        # Add the reverted sequences to the collection.
        for sequence in sequences:
            await db.sequences.insert_one(sequence)

        # Replace the existing otu with the patched one. If it doesn't exist, insert it.
        await db.otus.replace_one({"_id": otu_id}, patched_otu, upsert=True)

    else:
        await db.otus.delete_one({"_id": otu_id})

    await db.history.delete_many({"_id": {"$in": history_to_delete}})

    return patched
