import asyncio

import pymongo
from pymongo import InsertOne

import virtool.db.history
import virtool.db.kinds
import virtool.db.processes
import virtool.db.utils
import virtool.errors
import virtool.kinds
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
    "cloned_from",
    "imported_from",
    "remoted_from",
    "process",
    "latest_build"
]


async def get_computed(db, ref_id):
    contributors, internal_control, latest_build = await asyncio.gather(
        get_contributors(db, ref_id),
        get_internal_control(db, ref_id),
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
    return await virtool.db.history.get_contributors(db, {"ref.id": ref_id})


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
    last_build = await db.indexes.find_one({
        "ref.id": ref_id,
        "ready": True
    }, projection=["created_at", "version", "user"], sort=[("index.version", pymongo.DESCENDING)])

    if last_build is None:
        return None

    return virtool.utils.base_processor(last_build)


async def get_internal_control(db, kind_id):
    """
    Return a minimal dict describing the ref internal control given a `kind_id`.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param kind_id: the id of the kind to create a minimal dict for
    :type kind_id: str

    :return: a minimal dict describing the ref internal control
    :rtype: Union[None, dict]

    """
    name = await virtool.db.utils.get_one_field(db.kinds, "name", kind_id)

    if name is None:
        return None

    return {
        "id": kind_id,
        "name": await virtool.db.utils.get_one_field(db.kinds, "name", kind_id)
    }


async def check_import_abbreviation(db, kind_document, lower_name=None):
    """
    Check if the abbreviation for a kind document to be imported already exists in the database. If the abbreviation
    exists, set the ``abbreviation`` field in the kind document to an empty string and return warning text to
    send to the client.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param kind_document: the kind document that is being imported
    :type kind_document: dict

    :param lower_name: the name of the kind coerced to lowercase
    :type lower_name: str

    """
    lower_name = lower_name or kind_document["name"].lower()

    # Check if abbreviation exists already.
    kind_with_abbreviation = None

    # Don't count empty strings as duplicate abbreviations!
    if kind_document["abbreviation"]:
        kind_with_abbreviation = await db.kinds.find_one({"abbreviation": kind_document["abbreviation"]})

    if kind_with_abbreviation and kind_with_abbreviation["lower_name"] != lower_name:
        # Remove the imported kind's abbreviation because it is already assigned to an existing kind.
        kind_document["abbreviation"] = ""

        # Record a message for the user.
        return "Abbreviation {} already existed for virus {} and was not assigned to new virus {}.".format(
            kind_with_abbreviation["abbreviation"], kind_with_abbreviation["name"], kind_document["name"]
        )

    return None


async def clone(db, name, clone_from, description, public, user_id):

    source = await db.refs.find_one(clone_from)

    document = await create_document(
        db,
        name,
        source["organism"],
        description,
        source["data_type"],
        public,
        created_at=virtool.utils.timestamp(),
        user_id=user_id
    )

    document["cloned_from"] = {
        "id": clone_from
    }

    await clone_kinds(
        db,
        clone_from,
        source["name"],
        document["_id"],
        user_id
    )

    return document


async def clone_kinds(db, source_id, source_ref_name, ref_id, user_id):
    kind_requests = list()
    sequence_requests = list()

    excluded_kind_ids = list()
    excluded_isolate_ids = list()
    excluded_sequence_ids = list()

    async for kind in db.kinds.find({"ref.id": source_id}):

        new_kind_id = await virtool.db.utils.get_new_id(db.kinds, excluded=excluded_kind_ids)

        sequences = list()

        for isolate in kind["isolates"]:

            new_isolate_id = await virtool.db.kinds.get_new_isolate_id(db, excluded_isolate_ids)

            async for sequence in await db.sequences.find({"kind_id": kind["_id"], "isolate_id": isolate["id"]}):
                new_sequence_id = await virtool.db.utils.get_new_id(db.sequences, excluded=excluded_sequence_ids)

                sequence.update({
                    "_id": new_sequence_id,
                    "kind_id": new_kind_id,
                    "isolate_id": new_isolate_id
                })

                sequences.append(sequence)

                excluded_sequence_ids.append(new_sequence_id)

            isolate["id"] = new_isolate_id

            excluded_isolate_ids.append(new_isolate_id)

        kind.update({
            "_id": new_kind_id,
            "created_at": virtool.utils.timestamp(),
            "ref": {
                "id": ref_id
            }
        })

        kind_requests.append(InsertOne(kind))

        excluded_kind_ids.append(new_kind_id)

        sequence_requests += [InsertOne(s) for s in sequences]

        await virtool.db.history.add(
            db,
            "clone",
            None,
            virtool.kinds.merge_kind(kind, sequences),
            "Clone from {} ({})".format(source_ref_name, source_id),
            user_id
        )

    await db.kinds.bulk_write(kind_requests)
    await db.sequences.bulk_write(sequence_requests)


async def create_document(db, name, organism, description, data_type, public, created_at=None, ref_id=None,
                          user_id=None, users=None):

    if await db.references.count({"_id": ref_id}):
        raise virtool.errors.DatabaseError("ref_id already exists")

    ref_id = ref_id or await virtool.db.utils.get_new_id(db.kinds)

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
        "users": users,
        "user": user
    }

    return document


async def create_original(db):
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
            "modify_kind": permissions.get("modify_virus", False)
        })

    document = await create_document(
        db,
        "Original",
        "virus",
        "Created from existing viruses after upgrade to Virtool v3",
        "genome",
        True,
        created_at=created_at,
        ref_id="original",
        users=users
    )

    await db.refs.insert_one(document)

    return document


async def create_for_import(db, name, description, public, import_from, user_id):
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


async def import_file(app, path, ref_id, created_at, process_id, user_id):
    db = app["db"]
    dispatch = app["dispatch"]

    import_data = await app["run_in_thread"](virtool.references.load_import_file, path)

    try:
        data_type = import_data["data_type"]
    except (TypeError, KeyError):
        data_type = "genome"

    try:
        organism = import_data["organism"]
    except (TypeError, KeyError):
        organism = ""

    await db.refs.update_one({"_id": ref_id}, {
        "$set": {
            "data_type": data_type,
            "organism": organism
        }
    })

    await virtool.db.processes.update(db, dispatch, process_id, 0.2, "validate_documents")

    kinds = import_data["data"]

    duplicates = virtool.references.detect_duplicates(kinds)

    if duplicates:
        errors = [
            {
                "id": "duplicates",
                "message": "Duplicates found.",
                "duplicates": duplicates
            }
        ]

        await virtool.db.processes.update(db, dispatch, process_id, errors=errors)

    await virtool.db.processes.update(db, dispatch, process_id, 0.4, "import_documents")

    used_kind_ids = set()
    used_isolate_ids = set()
    used_sequence_ids = set()

    for kind in kinds:

        issues = virtool.kinds.verify(kind)

        kind_id = await virtool.db.utils.get_new_id(db.kinds, excluded=used_kind_ids)

        used_kind_ids.add(kind_id)

        kind.update({
            "_id": kind_id,
            "created_at": created_at,
            "lower_name": kind["name"].lower(),
            "last_indexed_version": None,
            "issues": issues,
            "verified": issues is None,
            "imported": True,
            "version": 0,
            "ref": {
                "id": ref_id
            },
            "user": {
                "id": user_id
            }
        })

        for isolate in kind["isolates"]:
            isolate_id = await virtool.db.kinds.get_new_isolate_id(db, excluded=used_isolate_ids)

            isolate["id"] = isolate_id

            used_isolate_ids.add(isolate_id)

            for sequence in isolate.pop("sequences"):
                sequence_id = await virtool.db.utils.get_new_id(db.sequences, excluded=used_sequence_ids)

                sequence.update({
                    "_id": sequence_id,
                    "ref_id": ref_id,
                    "kind_id": kind_id,
                    "isolate_id": isolate_id
                })

                await db.sequences.insert_one(sequence)

        await db.kinds.insert_one(kind)

    await virtool.db.processes.update(db, dispatch, process_id, 0.7, "create_history")

    for kind in kinds:
        # Join the kind document into a complete kind record. This will be used for recording history.
        joined = await virtool.db.kinds.join(db, kind["_id"])

        # Build a ``description`` field for the kind creation change document.
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

    await virtool.db.processes.update(db, dispatch, process_id, 1)
