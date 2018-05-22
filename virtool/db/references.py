import asyncio

import pymongo
from pymongo import InsertOne

import virtool.db.history
import virtool.db.otus
import virtool.db.processes
import virtool.db.utils
import virtool.errors
import virtool.otus
import virtool.processes
import virtool.references
import virtool.utils

PROJECTION = [
    "_id",
    "created_at",
    "data_type",
    "name",
    "organism",
    "public",
    "user",
    "internal_control",
    "cloned_from",
    "imported_from",
    "remoted_from",
    "process",
    "latest_build"
]


async def add_group_or_user(db, ref_id, field, data):

    document = await db.references.find_one({"_id": ref_id}, [field])

    if not document:
        return None

    subdocument_id = data.get("group_id", None) or data["user_id"]

    if subdocument_id in [s["id"] for s in document[field]]:
        raise virtool.errors.DatabaseError(field[:-1] + " already exists")

    rights = {key: data.get(key, False) for key in virtool.references.RIGHTS}

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

    # Return `False` when source_types are restricted and source_type is not allowed.
    if source_type and restrict_source_types:
        return source_type in source_types

    # Return `True` when:
    # - source_type is empty string (unknown)
    # - source_types are not restricted
    # - source_type is an allowed source_type
    return True


async def cleanup_removed(db, process_id, ref_id, user_id):
    await virtool.db.processes.update(db, process_id, 0, step="delete_indexes")

    await db.indexes.delete_many({
        "reference.id": ref_id
    })

    await virtool.db.processes.update(db, process_id, 0.5, step="delete_otus")

    otu_count = await db.otus.count({"reference.id": ref_id})

    progress_tracker = virtool.processes.ProgressTracker(otu_count, factor=0.5, increment=0.03)

    async for document in db.otus.find({"reference.id": ref_id}):
        await virtool.db.otus.remove(
            db,
            document["_id"],
            user_id,
            document=document
        )

        progress = progress_tracker.add(1)

        if progress - progress_tracker.last_reported > 0.03:
            await virtool.db.processes.update(db, process_id, progress=(0.5 + progress))
            progress_tracker.reported()

    await virtool.db.processes.update(db, process_id, progress=1)


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
            rights = {key: data.get(key, False) for key in virtool.references.RIGHTS}
            subdocument.update(rights)

            await db.references.update_one({"_id": ref_id}, {
                "$set": {
                    field: document[field]
                }
            })

            return subdocument


async def get_computed(db, ref_id, internal_control_id):
    contributors, internal_control, latest_build = await asyncio.gather(
        get_contributors(db, ref_id),
        get_internal_control(db, internal_control_id),
        get_latest_build(db, ref_id)
    )

    return {
        "contributors": contributors,
        "internal_control": internal_control,
        "latest_build": latest_build
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
    return await virtool.db.history.get_contributors(db, {"reference.id": ref_id})


async def get_internal_control(db, internal_control_id):
    """
    Return a minimal dict describing the ref internal control given a `otu_id`.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param internal_control_id: the id of the otu to create a minimal dict for
    :type internal_control_id: str

    :return: a minimal dict describing the ref internal control
    :rtype: Union[None, dict]

    """
    if internal_control_id is None:
        return None

    name = await virtool.db.utils.get_one_field(db.otus, "name", internal_control_id)

    if name is None:
        return None

    return {
        "id": internal_control_id,
        "name": await virtool.db.utils.get_one_field(db.otus, "name", internal_control_id)
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
    }, projection=["created_at", "version", "user"], sort=[("index.version", pymongo.DESCENDING)])

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


async def create_clone(db, settings, name, clone_from, description, public, user_id):

    source = await db.references.find_one(clone_from)

    document = await create_document(
        db,
        settings,
        name,
        source["organism"],
        description,
        source["data_type"],
        public,
        created_at=virtool.utils.timestamp(),
        user_id=user_id
    )

    document["cloned_from"] = {
        "id": clone_from,
        "name": source["name"]
    }

    return document


async def create_document(db, settings, name, organism, description, data_type, public, created_at=None, ref_id=None,
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
        users = [virtool.references.get_owner_user(user_id)]

    document = {
        "_id": ref_id,
        "created_at": created_at or virtool.utils.timestamp(),
        "data_type": data_type,
        "description": description,
        "name": name,
        "organism": organism,
        "public": public,
        "internal_control": None,
        "restrict_source_types": False,
        "source_types": settings["default_source_types"],
        "groups": list(),
        "users": users,
        "user": user
    }

    return document


async def create_import(db, settings, name, description, public, import_from, user_id):
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

    :param public: is the reference public on creation
    :type public: bool

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
        name,
        None,
        description,
        None,
        public,
        created_at=created_at,
        user_id=user_id
    )

    file_document = await db.files.find_one(import_from, ["name", "created_at", "user"])

    document["imported_from"] = virtool.utils.base_processor(file_document)

    return document


async def create_original(db, settings):
    # The `created_at` value should be the `created_at` value for the earliest history document.
    first_change = await db.history.find_one({}, ["created_at"], sort=[("created_at", pymongo.ASCENDING)])
    created_at = first_change["created_at"]

    users = await db.users.find({}, ["_id", "administrator", "permissions"]).to_list(None)

    for user in users:
        permissions = user.pop("permissions")

        user.update({
            "id": user.pop("_id"),
            "build_index": permissions.get("modify_virus", False),
            "modify": user["administrator"],
            "modify_otu": permissions.get("modify_virus", False)
        })

    document = await create_document(
        db,
        settings,
        "Original",
        "virus",
        "Created from existing viruses after upgrade to Virtool v3",
        "genome",
        True,
        created_at=created_at,
        ref_id="original",
        users=users
    )

    await db.references.insert_one(document)

    return document


async def finish_clone(app, ref_id, created_at, manifest, process_id, user_id):
    db = app["db"]

    await virtool.db.processes.update(db, process_id, 0.1, "copy_otus")

    progress_tracker = virtool.processes.ProgressTracker(len(manifest), factor=0.5)

    inserted_otu_ids = list()

    for source_otu_id, version in manifest.items():
        patched = await virtool.db.history.patch_to_version(db, source_otu_id, version)

        otu_id = await insert_joined_otu(db, patched, created_at, ref_id, user_id)

        inserted_otu_ids.append(otu_id)

        progress = progress_tracker.add(1)

        if progress_tracker.progress - progress_tracker.last_reported >= 0.05:
            await virtool.db.processes.update(db, process_id, progress=(0.2 + progress))
            progress_tracker.reported()

    for otu_id in inserted_otu_ids:
        await insert_change(db, otu_id, "clone", user_id)

        progress = progress_tracker.add(1)

        if progress_tracker.progress - progress_tracker.last_reported >= 0.05:
            await virtool.db.processes.update(db, process_id, progress=(0.6 + progress))
            progress_tracker.reported()


async def finish_import(app, path, ref_id, created_at, process_id, user_id):
    db = app["db"]

    import_data = await app["run_in_thread"](virtool.references.load_import_file, path)

    try:
        data_type = import_data["data_type"]
    except (TypeError, KeyError):
        data_type = "genome"

    try:
        organism = import_data["organism"]
    except (TypeError, KeyError):
        organism = ""

    await db.references.update_one({"_id": ref_id}, {
        "$set": {
            "data_type": data_type,
            "organism": organism
        }
    })

    await virtool.db.processes.update(db, process_id, 0.1, "validate_documents")

    otus = import_data["data"]

    duplicates = virtool.references.detect_duplicates(otus)

    if duplicates:
        errors = [
            {
                "id": "duplicates",
                "message": "Duplicates found.",
                "duplicates": duplicates
            }
        ]

        await virtool.db.processes.update(db, process_id, errors=errors)

    await virtool.db.processes.update(db, process_id, 0.2, "import_otus")

    progress_tracker = virtool.processes.ProgressTracker(len(otus), factor=0.4)

    inserted_otu_ids = list()

    for otu in otus:
        otu_id = await insert_joined_otu(db, otu, created_at, ref_id, user_id)

        inserted_otu_ids.append(otu_id)

        progress = progress_tracker.add(1)

        if progress_tracker.progress - progress_tracker.last_reported >= 0.05:
            await virtool.db.processes.update(db, process_id, progress=(0.2 + progress))
            progress_tracker.reported()

    await virtool.db.processes.update(db, process_id, 0.6, "create_history")

    progress_tracker = virtool.processes.ProgressTracker(len(otus), factor=0.4)

    for otu_id in inserted_otu_ids:
        await insert_change(db, otu_id, "import", user_id)

        # Join the otu document into a complete otu record. This will be used for recording history.
        joined = await virtool.db.otus.join(db, otu_id)

        # Build a ``description`` field for the otu creation change document.
        description = "Imported {}".format(joined["name"])

        abbreviation = joined.get("abbreviation", None)

        # Add the abbreviation to the description if there is one.
        if abbreviation:
            description += " ({})".format(abbreviation)

        await virtool.db.history.add(
            db,
            "import",
            None,
            joined,
            description,
            user_id
        )

        progress = progress_tracker.add(1)

        if progress_tracker.progress - progress_tracker.last_reported >= 0.05:
            await virtool.db.processes.update(db, process_id, progress=(0.6 + progress))
            progress_tracker.reported()

    await virtool.db.processes.update(db, process_id, 1)


async def insert_change(db, otu_id, verb, user_id):
    # Join the otu document into a complete otu record. This will be used for recording history.
    joined = await virtool.db.otus.join(db, otu_id)

    # Build a ``description`` field for the otu creation change document.
    description = "{}ed {}".format(verb.capitalize(), joined["name"])

    abbreviation = joined.get("abbreviation", None)

    # Add the abbreviation to the description if there is one.
    if abbreviation:
        description += " ({})".format(abbreviation)

    await virtool.db.history.add(
        db,
        verb,
        None,
        joined,
        description,
        user_id
    )


async def insert_joined_otu(db, otu, created_at, ref_id, user_id):
    all_sequences = list()

    issues = virtool.otus.verify(otu)

    otu.pop("_id", None)

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

    used_isolate_ids = set()

    for isolate in otu["isolates"]:

        isolate_id = virtool.utils.random_alphanumeric(3, excluded=used_isolate_ids)
        used_isolate_ids.add(isolate_id)
        isolate["id"] = isolate_id

        for sequence in isolate.pop("sequences"):
            all_sequences.append({
                **sequence,
                "accession": sequence.pop("_id", None) or sequence["accession"],
                "isolate_id": isolate_id,
                "reference": {
                    "id": ref_id
                }
            })

    document = await db.otus.insert_one(otu)

    for sequence in all_sequences:
        await db.sequences.insert_one(dict(sequence, otu_id=document["_id"]), silent=True)

    return document["_id"]
