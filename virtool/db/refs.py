import pymongo
from pymongo import ReturnDocument

import virtool.db
import virtool.db.kinds
import virtool.errors
import virtool.kinds
import virtool.refs
import virtool.utils


async def clone(db, name, user_id, source_id):

    source = await db.references.find_one(source_id)

    if source is None:
        raise ValueError("Source not found")

    ref = await create(
        db,
        name,
        source["organism"],
        user_id=user_id,
        data_type=source["data_type"],
        users=[virtool.refs.get_owner_user(user_id)],
        cloned_from={
            "id": source["_id"]
        }
    )

    created_at = virtool.utils.timestamp()

    async for source_virus in db.targets.find({"_id": source["_id"]}):
        source_virus.update({
            "_id": await virtool.utils.get_new_id("targets"),
            "version": 0,
            "created_at": created_at,
            "ref": {
                "id": ref["_id"]
            }
        })


async def create(db, name, organism, user_id=None, cloned_from=None, created_at=None, data_type="whole_genome", github=None, imported_from=None, public=False, ref_id=None, ready=False, users=None):

    created_at = created_at or virtool.utils.timestamp()

    if await db.references.count({"_id": ref_id}):
        raise virtool.errors.DatabaseError("ref_id already exists")

    ref_id = ref_id or await virtool.utils.get_new_id(db.viruses)

    user = None

    if user_id:
        user = {
            "id": user_id
        }

    users = users or list()

    if not any(user["id"] == user_id for user in users):
        users.append(get_owner_user(user_id))

    document = {
        "_id": ref_id,
        "created_at": created_at,
        "data_type": data_type,
        "name": name,
        "organism": organism,
        "public": public,
        "ready": ready,
        "users": users,
        "user": user
    }

    if len([x for x in (cloned_from, github) if x]):
        raise ValueError("Can only take one of cloned_from, github, imported_from")

    if cloned_from:
        source = await db.references.find_one({"_id": cloned_from}, ["name", "organism"])

        if source is None:
            raise virtool.errors.DatabaseError("Clone source ref does not exist")

        document["cloned_from"] = {
            "id": cloned_from,
            "name": source["name"]
        }

    if github:
        document["github"] = github

    await db.references.insert_one(document)

    return document


async def create_original(db):
    # The `created_at` value should be the `created_at` value for the earliest history document.
    first_change = await db.history.find_one({}, ["created_at"], sort=[("created_at", pymongo.ASCENDING)])
    created_at = first_change["created_at"]

    # The reference is `ready` if at least one of the original indexes is ready.
    ready = bool(await db.indexes.count({"ready": True}))

    users = await db.users.find({}, ["_id", "administrator", "permissions"])

    for user in users:
        permissions = users.pop("permissions")

        users.update({
            "modify": user["administrator"],
            "modify_viruses": permissions.get("modify_virus", False)
        })

    return await create(db, "Original", "Virus", created_at=created_at, public=True, ref_id="original", ready=ready)


async def get_last_build(db, ref_id):
    document = await db.indexes.find_one({"ref.id": ref_id}, ["created_at", "user"])
    return virtool.utils.base_processor(document)


async def import_data(db, dispatch, data, user_id):
    """
    Import a previously exported Virtool virus reference.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param dispatch: the dispatcher's dispatch function
    :type dispatch: func

    :param data: the virus data to import
    :type data: dict

    :param user_id: the requesting ``user_id``
    :type user_id: str

    """
    viruses = data["data"]

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

    duplicates, errors = verify_virus_list(viruses)

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

    for virus in viruses:
        isolates = virus["isolates"]
        isolate_counts.append(len(isolates))

        for isolate in isolates:
            sequence_counts.append(len(isolate["sequences"]))

    document = await db.status.find_one_and_update({"_id": "virus_import"}, {
        "$set": {
            "inserted": 0,
            "totals": {
                "viruses": len(viruses),
                "isolates": sum(isolate_counts),
                "sequences": sum(sequence_counts)
            }
        }
    }, return_document=ReturnDocument.AFTER)

    await dispatch("status", "update", virtool.utils.base_processor(document))

    _virus_buffer = list()
    _sequence_buffer = list()

    for virus in viruses:
        document, sequences = virtool.kinds.split_species(virus)

        document.update({
            "lower_name": document["name"].lower(),
            "last_indexed_version": None,
            "created_at": virtool.utils.timestamp(),
            "verified": True,
            "version": 0
        })

        _virus_buffer.append(document)

        for sequence in sequences:
            _sequence_buffer.append(sequence)

        if len(_virus_buffer) == 50:
            await db.viruses.insert_many(_virus_buffer)

            document = await db.status.find_one_and_update({"_id": "virus_import"}, {
                "$inc": {
                    "inserted": 50,
                }
            }, return_document=ReturnDocument.AFTER)

            await dispatch("status", "update", virtool.utils.base_processor(document))

            _virus_buffer = list()

        if len(_sequence_buffer) == 50:
            await db.sequences.insert_many(_sequence_buffer)
            _sequence_buffer = list()

    virus_buffer_length = len(_virus_buffer)

    if virus_buffer_length:
        await db.viruses.insert_many(_virus_buffer)

        document = await db.status.find_one_and_update({"_id": "virus_import"}, {
            "$inc": {
                "inserted": virus_buffer_length,
            }
        }, return_document=ReturnDocument.AFTER)

        await dispatch("status", "update", virtool.utils.base_processor(document))

    if len(_sequence_buffer):
        await db.sequences.insert_many(_sequence_buffer)

    for virus in viruses:
        # Join the virus document into a complete virus record. This will be used for recording history.
        joined = await virtool.db.kinds.join(db, virus["_id"])

        # Build a ``description`` field for the virus creation change document.
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
            user_id
        )

    await dispatch("status", "update", virtool.utils.base_processor(document))


async def check_import_abbreviation(db, virus_document, lower_name=None):
    """
    Check if the abbreviation for a virus document to be imported already exists in the database. If the abbreviation
    exists, set the ``abbreviation`` field in the virus document to an empty string and return warning text to
    send to the client.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param virus_document: the virus document that is being imported
    :type virus_document: dict

    :param lower_name: the name of the virus coerced to lowercase
    :type lower_name: str

    """
    lower_name = lower_name or virus_document["name"].lower()

    # Check if abbreviation exists already.
    virus_with_abbreviation = None

    # Don't count empty strings as duplicate abbreviations!
    if virus_document["abbreviation"]:
        virus_with_abbreviation = await db.viruses.find_one({"abbreviation": virus_document["abbreviation"]})

    if virus_with_abbreviation and virus_with_abbreviation["lower_name"] != lower_name:
        # Remove the imported virus's abbreviation because it is already assigned to an existing virus.
        virus_document["abbreviation"] = ""

        # Record a message for the user.
        return "Abbreviation {} already existed for virus {} and was not assigned to new virus {}.".format(
            virus_with_abbreviation["abbreviation"], virus_with_abbreviation["name"], virus_document["name"]
        )

    return None


async def insert_from_import(db, virus_document, user_id):
    """
    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param virus_document: the virus document to add
    :type virus_document: dict

    :param user_id: the requesting ``user_id``
    :type user_id: str

    """
    # Modified is set to ``False`` so the user does not have to verify every single imported virus.
    virus_document.update({
        "version": 0,
        "last_indexed_version": None,
        "lower_name": virus_document["name"].lower(),
        "imported": True,
        "verified": False
    })

    # Perform the actual database insert operation, retaining the response.
    await db.viruses.insert_one(virus_document)

    issues = await virtool.db.kinds.verify(db, virus_document["_id"], virus_document)

    if issues is None:
        await db.viruses.update_one({"_id": virus_document["_id"]}, {
            "$set": {
                "verified": True
            }
        })

        virus_document["verified"] = True

    to_dispatch = virtool.utils.base_processor({key: virus_document[key] for key in virtool.kinds.LIST_PROJECTION})

    joined = await virtool.db.kinds.join(db, virus_document["_id"])

    change = await virtool.db.history.add(
        db,
        "create",
        None,
        joined,
        "Created {}".format(virus_document["name"]),
        user_id
    )

    change_to_dispatch = {key: change[key] for key in virtool.db.history.LIST_PROJECTION}

    change_to_dispatch = virtool.utils.base_processor(change_to_dispatch)

    return to_dispatch, change_to_dispatch


async def delete_for_import(db, virus_id, user_id):
    """
    Delete a virus document and its sequences as part of an import process.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param virus_id: the ``virus_id`` to remove
    :type virus_id: str

    :param user_id: the requesting ``user_id``
    :type user_id: str

    """
    joined = await virtool.db.kinds.join(db, virus_id)

    if not joined:
        raise ValueError("Could not find virus_id {}".format(virus_id))

    # Perform database operations.
    await db.sequences.delete_many({"isolate_id": {"$in": virtool.kinds.extract_isolate_ids(joined)}})

    await db.viruses.delete_one({"_id": virus_id})

    # Put an entry in the history collection saying the virus was removed.
    change = await virtool.db.history.add(
        db,
        "remove",
        joined,
        None,
        "Removed",
        user_id
    )

    change_to_dispatch = {key: change[key] for key in virtool.db.history.LIST_PROJECTION}

    change_to_dispatch = virtool.utils.base_processor(change_to_dispatch)

    return virus_id, change_to_dispatch
