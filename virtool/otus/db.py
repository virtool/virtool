import pymongo.results
from typing import Union
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


async def check_name_and_abbreviation(db, ref_id: str, name: Union[None, str] = None, abbreviation: Union[None, str] = None):
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


async def create(app, ref_id, name, abbreviation, user_id):
    """
    Create a new OTU.

    :param app: the application object
    :param ref_id: the ID of the parent reference
    :param name: a name for the new OTU
    :param abbreviation: an abbreviation for the new OTU
    :param user_id: the ID of the requesting user
    :return: the joined OTU document

    """
    db = app["db"]

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
        app,
        "create",
        None,
        document,
        description,
        user_id
    )

    return virtool.otus.utils.format_otu(document, most_recent_change=change)


async def edit(app, otu_id: Union[str, None], name: Union[str, None], abbreviation: Union[str, None], schema: Union[str, list], user_id: str):
    """
    Edit an existing OTU identified by `otu_id`. Modifiable fields are `name`, `abbreviation`, and `schema`.

    :param app: the application object
    :param otu_id: the ID of the OTU to edit
    :param name: a new name
    :param abbreviation: a new abbreviation
    :param schema: a new schema
    :param user_id: the requesting user Id
    :return: the updated and joined OTU document

    """
    db = app["db"]

    # Update the ``modified`` and ``verified`` fields in the otu document now, because we are definitely going to
    # modify the otu.
    update = {
        "verified": False
    }

    # If the name is changing, update the ``lower_name`` field in the otu document.
    if name is not None:
        update.update({
            "name": name,
            "lower_name": name.lower()
        })

    if abbreviation is not None:
        update["abbreviation"] = abbreviation

    if schema is not None:
        update["schema"] = schema

    old = await virtool.otus.db.join(db, otu_id)

    # Update the database collection.
    document = await db.otus.find_one_and_update({"_id": otu_id}, {
        "$set": update,
        "$inc": {
            "version": 1
        }
    })

    await virtool.otus.db.update_sequence_segments(db, old, document)

    new = await virtool.otus.db.join(db, otu_id, document)

    issues = await virtool.otus.db.update_verification(db, new)

    description = virtool.history.utils.compose_edit_description(name, abbreviation, old["abbreviation"], schema)

    await virtool.history.db.add(
        app,
        "edit",
        old,
        new,
        description,
        user_id
    )

    return await virtool.otus.db.join_and_format(db, otu_id, joined=new, issues=issues)


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

    data["modified_count"] = len(await db.history.distinct("otu.name", {"index.id": "unbuilt"}))

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


async def join_and_format(db, otu_id: str, joined: Union[dict, None] = None, issues: Union[dict, None, bool] = False) -> Union[dict, None]:
    """
    Join the otu identified by the passed ``otu_id`` or use the ``joined`` otu document if available. Then,
    format the joined otu into a format that can be directly returned to API clients.

    :param db: the application database client
    :param otu_id: the id of the otu to join
    :param joined:
    :param issues: an object describing issues in the otu
    :return: a joined and formatted otu

    """
    joined = joined or await join(db, otu_id)

    if not joined:
        return None

    most_recent_change = await virtool.history.db.get_most_recent_change(db, otu_id)

    if issues is False:
        issues = await verify(db, otu_id)

    return virtool.otus.utils.format_otu(joined, issues, most_recent_change)


async def remove(app, otu_id: str, user_id: str, document: Union[dict, None] = None, silent: bool = False) -> Union[None, bool]:
    """
    Remove and OTU given its `otu_id`. Create a history document to record the change.

    :param app: the application object
    :param otu_id: the ID of the OTU
    :param user_id: the ID of the requesting user
    :param document:
    :param silent: prevents dispatch of the change
    :return: `True` if the removal was successful

    """
    db = app["db"]

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
        app,
        "remove",
        joined,
        None,
        description,
        user_id,
        silent=silent
    )

    return True


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


async def update_last_indexed_version(db, id_list: list, version: int) -> pymongo.results.UpdateResult:
    """
    Called from a index rebuild job. Updates the last indexed version and _version fields
    of all otu involved in the rebuild when the build completes.

    :param db: the application database client
    :param id_list: a list the ``otu_id`` of each otu to update
    :param version: the value to set for the otu ``version`` and ``last_indexed_version`` fields
    :return: the Pymongo update result

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


async def update_verification(db, joined):
    issues = virtool.otus.utils.verify(joined)

    if issues is None:
        await db.otus.update_one({"_id": joined["_id"]}, {
            "$set": {
                "verified": True
            }
        })

        joined["verified"] = True

    return issues
