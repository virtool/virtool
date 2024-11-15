"""Work with OTU history in the database."""

import asyncio
from copy import deepcopy
from pathlib import Path
from typing import Any

import bson
import dictdiffer
import pymongo.errors
from motor.motor_asyncio import AsyncIOMotorClientSession
from virtool_core.models.enums import HistoryMethod

import virtool.history.utils
import virtool.otus.db
import virtool.utils
from virtool.api.utils import paginate
from virtool.config import get_config_from_app
from virtool.data.transforms import AbstractTransform, apply_transforms
from virtool.history.utils import (
    calculate_diff,
    compose_history_description,
    derive_otu_information,
    write_diff_file,
)
from virtool.mongo.core import Mongo
from virtool.mongo.utils import get_mongo_from_app
from virtool.references.transforms import AttachReferenceTransform
from virtool.types import Document
from virtool.users.db import ATTACH_PROJECTION
from virtool.users.transforms import AttachUserTransform
from virtool.utils import base_processor

HISTORY_LIST_PROJECTION = [
    "_id",
    "description",
    "method_name",
    "created_at",
    "index",
    "otu",
    "reference",
    "user",
]
"""A MongoDB projection for history for listing purposes."""

HISTORY_PROJECTION = HISTORY_LIST_PROJECTION + ["diff"]
"""A MongoDB projection for history that includes the ``diff`` field."""


class DiffTransform(AbstractTransform):
    def __init__(self, data_path: Path):
        self._data_path = data_path

    async def attach_one(self, document: Document, prepared: Any) -> Document:
        return {**document, "diff": prepared}

    async def prepare_one(self, document: Document) -> Any:
        if document["diff"] == "file":
            otu_id, otu_version = document["id"].split(".")

            document["diff"] = await asyncio.to_thread(
                virtool.history.utils.read_diff_file,
                self._data_path,
                otu_id,
                otu_version,
            )

        return document["diff"]


async def add(
    mongo: "Mongo",
    data_path: Path,
    method_name: HistoryMethod,
    old: dict | None,
    new: dict | None,
    description: str,
    user_id: str,
    session: AsyncIOMotorClientSession | None = None,
) -> dict:
    """Add a change document to the history collection.

    :param data_path: system path to the applications datafolder
    :param mongo: the application database object
    :param method_name: the name of the handler method that executed the change
    :param old: the otu document prior to the change
    :param new: the otu document after the change
    :param description: a human readable description of the change
    :param user_id: the id of the requesting user
    :return: the change document

    """
    otu_id, otu_name, otu_version, ref_id = derive_otu_information(old, new)

    document = {
        "_id": ".".join([str(otu_id), str(otu_version)]),
        "method_name": method_name.value,
        "description": description,
        "created_at": virtool.utils.timestamp(),
        "otu": {"id": otu_id, "name": otu_name, "version": otu_version},
        "reference": {"id": ref_id},
        "index": {"id": "unbuilt", "version": "unbuilt"},
        "user": {"id": user_id},
    }

    if method_name.value == "create":
        document["diff"] = new

    elif method_name.value == "remove":
        document["diff"] = old

    else:
        document["diff"] = calculate_diff(old, new)

    try:
        await mongo.history.insert_one(document, session=session)
    except pymongo.errors.DocumentTooLarge:
        history_path = data_path / "history"
        await asyncio.to_thread(history_path.mkdir, parents=True, exist_ok=True)

        await asyncio.to_thread(
            write_diff_file,
            data_path,
            otu_id,
            otu_version,
            document["diff"],
        )

        await mongo.history.insert_one(dict(document, diff="file"), session=session)

    return document


async def prepare_add(
    history_method: HistoryMethod,
    old: dict | None,
    new: dict | None,
    user_id: str,
    data_path: Path,
) -> Document:
    """Add a change document to the history collection.
    :param history_method: the name of the method that executed the change
    :param old: the otu document prior to the change
    :param new: the otu document after the change
    :param user_id: the id of the requesting user
    :return: the change document

    """
    otu_id, otu_name, otu_version, ref_id = derive_otu_information(old, new)

    try:
        abbreviation = new["abbreviation"]
    except (TypeError, KeyError):
        abbreviation = old["abbreviation"]

    description = compose_history_description(history_method, otu_name, abbreviation)

    document = {
        "_id": ".".join([str(otu_id), str(otu_version)]),
        "method_name": history_method.value,
        "description": description,
        "created_at": virtool.utils.timestamp(),
        "otu": {"id": otu_id, "name": otu_name, "version": otu_version},
        "reference": {"id": ref_id},
        "index": {"id": "unbuilt", "version": "unbuilt"},
        "user": {"id": user_id},
    }

    if history_method.value == "create":
        document["diff"] = new

    elif history_method.value == "remove":
        document["diff"] = old

    else:
        document["diff"] = calculate_diff(old, new)

    history_path = data_path / "history"
    await asyncio.to_thread(history_path.mkdir, parents=True, exist_ok=True)

    if len(bson.encode(document)) > 16793600:
        await asyncio.to_thread(
            write_diff_file, data_path, otu_id, otu_version, document["diff"]
        )
        document["diff"] = "file"

    return document


async def find(mongo, req_query, base_query: Document | None = None):
    data = await paginate(
        mongo.history,
        {},
        req_query,
        base_query=base_query,
        sort="otu.version",
        projection=HISTORY_LIST_PROJECTION,
        reverse=True,
    )

    return {
        **data,
        "documents": await apply_transforms(
            [base_processor(d) for d in data["documents"]],
            [AttachReferenceTransform(mongo), AttachUserTransform(mongo)],
        ),
    }


async def get(app, change_id: str) -> Document | None:
    """Get a complete history document identified by the passed `changed_id`.

    Loads diff field from file if necessary. Returns `None` if the document does not
    exist.

    :param app: the application object
    :param change_id: the ID of the change to get
    :return: the change

    """
    mongo = get_mongo_from_app(app)

    document = await mongo.history.find_one(change_id, HISTORY_PROJECTION)

    if document:
        return await apply_transforms(
            base_processor(document),
            [
                AttachUserTransform(mongo),
                DiffTransform(get_config_from_app(app).data_path),
            ],
        )

    return None


async def get_contributors(mongo: "Mongo", query: dict) -> list[dict]:
    """Return list of contributors and their contribution count for a specific set of
    history.

    :param mongo: the application database client
    :param query: a query to filter scanned history by
    :return: a list of contributors to the scanned history changes

    """
    cursor = mongo.history.aggregate(
        [{"$match": query}, {"$group": {"_id": "$user.id", "count": {"$sum": 1}}}],
    )

    contributors = [{"id": c["_id"], "count": c["count"]} async for c in cursor]

    users = await mongo.users.find(
        {"_id": {"$in": [c["id"] for c in contributors]}},
        projection=ATTACH_PROJECTION,
    ).to_list(None)

    users = {u.pop("_id"): u for u in users}

    return [{**u, **users[u["id"]]} for u in contributors]


async def get_most_recent_change(
    mongo: "Mongo",
    otu_id: str,
    session: AsyncIOMotorClientSession | None = None,
) -> Document:
    """Get the most recent change for the otu identified by the passed ``otu_id``.

    :param mongo: the application database client
    :param otu_id: the target otu_id
    :param session: a Motor session to use for database operations
    :return: the most recent change document

    """
    return await mongo.history.find_one(
        {"otu.id": otu_id},
        [
            "_id",
            "description",
            "method_name",
            "user",
            "otu",
            "created_at",
        ],
        sort=[("otu.version", -1)],
        session=session,
    )


async def patch_to_version(
    data_path: Path,
    mongo: "Mongo",
    otu_id: str,
    version: str | int,
) -> tuple:
    """Take a joined otu back in time to the passed ``version``.

    Uses the diffs in the change documents associated with the otu.

    :param data_path: the data path
    :param mongo: the database object
    :param otu_id: the id of the otu to patch
    :param version: the version to patch to
    :return: the current joined otu, patched otu, and the ids of reverted changes

    """
    reverted_history_ids = []

    current = await virtool.otus.db.join(mongo, otu_id) or {}

    if "version" in current and current["version"] == version:
        return current, deepcopy(current), reverted_history_ids

    patched = deepcopy(current)

    # Sort the changes by descending timestamp.
    async for change in mongo.history.find(
        {"otu.id": otu_id},
        sort=[("otu.version", -1)],
    ):
        if change["otu"]["version"] == "removed" or change["otu"]["version"] > version:
            reverted_history_ids.append(change["_id"])

            if change["diff"] == "file":
                change["diff"] = await asyncio.to_thread(
                    virtool.history.utils.read_diff_file,
                    data_path,
                    otu_id,
                    change["otu"]["version"],
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
