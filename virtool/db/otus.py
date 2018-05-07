import virtool.db.history
import virtool.db.utils
import virtool.errors
import virtool.utils
import virtool.otus
from virtool.api.utils import compose_regex_query, paginate


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
            "ref.id": ref_id
        })

    abbr_count = 0

    if abbreviation:
        abbr_count = await db.otus.count({
            "abbreviation": abbreviation,
            "ref.id": ref_id
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


async def create(db, ref_id, name, abbreviation):
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
        "ref": {
            "id": ref_id
        },
        "schema": []
    }

    # Insert the otu document.
    await db.otus.insert_one(document)

    return document


async def get_new_isolate_id(db, excluded=None):
    """
    Generates a unique isolate id.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param excluded: a list or set of strings that may not be returned.
    :type excluded: Union[set, list]

    :return: a new unique isolate id
    :rtype: Coroutine[str]

    """
    used_isolate_ids = await db.otus.distinct("isolates.id")

    if excluded:
        used_isolate_ids += excluded

    return virtool.utils.random_alphanumeric(8, excluded=used_isolate_ids)


async def find(db, names, term, req_query, verified, ref_id=None):

    db_query = dict()

    if term:
        db_query.update(compose_regex_query(term, ["name", "abbreviation"]))

    if verified is not None:
        db_query["verified"] = virtool.utils.to_bool(verified)

    base_query = None

    if ref_id is not None:
        base_query = {
            "ref.id": ref_id
        }

    if names is True or names == "true":
        data = await db.otus.find(db_query, ["name"], sort=[("name", 1)]).to_list(None)
        return [virtool.utils.base_processor(d) for d in data]

    data = await paginate(
        db.otus,
        db_query,
        req_query,
        base_query=base_query,
        sort="name",
        projection=virtool.otus.LIST_PROJECTION
    )

    data["modified_count"] = len(await db.history.find({"index.id": "unbuilt"}, ["otu"]).distinct("otu.name"))

    return data


async def join(db, otu_id, document=None):
    """
    Join the otu associated with the supplied ``otu_id`` with its sequences. If a otu entry is also passed,
    the database will not be queried for the otu based on its id.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param otu_id: the id of the otu to join.
    :type otu_id: str

    :param document: use this otu document as a basis for the join instead finding it using the otu id.
    :type document: dict

    :return: the joined otu document
    :rtype: Coroutine[dict]

    """
    # Get the otu entry if a ``document`` parameter was not passed.
    document = document or await db.otus.find_one(otu_id)

    if document is None:
        return None

    # Get the sequence entries associated with the isolate ids.
    sequences = await db.sequences.find({"otu_id": otu_id}).to_list(None) or list()

    # Merge the sequence entries into the otu entry.
    return virtool.otus.merge_otu(document, sequences)


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

    joined = virtool.utils.base_processor(joined)

    most_recent_change = await virtool.db.history.get_most_recent_change(db, otu_id)

    if issues is False:
        issues = await verify(db, otu_id)

    return virtool.otus.format_otu(joined, issues, most_recent_change)


async def remove(db, dispatch, otu_id, user_id, document=None):

    # Join the otu.
    joined = await join(db, otu_id, document=document)

    if not joined:
        return None

    # Remove all sequences associated with the otu.
    await db.sequences.delete_many({"otu_id": otu_id})

    # Remove the otu document itself.
    await db.otus.delete_one({"_id": otu_id})

    description = "Removed {}".format(joined["name"])

    if joined["abbreviation"]:
        description += " ({})".format(joined["abbreviation"])

    await virtool.db.history.add(
        db,
        "remove",
        joined,
        None,
        description,
        user_id
    )

    await dispatch(
        "otus",
        "remove",
        [otu_id]
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
        raise virtool.errors.DatabaseError("Could not find otu '{}'".format(otu_id))

    return virtool.otus.verify(joined)


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

