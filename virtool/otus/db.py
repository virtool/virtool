import pymongo.errors
import copy

import virtool.history.db
import virtool.db.utils
import virtool.errors
import virtool.history.utils
import virtool.otus.utils
import virtool.utils
from virtool.api import compose_regex_query, paginate

PROJECTION = [
    "_id",
    "abbreviation",
    "name",
    "reference",
    "verified",
    "version"
]

SEQUENCE_PROJECTION = [
    "_id",
    "definition",
    "host",
    "otu_id",
    "isolate_id",
    "sequence",
    "segment"
]


async def add_isolate(db, otu_id, data, user_id):
    document = await db.otus.find_one(otu_id)

    isolates = copy.deepcopy(document["isolates"])

    # True if the new isolate should be default and any existing isolates should be non-default.
    will_be_default = not isolates or data["default"]

    # Get the complete, joined entry before the update.
    old = await virtool.otus.db.join(db, otu_id, document)

    # Set ``default`` to ``False`` for all existing isolates if the new one should be default.
    if isolates and data["default"]:
        for isolate in isolates:
            isolate["default"] = False

    # Force the new isolate as default if it is the first isolate.
    if not isolates:
        data["default"] = True

    # Set the isolate as the default isolate if it is the first one.
    data["default"] = will_be_default

    isolate_id = await virtool.otus.db.append_isolate(db, otu_id, isolates, data)

    # Get the joined entry now that it has been updated.
    new = await virtool.otus.db.join(db, otu_id)

    await virtool.otus.db.update_verification(db, new)

    isolate_name = virtool.otus.utils.format_isolate_name(data)

    description = f"Added {isolate_name}"

    if will_be_default:
        description += " as default"

    await virtool.history.db.add(
        db,
        "add_isolate",
        old,
        new,
        description,
        user_id
    )

    return dict(data, id=isolate_id, sequences=[])


async def append_isolate(db, otu_id, isolates, isolate):
    try:
        isolate_id = virtool.utils.random_alphanumeric(length=3)

        # Push the new isolate to the database.
        await db.otus.update_one({"_id": otu_id}, {
            "$set": {
                "isolates": [*isolates, dict(isolate, id=isolate_id)],
                "verified": False
            },
            "$inc": {
                "version": 1
            }
        })

        return isolate_id

    except pymongo.errors.DuplicateKeyError:
        return await append_isolate(db, otu_id, isolates, isolate)


async def check_name_and_abbreviation(db, ref_id, name=None, abbreviation=None):
    """
    Check is a otu name and abbreviation are already in use in the reference identified by `ref_id`. Returns a message
    if the ``name`` or ``abbreviation`` are already in use. Returns ``False`` if they are not in use.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param ref_id: the id of the reference to check in
    :type ref_id: str

    :param name: a otu name
    :type name: str

    :param abbreviation: a otu abbreviation
    :type abbreviation: str

    """
    name_count = 0

    if name:
        name_count = await db.otus.count({
            "lower_name": name.lower(),
            "reference.id": ref_id
        })

    abbr_count = 0

    if abbreviation:
        abbr_count = await db.otus.count({
            "abbreviation": abbreviation,
            "reference.id": ref_id
        })

    unique_name = not name or not name_count
    unique_abbreviation = not abbreviation or not abbr_count

    if not unique_name and not unique_abbreviation:
        return "Name and abbreviation already exist"

    if not unique_name:
        return "Name already exists"

    if not unique_abbreviation:
        return "Abbreviation already exists"

    return False


async def create(db, ref_id, name, abbreviation, user_id):
    otu_id = await virtool.db.utils.get_new_id(db.otus)

    # Start building a otu document.
    document = {
        "_id": otu_id,
        "name": name,
        "abbreviation": abbreviation,
        "last_indexed_version": None,
        "verified": False,
        "lower_name": name.lower(),
        "isolates": [],
        "version": 0,
        "reference": {
            "id": ref_id
        },
        "schema": []
    }

    # Insert the otu document.
    await db.otus.insert_one(document)

    description = virtool.history.utils.compose_create_description(document)

    change = await virtool.history.db.add(
        db,
        "create",
        None,
        document,
        description,
        user_id
    )

    return virtool.otus.utils.format_otu(document, most_recent_change=change)


async def edit(db, otu_id, old, data, name, abbreviation, schema, user_id):
    # Update the ``modified`` and ``verified`` fields in the otu document now, because we are definitely going to
    # modify the otu.
    data["verified"] = False

    # If the name is changing, update the ``lower_name`` field in the otu document.
    if name:
        data["lower_name"] = name.lower()

    # Update the database collection.
    document = await db.otus.find_one_and_update({"_id": otu_id}, {
        "$set": data,
        "$inc": {
            "version": 1
        }
    })

    await virtool.otus.db.update_sequence_segments(db, old, document)

    new = await virtool.otus.db.join(db, otu_id, document)

    issues = await virtool.otus.db.update_verification(db, new)

    description = virtool.history.utils.compose_edit_description(name, abbreviation, old["abbreviation"], schema)

    await virtool.history.db.add(
        db,
        "edit",
        old,
        new,
        description,
        user_id
    )

    return await virtool.otus.db.join_and_format(db, otu_id, joined=new, issues=issues)


async def edit_isolate(db, otu_id, isolate_id, data, user_id):
    isolates = await virtool.db.utils.get_one_field(db.otus, "isolates", otu_id)
    isolate = virtool.otus.utils.find_isolate(isolates, isolate_id)

    old_isolate_name = virtool.otus.utils.format_isolate_name(isolate)

    isolate.update(data)

    old = await virtool.otus.db.join(db, otu_id)

    # Replace the isolates list with the update one.
    document = await db.otus.find_one_and_update({"_id": otu_id}, {
        "$set": {
            "isolates": isolates,
            "verified": False
        },
        "$inc": {
            "version": 1
        }
    })

    # Get the joined entry now that it has been updated.
    new = await virtool.otus.db.join(db, otu_id, document)

    await virtool.otus.db.update_verification(db, new)

    isolate_name = virtool.otus.utils.format_isolate_name(isolate)

    # Use the old and new entry to add a new history document for the change.
    await virtool.history.db.add(
        db,
        "edit_isolate",
        old,
        new,
        f"Renamed {old_isolate_name} to {isolate_name}",
        user_id
    )

    complete = await virtool.otus.db.join_and_format(db, otu_id, joined=new)

    return virtool.otus.utils.find_isolate(complete["isolates"], isolate_id)


async def find(db, names, term, req_query, verified, ref_id=None):
    db_query = dict()

    if term:
        db_query.update(compose_regex_query(term, ["name", "abbreviation"]))

    if verified is not None:
        db_query["verified"] = virtool.utils.to_bool(verified)

    base_query = None

    if ref_id is not None:
        base_query = {
            "reference.id": ref_id
        }

    if names is True or names == "true":
        cursor = db.otus.find({**db_query, **base_query}, ["name"], sort=[("name", 1)])
        return [virtool.utils.base_processor(d) async for d in cursor]

    data = await paginate(
        db.otus,
        db_query,
        req_query,
        base_query=base_query,
        sort="name",
        projection=PROJECTION
    )

    data["modified_count"] = len(await db.history.find({"index.id": "unbuilt"}, ["otu"]).distinct("otu.name"))

    return data


async def join(db, query, document=None):
    """
    Join the otu associated with the supplied ``otu_id`` with its sequences. If a otu entry is also passed,
    the database will not be queried for the otu based on its id.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param query: the id of the otu to join or a Mongo query.
    :type query: Union[dict,str]

    :param document: use this otu document as a basis for the join instead finding it using the otu id.
    :type document: dict

    :return: the joined otu document
    :rtype: Coroutine[dict]

    """
    # Get the otu entry if a ``document`` parameter was not passed.
    document = document or await db.otus.find_one(query)

    if document is None:
        return None

    cursor = db.sequences.find({"otu_id": document["_id"]})

    # Merge the sequence entries into the otu entry.
    return virtool.otus.utils.merge_otu(document, [d async for d in cursor])


async def join_and_format(db, otu_id, joined=None, issues=False):
    """
    Join the otu identified by the passed ``otu_id`` or use the ``joined`` otu document if available. Then,
    format the joined otu into a format that can be directly returned to API clients.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param otu_id: the id of the otu to join
    :type otu_id: str

    :param joined:
    :type joined: Union[dict, NoneType]

    :param issues: an object describing issues in the otu
    :type issues: Union[dict, NoneType, bool]

    :return: a joined and formatted otu
    :rtype: Coroutine[dict]

    """
    joined = joined or await join(db, otu_id)

    if not joined:
        return None

    most_recent_change = await virtool.history.db.get_most_recent_change(db, otu_id)

    if issues is False:
        issues = await verify(db, otu_id)

    return virtool.otus.utils.format_otu(joined, issues, most_recent_change)


async def remove(db, otu_id, user_id, document=None, silent=False):
    # Join the otu.
    joined = await join(db, otu_id, document=document)

    if not joined:
        return None

    # Remove all sequences associated with the otu.
    await db.sequences.delete_many({"otu_id": otu_id}, silent=True)

    # Remove the otu document itself.
    await db.otus.delete_one({"_id": otu_id}, silent=silent)

    # Unset the reference internal_control if it is the OTU being removed.
    await db.references.update_one({"_id": joined["reference"]["id"], "internal_control.id": joined["_id"]}, {
        "$set": {
            "internal_control": None
        }
    })

    description = virtool.history.utils.compose_remove_description(joined)

    # Add a removal history item.
    await virtool.history.db.add(
        db,
        "remove",
        joined,
        None,
        description,
        user_id,
        silent=silent
    )

    return True


async def update_verification(db, joined):
    issues = virtool.otus.utils.verify(joined)

    if issues is None:
        await db.otus.update_one({"_id": joined["_id"]}, {
            "$set": {
                "verified": True
            }
        })

        joined["verified"] = True


async def set_default_isolate(db, otu_id, isolate_id, user_id):
    document = await db.otus.find_one(otu_id)

    isolate = virtool.otus.utils.find_isolate(document["isolates"], isolate_id)

    # If the default isolate will be unchanged, immediately return the existing isolate.
    if isolate["default"]:
        return isolate

    # Set ``default`` to ``False`` for all existing isolates if the new one should be default.
    isolates = [{**isolate, "default": isolate_id == isolate["id"]} for isolate in document["isolates"]]

    old = await virtool.otus.db.join(db, otu_id)

    # Replace the isolates list with the updated one.
    document = await db.otus.find_one_and_update({"_id": otu_id}, {
        "$set": {
            "isolates": isolates,
            "verified": False
        },
        "$inc": {
            "version": 1
        }
    })

    # Get the joined entry now that it has been updated.
    new = await virtool.otus.db.join(db, otu_id, document)

    await virtool.otus.db.update_verification(db, new)

    isolate_name = virtool.otus.utils.format_isolate_name(isolate)

    # Use the old and new entry to add a new history document for the change.
    await virtool.history.db.add(
        db,
        "set_as_default",
        old,
        new,
        f"Set {isolate_name} as default",
        user_id
    )

    complete = await virtool.otus.db.join_and_format(db, otu_id, new)

    return virtool.otus.utils.find_isolate(new["isolates"], isolate_id)


async def verify(db, otu_id, joined=None):
    """
    Verifies that the associated otu is ready to be included in an index rebuild. Returns verification errors if
    necessary.

    """
    # Get the otu document of interest.
    joined = joined or await join(db, otu_id)

    if not joined:
        raise virtool.errors.DatabaseError(f"Could not find otu '{otu_id}'")

    return virtool.otus.utils.verify(joined)


async def update_last_indexed_version(db, id_list, version):
    """
    Called from a index rebuild job. Updates the last indexed version and _version fields
    of all otu involved in the rebuild when the build completes.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param id_list: a list the ``otu_id`` of each otu to update
    :type id_list: list

    :param version: the value to set for the otu ``version`` and ``last_indexed_version`` fields
    :type: int

    :return: the Pymongo update result
    :rtype: :class:`~pymongo.results.UpdateResult`

    """
    result = await db.otus.update_many({"_id": {"$in": id_list}}, {
        "$set": {
            "last_indexed_version": version,
            "version": version
        }
    })

    return result


async def update_sequence_segments(db, old, new):
    if old is None or new is None or "schema" not in old:
        return

    old_names = {s["name"] for s in old["schema"]}
    new_names = {s["name"] for s in new["schema"]}

    if old_names == new_names:
        return

    to_unset = list(old_names - new_names)

    await db.sequences.update_many({"otu_id": old["_id"], "segment": {"$in": to_unset}}, {
        "$unset": {
            "segment": ""
        }
    })
