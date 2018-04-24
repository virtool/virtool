import pymongo
from pymongo import InsertOne, ReturnDocument

import virtool.db.history
import virtool.db.kinds
import virtool.db.utils
import virtool.errors
import virtool.kinds
import virtool.refs
import virtool.utils


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
    return virtool.db.history.get_contributors(db, {"ref.id": ref_id})


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
        users = [virtool.refs.get_owner_user(user_id)]

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

    users = await db.users.find({}, ["_id", "administrator", "permissions"])

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


async def import_file(db, dispatch, ref_id, data, user_id):
    """
    Import a previously exported Virtool kind reference.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param dispatch: the dispatcher's dispatch function
    :type dispatch: func

    :param ref_id: the id of the ref to import data for
    :type ref_id: str

    :param data: the kind data to import
    :type data: dict

    :param user_id: the requesting ``user_id``
    :type user_id: str

    """
    kinds = data["data"]

    await db.status.replace_one({"_id": "virus_import"}, {"_id": "virus_import"}, upsert=True)

    document = await db.status.find_one_and_update({"_id": "virus_import"}, {
        "$set": {
            "version": data["version"],
            "file_created_at": data["created_at"],
            "errors": None,
            "duplicates": None
        }
    }, return_document=ReturnDocument.AFTER)

    await dispatch("status", "update", virtool.utils.base_processor(document))

    duplicates, errors = virtool.refs.validate_kinds(kinds)

    if duplicates or errors:
        document = await db.status.find_one_and_update({"_id": "virus_import"}, {
            "$set": {
                "errors": errors,
                "duplicates": duplicates
            }
        }, return_document=ReturnDocument.AFTER)

        return await dispatch("status", "update", virtool.utils.base_processor(document))

    isolate_counts = list()
    sequence_counts = list()

    for kind in kinds:
        isolates = kind["isolates"]
        isolate_counts.append(len(isolates))

        for isolate in isolates:
            sequence_counts.append(len(isolate["sequences"]))

    document = await db.status.find_one_and_update({"_id": "virus_import"}, {
        "$set": {
            "inserted": 0,
            "totals": {
                "kinds": len(kinds),
                "isolates": sum(isolate_counts),
                "sequences": sum(sequence_counts)
            }
        }
    }, return_document=ReturnDocument.AFTER)

    await dispatch("status", "update", virtool.utils.base_processor(document))

    _kind_buffer = list()
    _sequence_buffer = list()

    for kind in kinds:
        document, sequences = virtool.kinds.split(kind)

        document.update({
            "lower_name": document["name"].lower(),
            "last_indexed_version": None,
            "created_at": virtool.utils.timestamp(),
            "verified": True,
            "version": 0
        })

        _kind_buffer.append(document)

        for sequence in sequences:
            _sequence_buffer.append(sequence)

        if len(_kind_buffer) == 50:
            await db.kinds.insert_many(_kind_buffer)

            document = await db.status.find_one_and_update({"_id": "virus_import"}, {
                "$inc": {
                    "inserted": 50,
                }
            }, return_document=ReturnDocument.AFTER)

            await dispatch("status", "update", virtool.utils.base_processor(document))

            _kind_buffer = list()

        if len(_sequence_buffer) == 50:
            await db.sequences.insert_many(_sequence_buffer)
            _sequence_buffer = list()

    kind_buffer_length = len(_kind_buffer)

    if kind_buffer_length:
        await db.kinds.insert_many(_kind_buffer)

        document = await db.status.find_one_and_update({"_id": "virus_import"}, {
            "$inc": {
                "inserted": kind_buffer_length,
            }
        }, return_document=ReturnDocument.AFTER)

        await dispatch("status", "update", virtool.utils.base_processor(document))

    if len(_sequence_buffer):
        await db.sequences.insert_many(_sequence_buffer)

    for kind in kinds:
        # Join the kind document into a complete kind record. This will be used for recording history.
        joined = await virtool.db.kinds.join(db, kind["_id"])

        # Build a ``description`` field for the kind creation change document.
        description = "Created {}".format(joined["name"])

        abbreviation = document.get("abbreviation", None)

        # Add the abbreviation to the description if there is one.
        if abbreviation:
            description += " ({})".format(abbreviation)

        await virtool.db.history.add(
            db,
            "create",
            None,
            joined,
            description,
            ref_id,
            user_id
        )

    await dispatch("status", "update", virtool.utils.base_processor(document))


async def insert_from_import(db, kind_document, user_id):
    """
    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param kind_document: the kind document to add
    :type kind_document: dict

    :param user_id: the requesting ``user_id``
    :type user_id: str

    """
    # Modified is set to ``False`` so the user does not have to verify every single imported kind.
    kind_document.update({
        "version": 0,
        "last_indexed_version": None,
        "lower_name": kind_document["name"].lower(),
        "imported": True,
        "verified": False
    })

    # Perform the actual database insert operation, retaining the response.
    await db.kinds.insert_one(kind_document)

    issues = await virtool.db.kinds.verify(db, kind_document["_id"], kind_document)

    if issues is None:
        await db.kinds.update_one({"_id": kind_document["_id"]}, {
            "$set": {
                "verified": True
            }
        })

        kind_document["verified"] = True

    to_dispatch = virtool.utils.base_processor({key: kind_document[key] for key in virtool.kinds.LIST_PROJECTION})

    joined = await virtool.db.kinds.join(db, kind_document["_id"])

    change = await virtool.db.history.add(
        db,
        "create",
        None,
        joined,
        "Created {}".format(kind_document["name"]),
        user_id
    )

    change_to_dispatch = {key: change[key] for key in virtool.db.history.LIST_PROJECTION}

    change_to_dispatch = virtool.utils.base_processor(change_to_dispatch)

    return to_dispatch, change_to_dispatch
