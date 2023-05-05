"""
Work with references in the database

"""
import asyncio
from asyncio import to_thread
import datetime
import logging
from pathlib import Path
from typing import (
    Dict,
    List,
    Optional,
    Union,
    TYPE_CHECKING,
)
import aiohttp

import pymongo
from aiohttp import ClientConnectorError
from aiohttp.web import Request
from motor.motor_asyncio import AsyncIOMotorClientSession
from pymongo import UpdateOne, DeleteMany, DeleteOne
from semver import VersionInfo
from sqlalchemy.ext.asyncio.engine import AsyncEngine
from virtool_core.models.enums import HistoryMethod
from virtool_core.models.settings import Settings

import virtool.github
import virtool.history.db
import virtool.mongo.utils
import virtool.utils
from virtool.data.utils import get_data_from_app
from virtool.errors import DatabaseError
from virtool.http.utils import download_file
from virtool.mongo.transforms import apply_transforms
from virtool.otus.db import join
from virtool.otus.utils import verify
from virtool.pg.utils import get_row
from virtool.references.bulk_models import (
    OTUUpdate,
    SequenceChanges,
    OTUData,
    OTUInsert,
    OTUDelete,
)

from virtool.references.utils import (
    RIGHTS,
    check_will_change,
    get_owner_user,
    load_reference_file,
)
from virtool.types import Document
from virtool.uploads.models import Upload as SQLUpload
from virtool.users.db import AttachUserTransform, extend_user

if TYPE_CHECKING:
    from virtool.mongo.core import Mongo

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


async def processor(mongo: "Mongo", document: Document) -> Document:
    """
    Process a reference document to a form that can be dispatched or returned in a list.

    Used `attach_computed` for complete representations of the reference.

    :param mongo: the application database client
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
        }
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


async def attach_computed(mongo: "Mongo", document: Document) -> Document:
    """
    Get all computed data for the specified reference and attach it to the passed
    ``document``.

    :param mongo: the application database client
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
        get_contributors(mongo, ref_id),
        get_internal_control(mongo, internal_control_id, ref_id),
        get_latest_build(mongo, ref_id),
        get_otu_count(mongo, ref_id),
        get_reference_users(mongo, document),
        get_unbuilt_count(mongo, ref_id),
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

    return await apply_transforms(processed, [AttachUserTransform(mongo)])


async def get_reference_users(mongo: "Mongo", document: Document) -> List[Document]:
    """
    Get a detailed list of users that have access to the specified reference.

    :param mongo: the application database client
    :param document: the reference document
    :return: a list of user data dictionaries

    """
    if not document.get("users"):
        return []

    return await asyncio.gather(
        *[extend_user(mongo, user) for user in document["users"]]
    )


async def add_group_or_user(
    mongo, ref_id: str, field: str, data: dict
) -> Optional[dict]:
    document = await mongo.references.find_one({"_id": ref_id}, [field])

    if not document:
        return None

    subdocument_id = data.get("group_id") or data["user_id"]

    if field == "groups" and not await mongo.groups.count_documents(
        {"_id": subdocument_id}, limit=1
    ):
        raise DatabaseError("group does not exist")

    if field == "users" and not await mongo.users.count_documents(
        {"_id": subdocument_id}, limit=1
    ):
        raise DatabaseError("user does not exist")

    if subdocument_id in [s["id"] for s in document[field]]:
        raise DatabaseError(field[:-1] + " already exists")

    rights = {key: data.get(key, False) for key in RIGHTS}

    subdocument = {
        "id": subdocument_id,
        "created_at": virtool.utils.timestamp(),
        **rights,
    }

    await mongo.references.update_one({"_id": ref_id}, {"$push": {field: subdocument}})

    return subdocument


async def check_right(req: Request, reference: Union[Dict, str], right: str) -> bool:
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


async def check_source_type(mongo: "Mongo", ref_id: str, source_type: str) -> bool:
    """
    Check if the provided `source_type` is valid based on the current reference source
    type configuration.

    :param mongo: the application database client
    :param ref_id: the reference context
    :param source_type: the source type to check
    :return: source type is valid

    """
    document = await mongo.references.find_one(
        ref_id, ["restrict_source_types", "source_types"]
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


def compose_base_find_query(user_id: str, administrator: bool, groups: list) -> Dict:
    """
    Compose a query for filtering reference search results based on user read rights.

    :param user_id: the id of the user requesting the search
    :param administrator: the administrator flag of the user requesting the search
    :param groups: the id group membership of the user requesting the search
    :return: a valid MongoDB query

    """
    if administrator:
        return {}

    is_user_member = {"users.id": user_id}

    is_group_member = {"groups.id": {"$in": groups}}

    is_owner = {"user.id": user_id}

    return {"$or": [is_group_member, is_user_member, is_owner]}


async def delete_group_or_user(
    mongo: "Mongo", ref_id: str, subdocument_id: str, field: str
) -> Optional[str]:
    """
    Delete an existing group or user as decided by the `field` argument.

    :param mongo: the application database client
    :param ref_id: the id of the reference to modify
    :param subdocument_id: the id of the group or user to delete
    :param field: the field to modify: 'group' or 'user'
    :return: the id of the removed subdocument

    """
    document = await mongo.references.find_one(
        {"_id": ref_id, field + ".id": subdocument_id}, [field]
    )

    if document is None:
        return None

    # Retain only the subdocuments that don't match the passed `subdocument_id`.
    filtered = [s for s in document[field] if s["id"] != subdocument_id]

    await mongo.references.update_one({"_id": ref_id}, {"$set": {field: filtered}})

    return subdocument_id


async def edit_group_or_user(
    mongo: "Mongo", ref_id: str, subdocument_id: str, field: str, data: Document
) -> Optional[Document]:
    """
    Edit an existing group or user as decided by the `field` argument.

    Returns `None` if the reference, group, or user does not exist.

    :param mongo: the application database client
    :param ref_id: the id of the reference to modify
    :param subdocument_id: the id of the group or user to modify
    :param field: the field to modify: 'group' or 'user'
    :param data: the data to update the group or user with
    :return: the modified subdocument

    """
    document = await mongo.references.find_one(
        {"_id": ref_id, field + ".id": subdocument_id}, [field]
    )

    if document is None:
        return None

    for subdocument in document[field]:
        if subdocument["id"] == subdocument_id:
            rights = {key: data.get(key, subdocument[key]) for key in RIGHTS}
            subdocument.update(rights)

            await mongo.references.update_one(
                {"_id": ref_id}, {"$set": {field: document[field]}}
            )

            return subdocument


class GetReleaseError(Exception):
    pass


async def get_releases_from_virtool(
    session: aiohttp.ClientSession,
    slug: str,
    etag: Optional[str] = None,
    release_id: Optional[str] = "latest",
) -> Optional[dict]:
    """
    GET data from Virtool.ca.

    :param config: the application config object
    :param session: the application HTTP client session
    :param slug: the slug for the GitHub repo
    :param etag: an ETag for the resource to be used with the `If-None-Match` header
    :param release_id: the id of the Virtool release to get

    :return: the latest release
    """

    # future repos will be added; currently it is only virtool/virtool
    url = "https://www.virtool.ca/releases"

    headers = {"Accept": "application/vnd.github.v3+json"}
    
    if etag:
        headers["If-None-Match"] = etag

        logger = logging.getLogger(__name__)

        logger.debug("Making request to %s", url)

        async with session.get(
            url,
            headers=headers
        ) as resp:
            logger.debug("Fetched release: %s/%s (%s)", slug, release_id, resp.status)

            if resp.status == 200:
                data = await resp.json(content_type=None)

                if len(data["ref_plant_viruses"]) == 0:
                    return None
                
                else:
                    return dict(data, etag=resp.headers["etag"])

            elif resp.status == 304:
                return None

            else:
                warning = f"Encountered error {resp.status} {await resp.json()}"
                logger.warning(warning)
                raise GetReleaseError


def format_latest_release(releases: dict) -> dict:
    """
    Format a raw release record from Virtool.ca into a release usable by Virtool.

    :param release: the Virtool.ca release record
    :return: a release for use within Virtool

    """
    latest_release = releases["ref_plant_viruses"][0]

    return {
        "name": latest_release["name"],
        "body": latest_release["body"],
        "etag": releases["etag"],
        "filename": latest_release["name"],
        "size": latest_release["size"],
        "html_url": latest_release["html_url"],
        "download_url": latest_release["download_url"],
        "published_at": latest_release["published_at"],
        "content_type": latest_release["content_type"],
    }


async def fetch_and_update_release(
    mongo: "Mongo", client, ref_id: str, ignore_errors: bool = False
) -> dict:
    """
    Get the latest release for the GitHub repository identified by the passed `slug`.

    If a release is found, update the reference identified by the passed `ref_id` and
    return the release.

    Exceptions can be ignored during the GitHub request. Error information will still
    be written to the reference document.

    :param mongo: the application database client
    :param client: the application client
    :param ref_id: the id of the reference to update
    :param ignore_errors: ignore exceptions raised during the request
    :return: the latest release

    """

    retrieved_at = virtool.utils.timestamp()

    document = await mongo.references.find_one(
        ref_id, ["installed", "release", "remotes_from"]
    )

    release = document.get("release")

    # change below here

    etag = release.get("etag", None)

    # Variables that will be used when trying to fetch release from GitHub.
    errors = []
    updated = None

    try:
        # get updated version from url directly

        updated = await get_releases_from_virtool(
            client, document["remotes_from"]["slug"], etag
        )

        # ditto

        if updated:
            updated = format_latest_release(updated)

    # remove references to github in error exception handling

    except (ClientConnectorError, GetReleaseError) as err:
        if "ClientConnectorError" in str(err):
            errors = ["Could not reach Virtool.ca"]

        if "404" in str(err):
            errors = ["Release does not exist"]

        if errors and not ignore_errors:
            raise

    # change above here

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

    await mongo.references.update_one(
        {"_id": ref_id}, {"$set": {"errors": errors, "release": release}}
    )

    return release


async def get_contributors(mongo: "Mongo", ref_id: str) -> Optional[List[Document]]:
    """
    Return an list of contributors and their contribution count for a specific ref.

    :param mongo: the application database client
    :param ref_id: the id of the ref to get contributors for
    :return: a list of contributors to the ref

    """
    return await virtool.history.db.get_contributors(mongo, {"reference.id": ref_id})


async def get_internal_control(
    mongo: "Mongo", internal_control_id: Optional[str], ref_id: str
) -> Optional[Document]:
    """
    Return a minimal dict describing the ref internal control given a `otu_id`.

    :param mongo: the application database client
    :param internal_control_id: the id of the otu to create a minimal dict for
    :param ref_id: the id of the reference to look for the control OTU in
    :return: a minimal dict describing the ref internal control

    """
    if internal_control_id is None:
        return None

    name = await virtool.mongo.utils.get_one_field(
        mongo.otus, "name", {"_id": internal_control_id, "reference.id": ref_id}
    )

    if name is None:
        return None

    return {"id": internal_control_id, "name": name}


async def get_latest_build(mongo: "Mongo", ref_id: str) -> Optional[Document]:
    """
    Return the latest index build for the ref.

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
            virtool.utils.base_processor(latest_build), [AttachUserTransform(mongo)]
        )


async def get_official_installed(mongo: "Mongo") -> bool:
    """
    Return a boolean indicating whether the official plant virus reference is installed.

    :param mongo:
    :return: official reference install status
    """
    return (
        await mongo.references.count_documents(
            {"remotes_from.slug": "virtool/ref-plant-viruses"}
        )
        > 0
    )


async def get_manifest(mongo: "Mongo", ref_id: str) -> Document:
    """
    Generate a dict of otu document version numbers keyed by the document id.

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
    """
    Get the number of OTUs associated with the given `ref_id`.

    :param mongo: the application database client
    :param ref_id: the id of the reference to get the current index for
    :return: the OTU count

    """
    return await mongo.otus.count_documents({"reference.id": ref_id})


async def get_unbuilt_count(mongo: "Mongo", ref_id: str) -> int:
    """
    Return a count of unbuilt history changes associated with a given `ref_id`.

    :param mongo: the application database client
    :param ref_id: the id of the ref to count unbuilt changes for
    :return: the number of unbuilt changes

    """
    return await mongo.history.count_documents(
        {"reference.id": ref_id, "index.id": "unbuilt"}
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
    organism: Optional[str],
    description: str,
    data_type: Optional[str],
    created_at: datetime,
    ref_id: Optional[str] = None,
    user_id: Optional[str] = None,
    users=None,
):
    if ref_id and await mongo.references.count_documents({"_id": ref_id}):
        raise virtool.errors.DatabaseError("ref_id already exists")

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
    """
    Import a previously exported Virtool reference.

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
    mongo,
    settings: Settings,
    name: str,
    release: dict,
    remote_from: str,
    user_id: str,
    data_type: str,
) -> dict:
    """
    Create a remote reference document in the database.

    :param mongo: the application database object
    :param settings: the application settings
    :param release: the latest release for the remote reference
    :param remote_from: information about the remote (errors, GitHub slug)
    :param user_id: the id of the requesting user
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
                release, False, user_id, created_at
            )
        ],
        "installed": None,
    }


async def download_and_parse_release(
    app, url: str, task_id: int, progress_handler: callable
):
    with virtool.utils.get_temp_dir() as tempdir:
        download_path = Path(tempdir) / "reference.tar.gz"

        await download_file(url, download_path, progress_handler)

        await get_data_from_app(app).tasks.update(task_id, step="unpack")

        return await to_thread(load_reference_file, download_path)


async def insert_change(
    data_path: Path,
    mongo: "Mongo",
    otu_id: str,
    verb: HistoryMethod,
    user_id: str,
    session: AsyncIOMotorClientSession,
    old: Optional[dict] = None,
):
    """
    Insert a history document for the OTU identified by `otu_id` and the passed `verb`.

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
        silent=True,
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
        silent=True,
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
                }
            )

    for sequence in sequences:
        await mongo.sequences.insert_one(sequence, session=session, silent=True)

    return document["_id"]


async def update(
    req: Request,
    created_at: datetime.datetime,
    task_id: int,
    ref_id: str,
    release: dict,
    user_id: str,
) -> tuple:
    mongo = req.app["db"]

    update_subdocument = virtool.github.create_update_subdocument(
        release, False, user_id, created_at
    )

    await mongo.references.update_one(
        {"_id": ref_id},
        {
            "$push": {"updates": update_subdocument},
            "$set": {"task": {"id": task_id}, "updating": True},
        },
    )

    return release, update_subdocument


async def prepare_update_joined_otu(
    mongo: "Mongo", old, otu: Document, ref_id: str
) -> Optional[OTUUpdate]:
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
                }
            )

    sequence_inserts = []
    sequence_updates = []
    for sequence_update in sequence_changes:
        remote_sequence_id = sequence_update["remote"]["id"]
        if await mongo.sequences.find_one(
            {"reference.id": ref_id, "remote.id": remote_sequence_id}
        ):
            sequence_updates.append(
                UpdateOne(
                    {"reference.id": ref_id, "remote.id": remote_sequence_id},
                    {"$set": sequence_update},
                )
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
    mongo: "Mongo", otu_data: List[OTUData], ref_id: str, session
) -> List[OTUUpdate]:
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
                        )
                    )
                else:
                    sequence_inserts.append(sequence_update)

        otu_updates.append(
            OTUUpdate(
                otu_update,
                SequenceChanges(updates=sequence_updates, inserts=sequence_inserts),
                otu_item.old,
                otu_id=otu_item.old["_id"],
            )
        )

    return otu_updates


def prepare_insert_otu(
    otu: dict, created_at: datetime.datetime, ref_id: str, user_id: str
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
                }
            )

    return OTUInsert(
        new_otu,
        SequenceChanges(inserts=sequences),
    )


async def prepare_remove_otu(
    mongo: "Mongo", otu_id: str, session
) -> Optional[OTUDelete]:
    """
    Remove an OTU.

    Create a history document to record the change.

    :param otu_id: the ID of the OTU
    :param user_id: the ID of the requesting user
    :param silent: prevents dispatch of the change
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
    local_field: str = "reference.id", set_as: str = "reference"
) -> list[dict]:
    """
    Create a mongoDB aggregation pipeline step to look up nested reference by id.

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
            }
        },
        {"$set": {set_as: {"$first": f"${set_as}"}}},
    ]
