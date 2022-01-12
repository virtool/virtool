"""
Work with references in the database

Schema:
- _id (str) the instance-unique reference ID
- cloned_from (Object) describes the reference this one was cloned from (can be null)
  - id (str) the ID of the source reference
  - name (str) the name of the source reference at the time of cloning
- created_at (datetime) when the reference was created
- data_type (Enum["genome", "barcode"]) the type of data stored in the reference
- description (str) a user-defined description for the the reference
- groups (List[Object]) describes groups assigned to the reference and their rights
  - id (str) the group ID
  - build (bool) the group can create new builds of the reference
  - modify (bool) the group can modify the non-OTU reference data
  - modify_otu (bool) the group can modify OTUs
  - remove (bool) the group can remove the reference
- groups (List[Object]) describes users assigned to the reference and their rights
  - id (str) the user ID
  - build (bool) the user can create new builds of the reference
  - modify (bool) the user can modify the non-OTU reference data
  - modify_otu (bool) the user can modify OTUs
  - remove (bool) the user can remove the reference
- internal_control (str) the ID for an OTU that is used as an internal control in the lab
- name (str) the reference name
- organism (str) the organism represented in the reference (eg. virus, bacteria, fungus)
- task (Object) a task associated with a current reference operation
  - id (str) the task ID
- release (Object) describes the latest remote reference release
  - body (str) the Markdown-formatted release body from GitHub
  - content_type (str) release content type - should always be application/gzip
  - download_url (str) the GitHUB URL at which the reference release can be downloaded
  - etag (str) the release ETag - allows caching of the release check result
  - filename (str) the name of the release file
  - html_url (str) the URL to the web page for the release on GitHub
  - id (str) the unique ID for the release from GitHub
  - name (str) the name of the release (eg. v1.4.0)
  - newer (bool) true if there is a newer release available
  - published_at (datetime) when the release was published on GitHub
  - retrieved_at (datetime) when teh release was retrieved from GitHub
  - size (int) size of the release file in bytes
- remotes_from (Object) describes where the reference remotes from (can be null)
  - errors (Array) errors related to the remote reference
  - slug (str) the GitHub repository slug for the reference
- restrict_source_types (bool) restricts the source types users may use when creating isolates
- source_types (Array[str]) a set of allowable source types
- updates (Array[Object]) a history of updates applied to the remote reference
  - SHARES FIELDS WITH release
  - user (Object) describes the user that applied the update
    - id (str) the user ID
- updating (bool) the remote reference is being updated
- user (Object) describes the creating user
  - id (str) the user ID


"""
import asyncio
import datetime
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import pymongo
import virtool.db.utils
import virtool.errors
import virtool.github
import virtool.history.db
import virtool.tasks.pg
import virtool.utils
from aiohttp import ClientConnectorError
from aiohttp.web import Request
from semver import VersionInfo
from sqlalchemy.ext.asyncio.engine import AsyncEngine
from virtool.http.utils import download_file
from virtool.otus.db import join
from virtool.otus.utils import verify
from virtool.pg.utils import get_row
from virtool.references.utils import (
    RIGHTS,
    check_will_change,
    clean_export_list,
    get_owner_user,
    load_reference_file,
)
from virtool.settings.db import Settings
from virtool.types import App
from virtool.uploads.models import Upload
from virtool.users.db import attach_user, extend_user

PROJECTION = [
    "_id",
    "remotes_from",
    "cloned_from",
    "created_at",
    "data_type",
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
    "groups",
]


async def processor(db, document: dict) -> dict:
    """
    Process a reference document to a form that can be dispatched or returned in a list.

    Used `attach_computed` for complete representations of the reference.

    :param db: the application database client
    :param document: the document to process
    :return: the processed document

    """
    try:
        ref_id = document.pop("_id")
    except KeyError:
        ref_id = document["id"]

    latest_build, otu_count, unbuilt_count = await asyncio.gather(
        get_latest_build(db, ref_id),
        get_otu_count(db, ref_id),
        get_unbuilt_count(db, ref_id),
    )

    document.update(
        {
            "latest_build": latest_build,
            "otu_count": otu_count,
            "unbuilt_change_count": unbuilt_count,
        }
    )

    try:
        document["installed"] = document.pop("updates")[-1]
    except (KeyError, IndexError):
        pass

    document["id"] = ref_id

    return await attach_user(db, document)


async def attach_computed(db, document: dict) -> dict:
    """
    Get all computed data for the specified reference and attach it to the passed `document`.

    :param db: the application database client
    :param document: the document to attached computed data to
    :return: the updated document

    """
    ref_id = document["_id"]

    try:
        internal_control_id = document["internal_control"]["id"]
    except (KeyError, TypeError):
        internal_control_id = None

    (
        contributors,
        internal_control,
        latest_build,
        otu_count,
        users,
        unbuilt_count,
    ) = await asyncio.gather(
        get_contributors(db, ref_id),
        get_internal_control(db, internal_control_id, ref_id),
        get_latest_build(db, ref_id),
        get_otu_count(db, ref_id),
        get_reference_users(db, document),
        get_unbuilt_count(db, ref_id),
    )

    processed = virtool.utils.base_processor(
        {
            **document,
            "contributors": contributors,
            "internal_control": internal_control or None,
            "latest_build": latest_build,
            "otu_count": otu_count,
            "unbuilt_change_count": unbuilt_count,
            "users": users,
        }
    )

    return await attach_user(db, processed)


async def get_reference_users(db, document: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Get a detailed list of users that have access to the specified reference.

    :param db: the application database client
    :param document: the reference document
    :return: a list of user data dictionaries

    """
    if not document.get("users"):
        return []

    return await asyncio.gather(*[extend_user(db, user) for user in document["users"]])


async def add_group_or_user(db, ref_id: str, field: str, data: dict) -> Optional[dict]:
    document = await db.references.find_one({"_id": ref_id}, [field])

    if not document:
        return None

    subdocument_id = data.get("group_id") or data["user_id"]

    if (
        field == "groups"
        and await db.groups.count_documents({"_id": subdocument_id}) == 0
    ):
        raise virtool.errors.DatabaseError("group does not exist")

    if (
        field == "users"
        and await db.users.count_documents({"_id": subdocument_id}) == 0
    ):
        raise virtool.errors.DatabaseError("user does not exist")

    if subdocument_id in [s["id"] for s in document[field]]:
        raise virtool.errors.DatabaseError(field[:-1] + " already exists")

    rights = {key: data.get(key, False) for key in RIGHTS}

    subdocument = {
        "id": subdocument_id,
        "created_at": virtool.utils.timestamp(),
        **rights,
    }

    await db.references.update_one({"_id": ref_id}, {"$push": {field: subdocument}})

    return subdocument


async def check_right(req: Request, reference: dict, right: str) -> bool:
    if req["client"].administrator:
        return True

    user_id = req["client"].user_id

    try:
        groups = reference["groups"]
        users = reference["users"]
    except (KeyError, TypeError):
        reference = await req.app["db"].references.find_one(
            reference, ["groups", "users"]
        )
        groups = reference["groups"]
        users = reference["users"]

    for user in users:
        if user["id"] == user_id:
            if user[right]:
                return True

            break

    for group in groups:
        if group[right] and group["id"] in req["client"].groups:
            return True

    return False


async def check_source_type(db, ref_id: str, source_type: str) -> bool:
    """
    Check if the provided `source_type` is valid based on the current reference source type configuration.

    :param db: the application database client
    :param ref_id: the reference context
    :param source_type: the source type to check
    :return: source type is valid

    """
    document = await db.references.find_one(
        ref_id, ["restrict_source_types", "source_types"]
    )

    restrict_source_types = document.get("restrict_source_types", False)
    source_types = document.get("source_types", list())

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


def compose_base_find_query(user_id: str, administrator: bool, groups: list) -> dict:
    """
    Compose a query for filtering reference search results based on user read rights.

    :param user_id: the id of the user requesting the search
    :param administrator: the administrator flag of the user requesting the search
    :param groups: the id group membership of the user requesting the search
    :return: a valid MongoDB query

    """
    if administrator:
        return dict()

    is_user_member = {"users.id": user_id}

    is_group_member = {"groups.id": {"$in": groups}}

    is_owner = {"user.id": user_id}

    return {"$or": [is_group_member, is_user_member, is_owner]}


async def delete_group_or_user(
    db, ref_id: str, subdocument_id: str, field: str
) -> Optional[str]:
    """
    Delete an existing group or user as decided by the `field` argument.

    :param db: the application database client
    :param ref_id: the id of the reference to modify
    :param subdocument_id: the id of the group or user to delete
    :param field: the field to modify: 'group' or 'user'
    :return: the id of the removed subdocument

    """
    document = await db.references.find_one(
        {"_id": ref_id, field + ".id": subdocument_id}, [field]
    )

    if document is None:
        return None

    # Retain only the subdocuments that don't match the passed `subdocument_id`.
    filtered = [s for s in document[field] if s["id"] != subdocument_id]

    await db.references.update_one({"_id": ref_id}, {"$set": {field: filtered}})

    return subdocument_id


async def edit_group_or_user(
    db, ref_id: str, subdocument_id: str, field: str, data: dict
) -> Optional[dict]:
    """
    Edit an existing group or user as decided by the `field` argument. Returns `None` if the reference, group, or user
    does not exist.

    :param db: the application database client
    :param ref_id: the id of the reference to modify
    :param subdocument_id: the id of the group or user to modify
    :param field: the field to modify: 'group' or 'user'
    :param data: the data to update the group or user with
    :return: the modified subdocument

    """
    document = await db.references.find_one(
        {"_id": ref_id, field + ".id": subdocument_id}, [field]
    )

    if document is None:
        return None

    for subdocument in document[field]:
        if subdocument["id"] == subdocument_id:
            rights = {key: data.get(key, subdocument[key]) for key in RIGHTS}
            subdocument.update(rights)

            await db.references.update_one(
                {"_id": ref_id}, {"$set": {field: document[field]}}
            )

            return subdocument


async def fetch_and_update_release(
    app, ref_id: str, ignore_errors: bool = False
) -> dict:
    """
    Get the latest release for the GitHub repository identified by the passed `slug`. If a release is found, update the
    reference identified by the passed `ref_id` and return the release.

    Exceptions can be ignored during the GitHub request. Error information will still be written to the reference
    document.

    :param app: the application object
    :param ref_id: the id of the reference to update
    :param ignore_errors: ignore exceptions raised during GitHub request
    :return: the latest release

    """
    db = app["db"]

    retrieved_at = virtool.utils.timestamp()

    document = await db.references.find_one(
        ref_id, ["installed", "release", "remotes_from"]
    )

    release = document.get("release")
    etag = virtool.github.get_etag(release)

    # Variables that will be used when trying to fetch release from GitHub.
    errors = list()
    updated = None

    try:
        updated = await virtool.github.get_release(
            app["config"], app["client"], document["remotes_from"]["slug"], etag
        )

        if updated:
            updated = virtool.github.format_release(updated)

    except (ClientConnectorError, virtool.errors.GitHubError) as err:
        if "ClientConnectorError" in str(err):
            errors = ["Could not reach GitHub"]

        if "404" in str(err):
            errors = ["GitHub repository or release does not exist"]

        if errors and not ignore_errors:
            raise

    if updated:
        release = updated

    if release:
        installed = document["installed"]

        release["newer"] = bool(
            installed
            and VersionInfo.parse(release["name"].lstrip("v"))
            > VersionInfo.parse(installed["name"].lstrip("v"))
        )

        release["retrieved_at"] = retrieved_at

    await db.references.update_one(
        {"_id": ref_id}, {"$set": {"errors": errors, "release": release}}
    )

    return release


async def get_contributors(db, ref_id: str) -> Optional[List[dict]]:
    """
    Return an list of contributors and their contribution count for a specific ref.

    :param db: the application database client
    :param ref_id: the id of the ref to get contributors for
    :return: a list of contributors to the ref

    """
    return await virtool.history.db.get_contributors(db, {"reference.id": ref_id})


async def get_internal_control(
    db, internal_control_id: Optional[str], ref_id: str
) -> Optional[dict]:
    """
    Return a minimal dict describing the ref internal control given a `otu_id`.

    :param db: the application database client
    :param internal_control_id: the id of the otu to create a minimal dict for
    :param ref_id: the id of the reference to look for the control OTU in
    :return: a minimal dict describing the ref internal control

    """
    if internal_control_id is None:
        return None

    name = await virtool.db.utils.get_one_field(
        db.otus, "name", {"_id": internal_control_id, "reference.id": ref_id}
    )

    if name is None:
        return None

    return {"id": internal_control_id, "name": name}


async def get_latest_build(db, ref_id: str) -> Optional[dict]:
    """
    Return the latest index build for the ref.

    :param db: the application database client
    :param ref_id: the id of the ref to get the latest build for
    :return: a subset of fields for the latest build

    """
    latest_build = await db.indexes.find_one(
        {"reference.id": ref_id, "ready": True},
        projection=["created_at", "version", "user", "has_json"],
        sort=[("version", pymongo.DESCENDING)],
    )

    if latest_build is None:
        return None

    return virtool.utils.base_processor(await attach_user(db, latest_build))


async def get_official_installed(db) -> bool:
    """
    Return a boolean indicating whether the official plant virus reference is installed.

    :param db:
    :return: official reference install status
    """
    return (
        await db.references.count_documents(
            {"remotes_from.slug": "virtool/ref-plant-viruses"}
        )
        > 0
    )


async def get_manifest(db, ref_id: str) -> dict:
    """
    Generate a dict of otu document version numbers keyed by the document id. This is used to make sure only changes
    made at the time the index rebuild was started are included in the build.

    :param db: the application database client
    :param ref_id: the id of the reference to get the current index for
    :return: a manifest of otu ids and versions

    """
    manifest = dict()

    async for document in db.otus.find({"reference.id": ref_id}, ["version"]):
        manifest[document["_id"]] = document["version"]

    return manifest


async def get_otu_count(db, ref_id: str) -> int:
    """
    Get the number of OTUs associated with the given `ref_id`.

    :param db: the application database client
    :param ref_id: the id of the reference to get the current index for
    :return: the OTU count

    """
    return await db.otus.count_documents({"reference.id": ref_id})


async def get_unbuilt_count(db, ref_id: str) -> int:
    """
    Return a count of unbuilt history changes associated with a given `ref_id`.

    :param db: the application database client
    :param ref_id: the id of the ref to count unbuilt changes for
    :return: the number of unbuilt changes

    """
    return await db.history.count_documents(
        {"reference.id": ref_id, "index.id": "unbuilt"}
    )


async def create_clone(
    db, settings: Settings, name: str, clone_from: str, description: str, user_id: str
) -> dict:
    source = await db.references.find_one(clone_from)

    name = name or "Clone of " + source["name"]

    document = await create_document(
        db,
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
    db,
    settings: Settings,
    name: str,
    organism: Optional[str],
    description: str,
    data_type: Optional[str],
    created_at=None,
    ref_id: Optional[str] = None,
    user_id: Optional[str] = None,
    users=None,
):
    if ref_id and await db.references.count_documents({"_id": ref_id}):
        raise virtool.errors.DatabaseError("ref_id already exists")

    ref_id = ref_id or await virtool.db.utils.get_new_id(db.otus)

    user = None

    if user_id:
        user = {"id": user_id}

    if not users:
        users = [get_owner_user(user_id)]

    document = {
        "_id": ref_id,
        "created_at": created_at or virtool.utils.timestamp(),
        "data_type": data_type,
        "description": description,
        "name": name,
        "organism": organism,
        "internal_control": None,
        "restrict_source_types": False,
        "source_types": settings.default_source_types,
        "groups": list(),
        "users": users,
        "user": user,
    }

    if data_type == "barcode":
        document["targets"] = list()

    return document


async def create_import(
    db,
    pg: AsyncEngine,
    settings: Settings,
    name: str,
    description: str,
    import_from: str,
    user_id: str,
) -> dict:
    """
    Import a previously exported Virtool reference.

    :param db: the application database client
    :param pg: PostgreSQL database object
    :param settings: the application settings object
    :param name: the name for the new reference
    :param description: a description for the new reference
    :param import_from: the uploaded file to import from
    :param user_id: the id of the creating user
    :return: a reference document

    """
    created_at = virtool.utils.timestamp()

    document = await create_document(
        pg,
        settings,
        name or "Unnamed Import",
        None,
        description,
        None,
        created_at=created_at,
        user_id=user_id,
    )

    upload = await get_row(pg, Upload, ("name_on_disk", import_from))

    document["imported_from"] = upload.to_dict()

    return document


async def create_remote(
    db, settings: Settings, release: dict, remote_from: str, user_id: str
) -> dict:
    """
    Create a remote reference document in the database.

    :param db: the application database object
    :param settings: the application settings
    :param release: the latest release for the remote reference
    :param remote_from: information about the remote (errors, GitHub slug)
    :param user_id: the id of the requesting user
    :return: the new reference document

    """
    created_at = virtool.utils.timestamp()

    document = await create_document(
        db,
        settings,
        "Plant Viruses",
        None,
        "The official plant virus reference from the Virtool developers",
        None,
        created_at=created_at,
        user_id=user_id,
    )

    return {
        **document,
        # Connection information for the GitHub remote repo.
        "remotes_from": {"errors": [], "slug": remote_from},
        # The latest available release on GitHub.
        "release": dict(release, retrieved_at=created_at),
        # The update history for the reference. We put the release being installed as the first history item.
        "updates": [
            virtool.github.create_update_subdocument(
                release, False, user_id, created_at
            )
        ],
        "installed": None,
    }


async def download_and_parse_release(
    app, url: str, task_id: int, progress_handler: callable
):
    pg = app["pg"]

    with virtool.utils.get_temp_dir() as tempdir:
        download_path = Path(tempdir) / "reference.tar.gz"

        await download_file(app, url, download_path, progress_handler)

        await virtool.tasks.pg.update(pg, task_id, step="unpack")

        return await app["run_in_thread"](load_reference_file, download_path)


async def edit(db, ref_id: str, data: dict) -> dict:
    """
    Edit and existing reference using the passed update `data`.

    :param db: the application database object
    :param ref_id: the id of the reference to update
    :param data: update data from the HTTP request
    :return: the updated reference document

    """
    document = await db.references.find_one(ref_id)

    if document["data_type"] != "barcode":
        data.pop("targets", None)

    document = await db.references.find_one_and_update({"_id": ref_id}, {"$set": data})

    document = await attach_computed(db, document)

    if "name" in data:
        await db.analyses.update_many(
            {"reference.id": ref_id}, {"$set": {"reference.name": document["name"]}}
        )

    return document


async def export(app: App, ref_id: str) -> list:
    db = app["db"]

    otu_list = list()

    query = {"reference.id": ref_id, "last_indexed_version": {"$ne": None}}

    async for document in db.otus.find(query):
        _, joined, _ = await virtool.history.db.patch_to_version(
            app, document["_id"], document["last_indexed_version"]
        )

        otu_list.append(joined)

    return clean_export_list(otu_list)


async def insert_change(
    app, otu_id: str, verb: str, user_id: str, old: Optional[dict] = None
):
    """
    Insert a history document for the OTU identified by `otu_id` and the passed `verb`.

    :param app: the application object
    :param otu_id: the ID of the OTU the change is for
    :param verb: the change verb (eg. remove, insert)
    :param user_id: the ID of the requesting user
    :param old: the old joined OTU document

    """
    db = app["db"]

    # Join the otu document into a complete otu record. This will be used for recording history.
    joined = await join(db, otu_id)

    name = joined["name"]

    e = "" if verb[-1] == "e" else "e"

    # Build a ``description`` field for the otu creation change document.
    description = f"{verb.capitalize()}{e}d {name}"

    abbreviation = joined.get("abbreviation")

    # Add the abbreviation to the description if there is one.
    if abbreviation:
        description = f"{description} ({abbreviation})"

    await virtool.history.db.add(
        app, verb, old, joined, description, user_id, silent=True
    )


async def insert_joined_otu(
    db,
    otu: dict,
    created_at: datetime.datetime,
    ref_id: str,
    user_id: str,
    remote: bool = False,
) -> str:
    all_sequences = list()

    issues = verify(otu)

    otu.update(
        {
            "created_at": created_at,
            "lower_name": otu["name"].lower(),
            "last_indexed_version": None,
            "issues": issues,
            "verified": issues is None,
            "imported": True,
            "version": 0,
            "reference": {"id": ref_id},
            "user": {"id": user_id},
        }
    )

    if "schema" not in otu:
        otu["schema"] = list()

    remote_id = otu.pop("_id")

    if remote:
        otu["remote"] = {"id": remote_id}

    for isolate in otu["isolates"]:
        for sequence in isolate.pop("sequences"):
            try:
                remote_sequence_id = sequence["remote"]["id"]
                sequence.pop("_id")
            except KeyError:
                remote_sequence_id = sequence.pop("_id")

            all_sequences.append(
                {
                    **sequence,
                    "accession": sequence["accession"],
                    "isolate_id": isolate["id"],
                    "segment": sequence.get("segment", ""),
                    "reference": {"id": ref_id},
                    "remote": {"id": remote_sequence_id},
                }
            )

    document = await db.otus.insert_one(otu, silent=True)

    for sequence in all_sequences:
        await db.sequences.insert_one(
            dict(sequence, otu_id=document["_id"]), silent=True
        )

    return document["_id"]


async def refresh_remotes(app: App):
    db = app["db"]

    try:
        logging.debug("Started reference refresher")

        while True:
            for ref_id in await db.references.distinct(
                "_id", {"remotes_from": {"$exists": True}}
            ):
                await fetch_and_update_release(app, ref_id, ignore_errors=True)

            await asyncio.sleep(600)
    except asyncio.CancelledError:
        pass

    logging.debug("Stopped reference refresher")


async def update(
    req: Request,
    created_at: datetime.datetime,
    task_id: int,
    ref_id: str,
    release: dict,
    user_id: str,
) -> tuple:
    db = req.app["db"]

    update_subdocument = virtool.github.create_update_subdocument(
        release, False, user_id, created_at
    )

    await db.references.update_one(
        {"_id": ref_id},
        {
            "$push": {"updates": update_subdocument},
            "$set": {"task": {"id": task_id}, "updating": True},
        },
    )

    return release, update_subdocument


async def update_joined_otu(
    db, otu: dict, created_at: datetime.datetime, ref_id: str, user_id: str
) -> Union[dict, str, None]:
    remote_id = otu["_id"]

    old = await join(db, {"reference.id": ref_id, "remote.id": remote_id})

    if old:
        if not check_will_change(old, otu):
            return None

        sequence_updates = list()

        for isolate in otu["isolates"]:
            for sequence in isolate.pop("sequences"):
                sequence_updates.append(
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
                    }
                )

        await db.otus.update_one(
            {"_id": old["_id"]},
            {
                "$inc": {"version": 1},
                "$set": {
                    "abbreviation": otu["abbreviation"],
                    "name": otu["name"],
                    "lower_name": otu["name"].lower(),
                    "isolates": otu["isolates"],
                    "schema": otu.get("schema", list()),
                },
            },
        )

        for sequence_update in sequence_updates:
            remote_sequence_id = sequence_update["remote"]["id"]

            update_result = await db.sequences.update_one(
                {"reference.id": ref_id, "remote.id": remote_sequence_id},
                {"$set": sequence_update},
            )

            if not update_result.matched_count:
                await db.sequences.insert_one(sequence_update)

        return old

    return await insert_joined_otu(db, otu, created_at, ref_id, user_id, remote=True)
