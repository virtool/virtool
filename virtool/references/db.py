import asyncio
import json.decoder
import logging
import os

import aiohttp
import pymongo
import semver

import virtool.api
import virtool.db.utils
import virtool.errors
import virtool.github
import virtool.history.db
import virtool.http.utils
import virtool.otus.db
import virtool.otus.utils
import virtool.processes.db
import virtool.processes.process
import virtool.references.utils
import virtool.users.db
import virtool.utils

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
    "process",
    "release",
    "remotes_from",
    "unbuilt_count",
    "updates",
    "updating",
    "user"
]


class CloneReferenceProcess(virtool.processes.process.Process):

    def __init__(self, app, process_id):
        super().__init__(app, process_id)

        self.steps = [
            self.copy_otus,
            self.create_history
        ]

    async def copy_otus(self):
        manifest = self.context["manifest"]
        created_at = self.context["created_at"]
        ref_id = self.context["ref_id"]
        user_id = self.context["user_id"]

        tracker = self.get_tracker(len(manifest))

        inserted_otu_ids = list()

        for source_otu_id, version in manifest.items():
            _, patched, _ = await virtool.history.db.patch_to_version(self.db, source_otu_id, version)

            otu_id = await insert_joined_otu(self.db, patched, created_at, ref_id, user_id)

            inserted_otu_ids.append(otu_id)

            await tracker.add(1)

        await self.update_context({
            "inserted_otu_ids": inserted_otu_ids
        })

    async def create_history(self):
        user_id = self.context["user_id"]
        inserted_otu_ids = self.context["inserted_otu_ids"]

        tracker = self.get_tracker(len(inserted_otu_ids))

        for otu_id in inserted_otu_ids:
            await insert_change(self.db, otu_id, "clone", user_id)
            await tracker.add(1)

    async def cleanup(self):
        ref_id = self.context["ref_id"]

        query = {"reference.id": ref_id}

        await asyncio.gather(
            self.db.references.delete_one({"_id": ref_id}),
            self.db.history.delete_many(query),
            self.db.otus.delete_many(query),
            self.db.sequences.delete_many(query)
        )


class ImportReferenceProcess(virtool.processes.process.Process):

    def __init__(self, app, process_id):
        super().__init__(app, process_id)

        self.steps = [
            self.load_file,
            self.set_metadata,
            self.validate,
            self.import_otus,
            self.create_history
        ]

        self.import_data = None

    async def load_file(self):
        path = self.context["path"]

        try:
            self.import_data = await self.run_in_thread(virtool.references.utils.load_reference_file, path)
        except json.decoder.JSONDecodeError as err:
            return self.error([{
                "id": "json_error",
                "message": str(err).split("JSONDecodeError: ")[1]
            }])
        except OSError as err:
            if "Not a gzipped file" in str(err):
                return self.error([{
                    "id": "not_gzipped",
                    "message": "Not a gzipped file"
                }])
            else:
                return self.error([{
                    "id": "unhandled",
                    "message": str(err)
                }])

    async def set_metadata(self):
        ref_id = self.context["ref_id"]

        try:
            data_type = self.import_data["data_type"]
        except (TypeError, KeyError):
            data_type = "genome"

        try:
            organism = self.import_data["organism"]
        except (TypeError, KeyError):
            organism = ""

        await self.db.references.update_one({"_id": ref_id}, {
            "$set": {
                "data_type": data_type,
                "organism": organism
            }
        })

    async def validate(self):
        errors = virtool.references.utils.check_import_data(
            self.import_data,
            strict=False,
            verify=True
        )

        if errors:
            return await self.error(errors)

    async def import_otus(self):
        created_at = self.context["created_at"]
        ref_id = self.context["ref_id"]
        user_id = self.context["user_id"]

        otus = self.import_data["otus"]

        tracker = self.get_tracker(len(otus))

        inserted_otu_ids = list()

        for otu in otus:
            otu_id = await insert_joined_otu(self.db, otu, created_at, ref_id, user_id)
            inserted_otu_ids.append(otu_id)
            await tracker.add(1)

        await self.update_context({
            "inserted_otu_ids": inserted_otu_ids
        })

    async def create_history(self):
        inserted_otu_ids = self.context["inserted_otu_ids"]
        user_id = self.context["user_id"]

        tracker = self.get_tracker(len(inserted_otu_ids))

        for otu_id in inserted_otu_ids:
            await insert_change(self.db, otu_id, "import", user_id)
            await tracker.add(1)


class RemoveReferenceProcess(virtool.processes.process.Process):

    def __init__(self, app, process_id):
        super().__init__(app, process_id)

        self.steps = [
            self.remove_indexes,
            self.remove_unreferenced_otus,
            self.remove_referenced_otus
        ]

    async def remove_indexes(self):
        ref_id = self.context["ref_id"]

        await self.db.indexes.delete_many({
            "reference.id": ref_id
        })

    async def remove_unreferenced_otus(self):
        ref_id = self.context["ref_id"]

        referenced_otu_ids = await self.db.analyses.distinct("results.otu.id", {"reference.id": ref_id})

        unreferenced_otu_ids = await self.db.otus.distinct("_id", {
            "reference.id": ref_id,
            "_id": {
                "$not": {
                    "$in": referenced_otu_ids
                }
            }
        })

        await asyncio.gather(
            self.db.otus.delete_many({"_id": {"$in": unreferenced_otu_ids}}),
            self.db.history.delete_many({"otu.id": {"$in": unreferenced_otu_ids}}),
            self.db.sequences.delete_many({"otu_id": {"$in": unreferenced_otu_ids}})
        )

    async def remove_referenced_otus(self):
        ref_id = self.context["ref_id"]
        user_id = self.context["user_id"]

        otu_count = await self.db.otus.count({"reference.id": ref_id})

        tracker = self.get_tracker(otu_count)

        async for document in self.db.otus.find({"reference.id": ref_id}):
            await virtool.otus.db.remove(
                self.db,
                document["_id"],
                user_id,
                document=document,
                silent=True
            )

            await tracker.add(1)


class UpdateRemoteReferenceProcess(virtool.processes.process.Process):

    def __init__(self, *args):
        super().__init__(*args)

        self.steps = [
            self.download_and_extract,
            self.update_otus,
            self.create_history,
            self.remove_otus,
            self.update_reference
        ]

    async def download_and_extract(self):
        url = self.context["release"]["download_url"]
        file_size = self.context["release"]["size"]

        tracker = self.get_tracker(file_size)

        try:
            with virtool.utils.get_temp_dir() as tempdir:
                temp_path = str(tempdir)

                download_path = os.path.join(temp_path, "reference.tar.gz")

                await virtool.http.utils.download_file(
                    self.app,
                    url,
                    download_path,
                    tracker.add
                )

                self.intermediate["update_data"] = await self.run_in_thread(
                    virtool.references.utils.load_reference_file,
                    download_path
                )

        except (aiohttp.ClientConnectorError, virtool.errors.GitHubError):
            return await self.error([{
                "id": "download_error",
                "message": "Could not download reference data"
            }])

    async def update_otus(self):
        update_data = self.intermediate["update_data"]

        tracker = self.get_tracker(len(update_data["otus"]))

        # The remote ids in the update otus.
        otu_ids_in_update = {otu["_id"] for otu in update_data["otus"]}

        updated_list = list()

        for otu in update_data["otus"]:
            old_or_id = await update_joined_otu(
                self.db,
                otu,
                self.context["created_at"],
                self.context["ref_id"],
                self.context["user_id"]
            )

            if old_or_id is not None:
                updated_list.append(old_or_id)

            await tracker.add(1)

        self.intermediate.update({
            "otu_ids_in_update": otu_ids_in_update,
            "updated_list": updated_list
        })

    async def create_history(self):
        updated_list = self.intermediate["updated_list"]

        tracker = self.get_tracker(len(updated_list))

        for old_or_id in updated_list:
            try:
                otu_id = old_or_id["_id"]
                old = old_or_id
            except TypeError:
                otu_id = old_or_id
                old = None

            await insert_change(
                self.db,
                otu_id,
                "update" if old else "remote",
                self.context["user_id"],
                old
            )

            await tracker.add(1)

    async def remove_otus(self):
        # Delete OTUs with remote ids that were not in the update.
        to_delete = await self.db.otus.distinct("_id", {
            "reference.id": self.context["ref_id"],
            "remote.id": {
                "$nin": list(self.intermediate["otu_ids_in_update"])
            }
        })

        tracker = self.get_tracker(len(to_delete))

        for otu_id in to_delete:
            await virtool.otus.db.remove(
                self.db,
                otu_id,
                self.context["user_id"]
            )

            await tracker.add(1)

    async def update_reference(self):
        ref_id = self.context["ref_id"]
        release = self.context["release"]

        await self.db.references.update_one({"_id": ref_id, "updates.id": release["id"]}, {
            "$set": {
                "installed": virtool.github.create_update_subdocument(release, True, self.context["user_id"]),
                "updates.$.ready": True
            }
        })

        await fetch_and_update_release(self.app, ref_id)

        await self.db.references.update_one({"_id": ref_id}, {
            "$set": {
                "updating": False
            }
        })


def processor(document):
    try:
        document["installed"] = document.pop("updates")[-1]
    except (KeyError, IndexError):
        pass

    return virtool.utils.base_processor(document)


async def add_group_or_user(db, ref_id, field, data):
    document = await db.references.find_one({"_id": ref_id}, [field])

    if not document:
        return None

    subdocument_id = data.get("group_id", None) or data["user_id"]

    if field == "groups" and await db.groups.count({"_id": subdocument_id}) == 0:
        raise virtool.errors.DatabaseError("group does not exist")

    if field == "users" and await db.users.count({"_id": subdocument_id}) == 0:
        raise virtool.errors.DatabaseError("user does not exist")

    if subdocument_id in [s["id"] for s in document[field]]:
        raise virtool.errors.DatabaseError(field[:-1] + " already exists")

    rights = {key: data.get(key, False) for key in virtool.references.utils.RIGHTS}

    subdocument = {
        "id": subdocument_id,
        "created_at": virtool.utils.timestamp(),
        **rights
    }

    await db.references.update_one({"_id": ref_id}, {
        "$push": {
            field: subdocument
        }
    })

    return subdocument


async def check_right(req, reference, right):
    """
    pass

    """
    if req["client"].administrator:
        return True

    user_id = req["client"].user_id

    try:
        groups = reference["groups"]
        users = reference["users"]
    except (KeyError, TypeError):
        reference = await req.app["db"].references.find_one(reference, ["groups", "users"])
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


async def check_source_type(db, ref_id, source_type):
    """
    Check if the provided `source_type` is valid based on the current reference source type configuration.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param ref_id: the reference context
    :type ref_id: str

    :param source_type: the source type to check
    :type source_type: str

    :return: source type is valid
    :rtype: bool

    """
    document = await db.references.find_one(ref_id, ["restrict_source_types", "source_types"])

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


def compose_base_find_query(user_id: str, administrator: bool, groups: list):
    """
    Compose a query for filtering reference search results based on user read rights.

    :param user_id: the id of the user requesting the search
    :param administrator: the administrator flag of the user requesting the search
    :param groups: the id group membership of the user requesting the search
    :return: a valid MongoDB query

    """
    if administrator:
        return dict()

    is_user_member = {
        "users.id": user_id
    }

    is_group_member = {
        "groups.id": {
            "$in": groups
        }
    }

    is_owner = {
        "user.id": user_id
    }

    return {
        "$or": [
            is_group_member,
            is_user_member,
            is_owner
        ]
    }


async def delete_group_or_user(db, ref_id, subdocument_id, field):
    """
    Delete an existing group or user as decided by the `field` argument.

    :param db: the application database client
    :type db: :class:`virtool.db.iface.DB`

    :param ref_id: the id of the reference to modify
    :type ref_id: str

    :param subdocument_id: the id of the group or user to delete
    :type subdocument_id: str

    :param field: the field to modify: 'group' or 'user'
    :type field: str

    :return: the id of the removed subdocument
    :rtype: str

    """
    document = await db.references.find_one({
        "_id": ref_id,
        field + ".id": subdocument_id
    }, [field])

    if document is None:
        return None

    # Retain only the subdocuments that don't match the passed `subdocument_id`.
    filtered = [s for s in document[field] if s["id"] != subdocument_id]

    await db.references.update_one({"_id": ref_id}, {
        "$set": {
            field: filtered
        }
    })

    return subdocument_id


async def edit_group_or_user(db, ref_id, subdocument_id, field, data):
    """
    Edit an existing group or user as decided by the `field` argument. Returns `None` if the reference, group, or user
    does not exist.

    :param db: the application database client
    :type db: :class:`virtool.db.iface.DB`

    :param ref_id: the id of the reference to modify
    :type ref_id: str

    :param subdocument_id: the id of the group or user to modify
    :type subdocument_id: str

    :param field: the field to modify: 'group' or 'user'
    :type field: str

    :param data: the data to update the group or user with
    :type data: dict

    :return: the modified subdocument
    :rtype: dict

    """
    document = await db.references.find_one({
        "_id": ref_id,
        field + ".id": subdocument_id
    }, [field])

    if document is None:
        return None

    for subdocument in document[field]:
        if subdocument["id"] == subdocument_id:
            rights = {key: data.get(key, subdocument[key]) for key in virtool.references.utils.RIGHTS}
            subdocument.update(rights)

            await db.references.update_one({"_id": ref_id}, {
                "$set": {
                    field: document[field]
                }
            })

            return subdocument


async def fetch_and_update_release(app, ref_id: str, ignore_errors: bool = False) -> dict:
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

    document = await db.references.find_one(ref_id, [
        "installed",
        "release",
        "remotes_from"
    ])

    release = document.get("release")
    etag = virtool.github.get_etag(release)

    # Variables that will be used when trying to fetch release from GitHub.
    errors = list()
    updated = None

    try:
        updated = await virtool.github.get_release(
            app["settings"],
            app["client"],
            document["remotes_from"]["slug"],
            etag
        )

        if updated:
            updated = virtool.github.format_release(updated)

    except (aiohttp.ClientConnectorError, virtool.errors.GitHubError) as err:
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
            installed and
            semver.compare(release["name"].lstrip("v"), installed["name"].lstrip("v")) == 1
        )

        release["retrieved_at"] = retrieved_at

    await db.references.update_one({"_id": ref_id}, {
        "$set": {
            "errors": errors,
            "release": release
        }
    })

    return release


async def get_computed(db, ref_id, internal_control_id):
    """
    Get all computed data for the specified reference.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param ref_id:
    :param internal_control_id:
    :return:
    """
    contributors, internal_control, latest_build, otu_count, unbuilt_count = await asyncio.gather(
        get_contributors(db, ref_id),
        get_internal_control(db, internal_control_id, ref_id),
        get_latest_build(db, ref_id),
        get_otu_count(db, ref_id),
        get_unbuilt_count(db, ref_id)
    )

    return {
        "contributors": contributors,
        "internal_control": internal_control,
        "latest_build": latest_build,
        "otu_count": otu_count,
        "unbuilt_change_count": unbuilt_count
    }


async def get_contributors(db, ref_id):
    """
    Return an list of contributors and their contribution count for a specific ref.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param ref_id: the id of the ref to get contributors for
    :type ref_id: str

    :return: a list of contributors to the ref
    :rtype: Union[None, List[dict]]

    """
    return await virtool.history.db.get_contributors(db, {"reference.id": ref_id})


async def get_internal_control(db, internal_control_id, ref_id):
    """
    Return a minimal dict describing the ref internal control given a `otu_id`.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param internal_control_id: the id of the otu to create a minimal dict for
    :type internal_control_id: Union[None, str]

    :param ref_id: the id of the reference to look for the control OTU in
    :type ref_id: str

    :return: a minimal dict describing the ref internal control
    :rtype: Union[None, dict]

    """
    name = await virtool.db.utils.get_one_field(db.otus, "name", {
        "_id": internal_control_id,
        "reference.id": ref_id
    })

    if name is None:
        return None

    return {
        "id": internal_control_id,
        "name": name
    }


async def get_latest_build(db, ref_id):
    """
    Return the latest index build for the ref.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param ref_id: the id of the ref to get the latest build for
    :type ref_id: str

    :return: a subset of fields for the latest build
    :rtype: Union[None, dict]

    """
    latest_build = await db.indexes.find_one({
        "reference.id": ref_id,
        "ready": True
    }, projection=["created_at", "version", "user"], sort=[("version", pymongo.DESCENDING)])

    if latest_build is None:
        return None

    return virtool.utils.base_processor(latest_build)


async def get_manifest(db, ref_id):
    """
    Generate a dict of otu document version numbers keyed by the document id. This is used to make sure only changes
    made at the time the index rebuild was started are included in the build.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param ref_id: the id of the reference to get the current index for
    :type ref_id: str

    :return: a manifest of otu ids and versions
    :rtype: dict

    """
    manifest = dict()

    async for document in db.otus.find({"reference.id": ref_id}, ["version"]):
        manifest[document["_id"]] = document["version"]

    return manifest


async def get_newest_update(db, ref_id):
    updates = await virtool.db.utils.get_one_field(db.references, "updates", ref_id)

    if len(updates):
        return None

    return updates[-1]


async def get_otu_count(db, ref_id):
    """
    Get the number of OTUs associated with the given `ref_id`.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param ref_id: the id of the reference to get the current index for
    :type ref_id: str

    :return: the OTU count
    :rtype: int

    """
    return await db.otus.count({
        "reference.id": ref_id
    })


async def get_unbuilt_count(db, ref_id):
    """
    Return a count of unbuilt history changes associated with a given `ref_id`.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param ref_id: the id of the ref to count unbuilt changes for
    :type ref_id: str

    :return: the number of unbuilt changes
    :rtype: int

    """
    return await db.history.count({
        "reference.id": ref_id,
        "index.id": "unbuilt"
    })


async def create_clone(db, settings, name, clone_from, description, user_id):
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
        user_id=user_id
    )

    document["cloned_from"] = {
        "id": clone_from,
        "name": source["name"]
    }

    return document


async def create_document(db, settings, name, organism, description, data_type, created_at=None, ref_id=None,
                          user_id=None, users=None):
    if ref_id and await db.references.count({"_id": ref_id}):
        raise virtool.errors.DatabaseError("ref_id already exists")

    ref_id = ref_id or await virtool.db.utils.get_new_id(db.otus)

    user = None

    if user_id:
        user = {
            "id": user_id
        }

    if not users:
        users = [virtool.references.utils.get_owner_user(user_id)]

    document = {
        "_id": ref_id,
        "created_at": created_at or virtool.utils.timestamp(),
        "data_type": data_type,
        "description": description,
        "name": name,
        "organism": organism,
        "internal_control": None,
        "restrict_source_types": False,
        "source_types": settings["default_source_types"],
        "groups": list(),
        "users": users,
        "user": user
    }

    if data_type == "barcode":
        document["targets"] = list()

    return document


async def create_import(db, settings, name, description, import_from, user_id):
    """
    Import a previously exported Virtool reference.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param settings: the application settings object
    :type settings: :class:`virtool.app_settings.Settings`

    :param name: the name for the new reference
    :type name: str

    :param description: a description for the new reference
    :type description: str

    :param import_from: the uploaded file to import from
    :type import_from: str

    :param user_id: the id of the creating user
    :type user_id: str

    :return: a reference document
    :rtype: dict

    """
    created_at = virtool.utils.timestamp()

    document = await create_document(
        db,
        settings,
        name or "Unnamed Import",
        None,
        description,
        None,
        created_at=created_at,
        user_id=user_id
    )

    file_document = await db.files.find_one(import_from, ["name", "created_at", "user"])

    document["imported_from"] = virtool.utils.base_processor(file_document)

    return document


async def create_remote(db, settings, release, remote_from, user_id):
    created_at = virtool.utils.timestamp()

    document = await create_document(
        db,
        settings,
        "Plant Viruses",
        None,
        "The official plant virus reference from the Virtool developers",
        None,
        created_at=created_at,
        user_id=user_id
    )

    document.update({
        # Connection information for the GitHub remote repo.
        "remotes_from": {
            "errors": [],
            "slug": remote_from
        },
        # The latest available release on GitHub.
        "release": dict(release, retrieved_at=created_at),
        # The update history for the reference. We put the release being installed as the first history item.
        "updates": [virtool.github.create_update_subdocument(release, False, user_id, created_at)],
        "installed": None
    })

    return document


async def download_and_parse_release(app, url, process_id, progress_handler):
    db = app["db"]

    with virtool.utils.get_temp_dir() as tempdir:
        temp_path = str(tempdir)

        download_path = os.path.join(temp_path, "reference.tar.gz")

        await virtool.http.utils.download_file(
            app,
            url,
            download_path,
            progress_handler
        )

        await virtool.processes.db.update(db, process_id, progress=0.3, step="unpack")

        return await app["run_in_thread"](virtool.references.utils.load_reference_file, download_path)


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

    internal_control_id = data.get("internal_control")

    if internal_control_id == "":
        data["internal_control"] = None

    elif internal_control_id:
        internal_control = await virtool.references.db.get_internal_control(db, internal_control_id, ref_id)

        if internal_control is None:
            data["internal_control"] = None
        else:
            data["internal_control"] = {
                "id": internal_control_id
            }

    document = await db.references.find_one_and_update({"_id": ref_id}, {
        "$set": data
    })

    document.update(await virtool.references.db.get_computed(db, ref_id, internal_control_id))

    if "name" in data:
        await db.analyses.update_many({"reference.id": ref_id}, {
            "$set": {
                "reference.name": document["name"]
            }
        })

    users = await virtool.db.utils.get_one_field(db.references, "users", ref_id)

    document["users"] = await virtool.users.db.attach_identicons(db, users)

    return virtool.utils.base_processor(document)


async def export(db, ref_id, scope):
    otu_list = list()

    query = {
        "reference.id": ref_id
    }

    if scope == "built" or scope == "remote":
        query["last_indexed_version"] = {"$ne": None}

        async for document in db.otus.find(query):
            _, joined, _ = await virtool.history.db.patch_to_version(
                db,
                document["_id"],
                document["last_indexed_version"]
            )

            otu_list.append(joined)

    elif scope == "unbuilt":
        async for document in db.otus.find(query):
            last_verified = await virtool.history.db.patch_to_verified(db, document["_id"])
            otu_list.append(last_verified)

    else:
        async for document in db.otus.find(query):
            current = await virtool.otus.db.join(db, document["_id"], document)
            otu_list.append(current)

    return virtool.references.utils.clean_export_list(otu_list, scope == "remote")


async def finish_remote(app, release, ref_id, created_at, process_id, user_id):
    db = app["db"]

    progress_tracker = virtool.processes.process.ProgressTracker(
        db,
        process_id,
        release["size"],
        factor=0.3,
        increment=0.02
    )

    try:
        import_data = await download_and_parse_release(
            app,
            release["download_url"],
            process_id,
            progress_tracker.add
        )
    except (aiohttp.ClientConnectorError, virtool.errors.GitHubError):
        return await virtool.processes.db.update(
            db,
            process_id,
            errors=["Could not download reference data"]
        )

    try:
        data_type = import_data["data_type"]
    except KeyError:
        return await virtool.processes.db.update(
            db,
            process_id,
            errors=["Could not infer data type"]
        )

    await db.references.update_one({"_id": ref_id}, {
        "$set": {
            "data_type": data_type,
            "organism": import_data.get("organism", "Unknown")
        }
    })

    errors = virtool.references.utils.check_import_data(
        import_data,
        strict=True,
        verify=True
    )

    if errors:
        return await virtool.processes.db.update(db, process_id, errors=errors)

    await virtool.processes.db.update(
        db,
        process_id,
        progress=0.4,
        step="import"
    )

    otus = import_data["otus"]

    progress_tracker = virtool.processes.process.ProgressTracker(
        db,
        process_id,
        len(otus),
        factor=0.3,
        initial=0.4
    )

    inserted_otu_ids = list()

    for otu in otus:
        otu_id = await insert_joined_otu(
            db,
            otu,
            created_at,
            ref_id,
            user_id,
            remote=True
        )
        inserted_otu_ids.append(otu_id)
        await progress_tracker.add(1)

    await virtool.processes.db.update(
        db,
        process_id,
        progress=0.7,
        step="create_history"
    )

    progress_tracker = virtool.processes.process.ProgressTracker(
        db,
        process_id,
        len(otus),
        factor=0.3,
        initial=0.7
    )

    for otu_id in inserted_otu_ids:
        await insert_change(db, otu_id, "remote", user_id)
        await progress_tracker.add(1)

    await db.references.update_one({"_id": ref_id, "updates.id": release["id"]}, {
        "$set": {
            "installed": virtool.github.create_update_subdocument(release, True, user_id),
            "updates.$.ready": True,
            "updating": False
        }
    })

    await fetch_and_update_release(app, ref_id)

    await virtool.processes.db.update(db, process_id, progress=1)


async def insert_change(db, otu_id, verb, user_id, old=None):
    # Join the otu document into a complete otu record. This will be used for recording history.
    joined = await virtool.otus.db.join(db, otu_id)

    name = joined["name"]

    e = "" if verb[-1] == "e" else "e"

    # Build a ``description`` field for the otu creation change document.
    description = f"{verb.capitalize()}{e}d {name}"

    abbreviation = joined.get("abbreviation", None)

    # Add the abbreviation to the description if there is one.
    if abbreviation:
        description = f"{description} ({abbreviation})"

    await virtool.history.db.add(
        db,
        verb,
        old,
        joined,
        description,
        user_id,
        silent=True
    )


async def insert_joined_otu(db, otu, created_at, ref_id, user_id, remote=False):
    all_sequences = list()

    issues = virtool.otus.utils.verify(otu)

    otu.update({
        "created_at": created_at,
        "lower_name": otu["name"].lower(),
        "last_indexed_version": None,
        "issues": issues,
        "verified": issues is None,
        "imported": True,
        "version": 0,
        "reference": {
            "id": ref_id
        },
        "user": {
            "id": user_id
        }
    })

    if "schema" not in otu:
        otu["schema"] = list()

    remote_id = otu.pop("_id")

    if remote:
        otu["remote"] = {
            "id": remote_id
        }

    for isolate in otu["isolates"]:
        for sequence in isolate.pop("sequences"):
            try:
                remote_sequence_id = sequence["remote"]["id"]
                sequence.pop("_id")
            except KeyError:
                remote_sequence_id = sequence.pop("_id")

            all_sequences.append({
                **sequence,
                "accession": sequence["accession"],
                "isolate_id": isolate["id"],
                "segment": sequence.get("segment", ""),
                "reference": {
                    "id": ref_id
                },
                "remote": {
                    "id": remote_sequence_id
                }
            })

    document = await db.otus.insert_one(otu, silent=True)

    for sequence in all_sequences:
        await db.sequences.insert_one(dict(sequence, otu_id=document["_id"]), silent=True)

    return document["_id"]


async def refresh_remotes(app):
    db = app["db"]

    try:
        logging.debug("Started reference refresher")

        while True:
            for ref_id in await db.references.distinct("_id", {"remotes_from": {"$exists": True}}):
                await fetch_and_update_release(
                    app,
                    ref_id,
                    ignore_errors=True
                )

            await asyncio.sleep(600)
    except asyncio.CancelledError:
        pass

    logging.debug("Stopped reference refresher")


async def update(app, created_at, process_id, ref_id, release, user_id):
    db = app["db"]

    update_subdocument = virtool.github.create_update_subdocument(
        release,
        False,
        user_id,
        created_at
    )

    await db.references.update_one({"_id": ref_id}, {
        "$push": {
            "updates": update_subdocument
        },
        "$set": {
            "process": {
                "id": process_id
            },
            "updating": True
        }
    })

    return release, update_subdocument


async def update_joined_otu(db, otu, created_at, ref_id, user_id):
    remote_id = otu["_id"]

    old = await virtool.otus.db.join(db, {"reference.id": ref_id, "remote.id": remote_id})

    if old:
        if not virtool.references.utils.check_will_change(old, otu):
            return None

        sequence_updates = list()

        for isolate in otu["isolates"]:
            for sequence in isolate.pop("sequences"):
                sequence_updates.append({
                    "accession": sequence["accession"],
                    "definition": sequence["definition"],
                    "host": sequence["host"],
                    "segment": sequence.get("segment", ""),
                    "sequence": sequence["sequence"],
                    "otu_id": old["_id"],
                    "isolate_id": isolate["id"],
                    "reference": {
                        "id": ref_id
                    },
                    "remote": {
                        "id": sequence["_id"]
                    }
                })

        await db.otus.update_one({"_id": old["_id"]}, {
            "$inc": {
                "version": 1
            },
            "$set": {
                "abbreviation": otu["abbreviation"],
                "name": otu["name"],
                "lower_name": otu["name"].lower(),
                "isolates": otu["isolates"],
                "schema": otu.get("schema", list())
            }
        })

        for sequence_update in sequence_updates:
            remote_sequence_id = sequence_update["remote"]["id"]

            update_result = await db.sequences.update_one({"reference.id": ref_id, "remote.id": remote_sequence_id}, {
                "$set": sequence_update
            })

            if not update_result.matched_count:
                await db.sequences.insert_one(sequence_update)

        return old

    return await insert_joined_otu(
        db,
        otu,
        created_at,
        ref_id,
        user_id,
        remote=True
    )
