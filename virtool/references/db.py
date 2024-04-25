"""Work with references in the database"""

import asyncio
import datetime
from pathlib import Path
from typing import TYPE_CHECKING

import pymongo
from aiohttp import ClientConnectorError
from aiohttp.web import Request
from motor.motor_asyncio import AsyncIOMotorClientSession
from pymongo import DeleteMany, DeleteOne, UpdateOne
from semver import VersionInfo
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.ext.asyncio.engine import AsyncEngine
from virtool_core.models.enums import HistoryMethod
from virtool_core.models.roles import AdministratorRole
from virtool_core.models.settings import Settings

import virtool.github
import virtool.history.db
import virtool.mongo.utils
import virtool.utils
from virtool.api.client import UserClient
from virtool.data.errors import ResourceNotFoundError
from virtool.data.topg import compose_legacy_id_expression
from virtool.data.transforms import apply_transforms
from virtool.errors import DatabaseError
from virtool.groups.pg import SQLGroup
from virtool.mongo.utils import get_mongo_from_req
from virtool.otus.db import join
from virtool.otus.utils import verify
from virtool.pg.utils import get_row
from virtool.references.bulk_models import (
    OTUData,
    OTUDelete,
    OTUInsert,
    OTUUpdate,
    SequenceChanges,
)
from virtool.references.utils import (
    check_will_change,
    get_owner_user,
)
from virtool.releases import (
    GetReleaseError,
    ReleaseType,
    fetch_release_manifest_from_virtool,
)
from virtool.types import Document
from virtool.uploads.models import SQLUpload
from virtool.users.mongo import extend_user
from virtool.users.transforms import AttachUserTransform

if TYPE_CHECKING:
    from virtool.mongo.core import Mongo


PROJECTION = [
    "_id",
    "cloned_from",
    "created_at",
    "data_type",
    "groups",
    "imported_from",
    "installed",
    "internal_control",
    "latest_build",
    "name",
    "organism",
    "release",
    "remotes_from",
    "task",
    "unbuilt_count",
    "updates",
    "updating",
    "user",
    "users",
]


async def processor(mongo: "Mongo", document: Document) -> Document:
    """Process a reference document to a form that can be dispatched or returned in a
    list.

    Used `attach_computed` for complete representations of the reference.

    :param mongo: the application Mongo client
    :param document: the document to process
    :return: the processed document

    """
    try:
        ref_id = document.pop("_id")
    except KeyError:
        ref_id = document["id"]

    latest_build, otu_count, unbuilt_count = await asyncio.gather(
        get_latest_build(mongo, ref_id),
        get_otu_count(mongo, ref_id),
        get_unbuilt_count(mongo, ref_id),
    )

    document.update(
        {
            "latest_build": latest_build,
            "otu_count": otu_count,
            "unbuilt_change_count": unbuilt_count,
        },
    )

    try:
        installed = document.pop("updates")[-1]
    except (KeyError, IndexError):
        installed = None

    if installed:
        installed = await apply_transforms(installed, [AttachUserTransform(mongo)])

    document["id"] = ref_id
    document["installed"] = installed

    return document


async def get_reference_groups(pg: AsyncEngine, document: Document) -> list[Document]:
    """Get a detailed list of groups that have access to the specified reference.

    :param pg: the application Postgres engine
    :param document: the reference document
    :return: a list of group data dictionaries

    """
    if not document["groups"]:
        return []

    document_groups: list[Document] = document["groups"]

    async with AsyncSession(pg) as session:
        result = await session.execute(
            select(SQLGroup).where(
                compose_legacy_id_expression(
                    SQLGroup,
                    [g["id"] for g in document_groups],
                ),
            ),
        )

    rows = result.scalars().all()

    groups_map: dict[int | str, SQLGroup] = {
        **{row.id: row for row in rows},
        **{row.legacy_id: row for row in rows},
    }

    return [
        {
            **g,
            "id": groups_map[g["id"]].id,
            "legacy_id": groups_map[g["id"]].legacy_id,
            "name": groups_map[g["id"]].name,
        }
        for g in document_groups
    ]


async def get_reference_users(mongo: "Mongo", document: Document) -> list[Document]:
    """Get a detailed list of users that have access to the specified reference.

    :param mongo: the application database client
    :param document: the reference document
    :return: a list of user data dictionaries

    """
    if users := document.get("users"):
        return list(await asyncio.gather(*[extend_user(mongo, user) for user in users]))

    return []


async def check_right(req: Request, ref_id: str, right: str) -> bool:
    client: UserClient = req["client"]

    if client.administrator_role == AdministratorRole.FULL:
        return True

    reference = await get_mongo_from_req(req).references.find_one(
        ref_id, ["groups", "users"]
    )

    if reference is None:
        raise ResourceNotFoundError()

    groups: list[dict] = reference["groups"]
    users: list[dict] = reference["users"]

    for user in users:
        if user["id"] == client.user_id:
            if user[right]:
                return True

            break

    for group in groups:
        if group[right] and group["id"] in req["client"].groups:
            return True

    return False


async def check_source_type(mongo: "Mongo", ref_id: str, source_type: str) -> bool:
    """Check if the provided `source_type` is valid based on the current reference
    source type configuration.

    :param mongo: the application database client
    :param ref_id: the reference context
    :param source_type: the source type to check
    :return: source type is valid

    """
    document = await mongo.references.find_one(
        ref_id,
        ["restrict_source_types", "source_types"],
    )

    restrict_source_types = document.get("restrict_source_types", False)
    source_types = document.get("source_types", [])

    if source_type == "unknown":
        return True

    # Return `False` when source_types are restricted and source_type is not allowed.
    if source_type and restrict_source_types:
        return source_type in source_types

    # Return `True` when:
    # - source_type is empty string (unknown)
    # - source_types are not restricted
    # - source_type is an allowed source_type
    return True


def compose_base_find_query(
    user_id: str,
    administrator: bool,
    groups: list[int | str],
) -> dict:
    """Compose a query for filtering reference search results based on user read rights.

    :param user_id: the id of the user requesting the search
    :param administrator: the administrator flag of the user requesting the search
    :param groups: the id group membership of the user requesting the search
    :return: a valid MongoDB query

    """
    if administrator:
        return {}

    return {
        "$or": [
            {"groups.id": {"$in": groups}},
            {"users.id": user_id},
            {"user.id": user_id},
        ],
    }


async def fetch_and_update_release(
    mongo: "Mongo",
    client,
    ref_id: str,
    ignore_errors: bool = False,
) -> dict:
    """Get the latest release for the GitHub repository identified by the passed `slug`.

    If a release is found, update the reference identified by the passed `ref_id` and
    return the release.

    Exceptions can be ignored during the request. Error information will still
    be written to the reference document.

    :param mongo: the application database client
    :param client: the application client
    :param ref_id: the id of the reference to update
    :param ignore_errors: ignore exceptions raised during the request
    :return: the latest release

    """
    retrieved_at = virtool.utils.timestamp()

    document = await mongo.references.find_one(
        ref_id,
        ["installed", "release", "remotes_from"],
    )

    release = document.get("release")

    errors = []

    updated_release: dict | None = None

    try:
        releases = await fetch_release_manifest_from_virtool(
            client,
            ReleaseType.REFERENCES,
        )

        if releases:
            latest_release = releases["ref-plant-viruses"][0]

            updated_release = {
                "id": latest_release["id"],
                "name": latest_release["name"],
                "body": latest_release["body"],
                "filename": latest_release["name"],
                "size": latest_release["size"],
                "html_url": latest_release["html_url"],
                "download_url": latest_release["download_url"],
                "published_at": latest_release["published_at"],
                "content_type": latest_release["content_type"],
            }

    except (ClientConnectorError, GetReleaseError) as err:
        if "ClientConnectorError" in str(err):
            errors = ["Could not reach Virtool.ca"]

        if "404" in str(err):
            errors = ["Release does not exist"]

        if errors and not ignore_errors:
            raise

    if updated_release:
        release = updated_release

    if release:
        installed = document["installed"]

        release["newer"] = bool(
            installed
            and VersionInfo.parse(release["name"].lstrip("v"))
            > VersionInfo.parse(installed["name"].lstrip("v")),
        )

        release["retrieved_at"] = retrieved_at

    await mongo.references.update_one(
        {"_id": ref_id},
        {"$set": {"errors": errors, "release": release}},
    )

    return release


async def get_contributors(mongo: "Mongo", ref_id: str) -> list[Document] | None:
    """Return a list of contributors and their contribution count for a specific ref.

    :param mongo: the application database client
    :param ref_id: the id of the ref to get contributors for
    :return: a list of contributors to the ref

    """
    return await virtool.history.db.get_contributors(mongo, {"reference.id": ref_id})


async def get_internal_control(
    mongo: "Mongo",
    internal_control_id: str | None,
    ref_id: str,
) -> Document | None:
    """Return a minimal dict describing the ref internal control given a `otu_id`.

    :param mongo: the application database client
    :param internal_control_id: the id of the otu to create a minimal dict for
    :param ref_id: the id of the reference to look for the control OTU in
    :return: a minimal dict describing the ref internal control

    """
    if internal_control_id is None:
        return None

    name = await virtool.mongo.utils.get_one_field(
        mongo.otus,
        "name",
        {"_id": internal_control_id, "reference.id": ref_id},
    )

    if name is None:
        return None

    return {"id": internal_control_id, "name": name}


async def get_latest_build(mongo: "Mongo", ref_id: str) -> Document | None:
    """Return the latest index build for the ref.

    :param mongo: the application database client
    :param ref_id: the id of the ref to get the latest build for
    :return: a subset of fields for the latest build

    """
    latest_build = await mongo.indexes.find_one(
        {"reference.id": ref_id, "ready": True},
        projection=["created_at", "version", "user", "has_json"],
        sort=[("version", pymongo.DESCENDING)],
    )

    if latest_build:
        return await apply_transforms(
            virtool.utils.base_processor(latest_build),
            [AttachUserTransform(mongo)],
        )


async def get_official_installed(mongo: "Mongo") -> bool:
    """Return a boolean indicating whether the official plant virus reference is
    installed.

    :param mongo: the application mongodb client
    :return: the install status for the official reference
    """
    return (
        await mongo.references.count_documents(
            {"remotes_from.slug": "virtool/ref-plant-viruses"},
        )
        > 0
    )


async def get_manifest(mongo: "Mongo", ref_id: str) -> Document:
    """Generate a dict of otu document version numbers keyed by the document id.

    This is used to make sure only changes made at the time the index rebuild was
    started are included in the build.

    :param mongo: the application database client
    :param ref_id: the id of the reference to get the current index for
    :return: a manifest of otu ids and versions

    """
    manifest = {}

    async for document in mongo.otus.find({"reference.id": ref_id}, ["version"]):
        manifest[document["_id"]] = document["version"]

    return manifest


async def get_otu_count(mongo: "Mongo", ref_id: str) -> int:
    """Get the number of OTUs associated with the given `ref_id`.

    :param mongo: the application database client
    :param ref_id: the id of the reference to get the current index for
    :return: the OTU count

    """
    return await mongo.otus.count_documents({"reference.id": ref_id})


async def get_unbuilt_count(mongo: "Mongo", ref_id: str) -> int:
    """Return a count of unbuilt history changes associated with a given `ref_id`.

    :param mongo: the application database client
    :param ref_id: the id of the ref to count unbuilt changes for
    :return: the number of unbuilt changes

    """
    return await mongo.history.count_documents(
        {"reference.id": ref_id, "index.id": "unbuilt"},
    )


async def create_clone(
    mongo: "Mongo",
    settings: Settings,
    name: str,
    clone_from: str,
    description: str,
    user_id: str,
) -> Document:
    source = await mongo.references.find_one(clone_from)

    name = name or "Clone of " + source["name"]

    document = await create_document(
        mongo,
        settings,
        name,
        source["organism"],
        description,
        source["data_type"],
        created_at=virtool.utils.timestamp(),
        user_id=user_id,
    )

    document["cloned_from"] = {"id": clone_from, "name": source["name"]}

    return document


async def create_document(
    mongo: "Mongo",
    settings: Settings,
    name: str,
    organism: str | None,
    description: str,
    data_type: str | None,
    created_at: datetime,
    ref_id: str | None = None,
    user_id: str | None = None,
    users=None,
):
    if ref_id and await mongo.references.count_documents({"_id": ref_id}):
        raise DatabaseError("ref_id already exists")

    ref_id = ref_id or await virtool.mongo.utils.get_new_id(mongo.references)

    user = None

    if user_id:
        user = {"id": user_id}

    if not users:
        users = [get_owner_user(user_id, created_at)]

    document = {
        "_id": ref_id,
        "created_at": created_at,
        "data_type": data_type,
        "description": description,
        "name": name,
        "organism": organism,
        "internal_control": None,
        "restrict_source_types": False,
        "source_types": settings.default_source_types,
        "space": {"id": 0},
        "groups": [],
        "users": users,
        "user": user,
    }

    if data_type == "barcode":
        document["targets"] = []

    return document


async def create_import(
    mongo: "Mongo",
    pg: AsyncEngine,
    settings: Settings,
    name: str,
    description: str,
    import_from: str,
    user_id: str,
    data_type: str,
    organism: str,
) -> dict:
    """Import a previously exported Virtool reference.

    :param mongo: the application database client
    :param pg: PostgreSQL database object
    :param settings: the application settings object
    :param name: the name for the new reference
    :param description: a description for the new reference
    :param import_from: the uploaded file to import from
    :param user_id: the id of the creating user
    :param data_type: the data type of the reference
    :param organism: the organism
    :return: a reference document

    """
    created_at = virtool.utils.timestamp()

    document = await create_document(
        mongo,
        settings,
        name or "Unnamed Import",
        organism,
        description,
        data_type,
        created_at=created_at,
        user_id=user_id,
    )

    upload = await get_row(pg, SQLUpload, ("name_on_disk", import_from))

    document["imported_from"] = upload.to_dict()

    return document


async def create_remote(
    mongo: "Mongo",
    settings: Settings,
    name: str,
    release: dict,
    remote_from: str,
    user_id: str,
    data_type: str,
) -> dict:
    """Create a remote reference document in the database.

    :param mongo: the application database object
    :param settings: the application settings
    :param name: the name for the new reference
    :param release: the latest release for the remote reference
    :param remote_from: information about the remote (errors, GitHub slug)
    :param user_id: the id of the requesting user
    :param data_type: the data type of the reference
    :return: the new reference document

    """
    created_at = virtool.utils.timestamp()

    document = await create_document(
        mongo,
        settings,
        "Plant Viruses",
        name or "Unnamed Remote",
        "The official plant virus reference from the Virtool developers",
        data_type,
        created_at=created_at,
        user_id=user_id,
    )

    return {
        **document,
        # Connection information for the GitHub remote repo.
        "remotes_from": {"errors": [], "slug": remote_from},
        # The latest available release on GitHub.
        "release": dict(release, retrieved_at=created_at),
        # The update history for the reference. We put the release being installed as
        # the first history item.
        "updates": [
            virtool.github.create_update_subdocument(
                release,
                False,
                user_id,
                created_at,
            ),
        ],
        "installed": None,
    }


async def insert_change(
    data_path: Path,
    mongo: "Mongo",
    otu_id: str,
    verb: HistoryMethod,
    user_id: str,
    session: AsyncIOMotorClientSession,
    old: Document | None = None,
):
    """Insert a history document for the OTU identified by `otu_id` and the passed
    `verb`.

    :param data_path: system path to the applications datafolder
    :param mongo: the application database object
    :param otu_id: the ID of the OTU the change is for
    :param verb: the change verb (eg. remove, insert)
    :param user_id: the ID of the requesting user
    :param old: the old joined OTU document
    :param session: a Mongo session

    """
    joined = await join(mongo, otu_id, session=session)

    name = joined["name"]

    e = "" if verb.value[-1] == "e" else "e"

    description = f"{verb.value.capitalize()}{e}d {name}"

    if abbreviation := joined.get("abbreviation"):
        description = f"{description} ({abbreviation})"

    await virtool.history.db.add(
        mongo,
        data_path,
        verb,
        old,
        joined,
        description,
        user_id,
        session=session,
    )


async def insert_joined_otu(
    mongo: "Mongo",
    otu: dict,
    created_at: datetime.datetime,
    ref_id: str,
    user_id: str,
    session: AsyncIOMotorClientSession,
) -> str:
    issues = verify(otu)

    document = await mongo.otus.insert_one(
        {
            "abbreviation": otu["abbreviation"],
            "created_at": created_at,
            "imported": True,
            "isolates": [
                {
                    key: isolate[key]
                    for key in ("id", "default", "source_type", "source_name")
                }
                for isolate in otu["isolates"]
            ],
            "issues": issues,
            "lower_name": otu["name"].lower(),
            "last_indexed_version": None,
            "name": otu["name"],
            "reference": {"id": ref_id},
            "remote": {"id": otu["_id"]},
            "schema": otu.get("schema", []),
            "user": {"id": user_id},
            "verified": issues is None,
            "version": 0,
        },
        session=session,
    )

    sequences = []

    for isolate in otu["isolates"]:
        for sequence in isolate.pop("sequences"):
            try:
                remote_sequence_id = sequence["remote"]["id"]
                sequence.pop("_id")
            except KeyError:
                remote_sequence_id = sequence.pop("_id")

            sequences.append(
                {
                    **sequence,
                    "accession": sequence["accession"],
                    "isolate_id": isolate["id"],
                    "otu_id": document["_id"],
                    "segment": sequence.get("segment", ""),
                    "reference": {"id": ref_id},
                    "remote": {"id": remote_sequence_id},
                },
            )

    for sequence in sequences:
        await mongo.sequences.insert_one(sequence, session=session)

    return document["_id"]


async def prepare_update_joined_otu(
    mongo: "Mongo",
    old,
    otu: Document,
    ref_id: str,
) -> OTUUpdate | None:
    if not check_will_change(old, otu):
        return None

    otu_update = UpdateOne(
        {"_id": old["_id"]},
        {
            "$inc": {"version": 1},
            "$set": {
                "abbreviation": otu["abbreviation"],
                "name": otu["name"],
                "lower_name": otu["name"].lower(),
                "isolates": otu["isolates"],
                "schema": otu.get("schema", []),
            },
        },
    )

    sequence_changes = []

    for isolate in otu["isolates"]:
        for sequence in isolate.pop("sequences"):
            sequence_changes.append(
                {
                    "accession": sequence["accession"],
                    "definition": sequence["definition"],
                    "host": sequence["host"],
                    "segment": sequence.get("segment", ""),
                    "sequence": sequence["sequence"],
                    "otu_id": old["_id"],
                    "isolate_id": isolate["id"],
                    "reference": {"id": ref_id},
                    "remote": {"id": sequence["_id"]},
                },
            )

    sequence_inserts = []
    sequence_updates = []
    for sequence_update in sequence_changes:
        remote_sequence_id = sequence_update["remote"]["id"]
        if await mongo.sequences.find_one(
            {"reference.id": ref_id, "remote.id": remote_sequence_id},
        ):
            sequence_updates.append(
                UpdateOne(
                    {"reference.id": ref_id, "remote.id": remote_sequence_id},
                    {"$set": sequence_update},
                ),
            )
        else:
            sequence_inserts.append(sequence_update)

    return OTUUpdate(
        otu_update,
        SequenceChanges(updates=sequence_updates, inserts=sequence_inserts),
        old,
        otu_id=old["_id"],
    )


async def bulk_prepare_update_joined_otu(
    mongo: "Mongo",
    otu_data: list[OTUData],
    ref_id: str,
    session,
) -> list[OTUUpdate]:
    sequence_ids = []
    for otu_item in otu_data:
        for isolate in otu_item.otu["isolates"]:
            sequence_ids.extend([sequence["_id"] for sequence in isolate["sequences"]])

    cursor = mongo.sequences.find(
        {
            "reference.id": ref_id,
            "remote.id": {"$in": sequence_ids},
        },
        session=session,
    )

    found_sequence_ids = {sequence["remote"]["id"] async for sequence in cursor}

    otu_updates = []
    for otu_item in otu_data:
        if not check_will_change(otu_item.old, otu_item.otu):
            continue

        otu_update = UpdateOne(
            {"_id": otu_item.old["_id"]},
            {
                "$inc": {"version": 1},
                "$set": {
                    "abbreviation": otu_item.otu["abbreviation"],
                    "name": otu_item.otu["name"],
                    "lower_name": otu_item.otu["name"].lower(),
                    "isolates": otu_item.otu["isolates"],
                    "schema": otu_item.otu.get("schema", []),
                },
            },
        )

        sequence_updates = []
        sequence_inserts = []

        for isolate in otu_item.otu["isolates"]:
            for sequence in isolate.pop("sequences"):
                sequence_update = {
                    "accession": sequence["accession"],
                    "definition": sequence["definition"],
                    "host": sequence["host"],
                    "segment": sequence.get("segment", ""),
                    "sequence": sequence["sequence"],
                    "otu_id": otu_item.old["_id"],
                    "isolate_id": isolate["id"],
                    "reference": {"id": ref_id},
                    "remote": {"id": sequence["_id"]},
                }

                remote_sequence_id = sequence_update["remote"]["id"]
                if remote_sequence_id in found_sequence_ids:
                    sequence_updates.append(
                        UpdateOne(
                            {"reference.id": ref_id, "remote.id": remote_sequence_id},
                            {"$set": sequence_update},
                        ),
                    )
                else:
                    sequence_inserts.append(sequence_update)

        otu_updates.append(
            OTUUpdate(
                otu_update,
                SequenceChanges(updates=sequence_updates, inserts=sequence_inserts),
                otu_item.old,
                otu_id=otu_item.old["_id"],
            ),
        )

    return otu_updates


def prepare_insert_otu(
    otu: dict,
    created_at: datetime.datetime,
    ref_id: str,
    user_id: str,
) -> OTUInsert:
    issues = verify(otu)

    new_otu = {
        "abbreviation": otu["abbreviation"],
        "created_at": created_at,
        "imported": True,
        "isolates": [
            {
                key: isolate[key]
                for key in ("id", "default", "source_type", "source_name")
            }
            for isolate in otu["isolates"]
        ],
        "issues": issues,
        "lower_name": otu["name"].lower(),
        "last_indexed_version": None,
        "name": otu["name"],
        "reference": {"id": ref_id},
        "remote": {"id": otu["_id"]},
        "schema": otu.get("schema", []),
        "user": {"id": user_id},
        "verified": issues is None,
        "version": 0,
    }

    sequences = []
    for isolate in otu["isolates"]:
        for sequence in isolate.pop("sequences"):
            try:
                remote_sequence_id = sequence["remote"]["id"]
                sequence.pop("_id")
            except KeyError:
                remote_sequence_id = sequence.pop("_id")

            sequences.append(
                {
                    **sequence,
                    "accession": sequence["accession"],
                    "isolate_id": isolate["id"],
                    "otu_id": otu["_id"],
                    "segment": sequence.get("segment", ""),
                    "reference": {"id": ref_id},
                    "remote": {"id": remote_sequence_id},
                },
            )

    return OTUInsert(
        new_otu,
        SequenceChanges(inserts=sequences),
    )


async def prepare_remove_otu(mongo: "Mongo", otu_id: str, session) -> OTUDelete | None:
    """Remove an OTU.

    Create a history document to record the change.

    :param otu_id: the ID of the OTU
    :param user_id: the ID of the requesting user
    :return: `True` if the removal was successful

    """
    joined = await virtool.otus.db.join(mongo, otu_id, session=session)

    if not joined:
        return None

    otu_delete = DeleteOne({"_id": otu_id})
    sequences_delete = DeleteMany({"otu_id": otu_id})

    reference_update = UpdateOne(
        {
            "_id": joined["reference"]["id"],
            "internal_control.id": joined["_id"],
        },
        {"$set": {"internal_control": None}},
    )

    return OTUDelete(
        otu_delete,
        SequenceChanges(deletes=[sequences_delete]),
        joined,
        reference_update,
        otu_id=otu_id,
    )


def lookup_nested_reference_by_id(
    local_field: str = "reference.id",
    set_as: str = "reference",
) -> list[dict]:
    """Create a mongoDB aggregation pipeline step to look up nested reference by id.

    :param local_field: reference field to look up
    :param set_as: desired name of the returned record
    :return: mongoDB aggregation steps for use in an aggregation pipeline
    """
    return [
        {
            "$lookup": {
                "from": "references",
                "let": {"reference_id": f"${local_field}"},
                "pipeline": [
                    {"$match": {"$expr": {"$eq": ["$_id", "$$reference_id"]}}},
                    {"$project": {"_id": True, "name": True, "data_type": True}},
                ],
                "as": set_as,
            },
        },
        {"$set": {set_as: {"$first": f"${set_as}"}}},
    ]
