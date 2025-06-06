"""Work with OTU history in the database."""

import asyncio
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

import dictdiffer
from motor.motor_asyncio import AsyncIOMotorClientSession
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.history.utils
import virtool.otus.db
import virtool.utils
from virtool.api.utils import paginate
from virtool.data.transforms import apply_transforms
from virtool.history.sql import SQLHistoryDiff
from virtool.history.utils import (
    calculate_diff,
    compose_history_description,
    derive_otu_information,
)
from virtool.models.enums import HistoryMethod
from virtool.references.transforms import AttachReferenceTransform
from virtool.types import Document
from virtool.users.db import ATTACH_PROJECTION
from virtool.users.transforms import AttachUserTransform
from virtool.utils import base_processor

if TYPE_CHECKING:
    from virtool.mongo.core import Mongo

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

HISTORY_PROJECTION = [*HISTORY_LIST_PROJECTION, "diff"]
"""A MongoDB projection for history that includes the ``diff`` field."""


@dataclass
class PreparedChange:
    diff: dict
    document: Document
    id: str


async def add(
    mongo: "Mongo",
    pg: AsyncEngine,
    description: str,
    method_name: HistoryMethod,
    old: dict | None,
    new: dict | None,
    user_id: str,
    mongo_session: AsyncIOMotorClientSession | None = None,
) -> dict:
    """Add a change document to the history collection.

    :param mongo: the application database object
    :param pg: the application PostgreSQL database object
    :param method_name: the name of the handler method that executed the change
    :param old: the otu document prior to the change
    :param new: the otu document after the change
    :param description: a human-readable description of the change
    :param user_id: the id of the requesting user
    :return: the change document

    """
    prepared = prepare_add(method_name, old, new, user_id, description=description)

    async with AsyncSession(pg) as pg_session:
        await pg_session.execute(
            insert(SQLHistoryDiff).values(
                change_id=prepared.document["_id"],
                diff=prepared.diff,
            ),
        )

        await mongo.history.insert_one(prepared.document, session=mongo_session)

        await pg_session.commit()

    return {**prepared.document, "diff": prepared.diff}


def prepare_add(
    method_name: HistoryMethod,
    old: dict | None,
    new: dict | None,
    user_id: str,
    description: str = "",
) -> PreparedChange:
    """Add a change document to the history collection.

    :param method_name: the name of the method that executed the change
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

    if not description:
        description = compose_history_description(method_name, otu_name, abbreviation)

    if method_name.value == "create":
        diff = new

    elif method_name.value == "remove":
        diff = old

    else:
        diff = calculate_diff(old, new)

    change_id = f"{otu_id}.{otu_version}"

    return PreparedChange(
        diff,
        {
            "_id": change_id,
            "created_at": virtool.utils.timestamp(),
            "description": description,
            "diff": "postgres",
            "index": {"id": "unbuilt", "version": "unbuilt"},
            "method_name": method_name.value,
            "otu": {"id": otu_id, "name": otu_name, "version": otu_version},
            "reference": {"id": ref_id},
            "user": {"id": user_id},
        },
        change_id,
    )


async def find(mongo: "Mongo", req_query, base_query: Document | None = None):
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
