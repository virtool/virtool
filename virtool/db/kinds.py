import virtool.db.history
import virtool.errors
import virtool.utils
import virtool.kinds


async def check_name_and_abbreviation(db, name=None, abbreviation=None):
    """
    Check is a kind name and abbreviation are already in use in the database. Returns a message if the ``name`` or
    ``abbreviation`` are already in use. Returns ``False`` if they are not in use.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param name: a kind name
    :type name: str

    :param abbreviation: a kind abbreviation
    :type abbreviation: str

    """
    name_count = 0

    if name:
        name_count = await db.kinds.count({"lower_name": name.lower()})

    abbr_count = 0

    if abbreviation:
        abbr_count = await db.kinds.find({"abbreviation": abbreviation}).count()

    unique_name = not name or not name_count
    unique_abbreviation = not abbreviation or not abbr_count

    if not unique_name and not unique_abbreviation:
        return "Name and abbreviation already exist"

    if not unique_name:
        return "Name already exists"

    if not unique_abbreviation:
        return "Abbreviation already exists"

    return False


async def get_new_isolate_id(db, excluded=None):
    """
    Generates a unique isolate id.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param excluded: a list or set of strings that may not be returned.
    :type excluded: list

    :return: a new unique isolate id
    :rtype: Coroutine[str]

    """
    used_isolate_ids = await db.kinds.distinct("isolates.id")

    if excluded:
        used_isolate_ids += excluded

    return virtool.utils.random_alphanumeric(8, excluded=used_isolate_ids)


async def join(db, kind_id, document=None):
    """
    Join the kind associated with the supplied ``kind_id`` with its sequences. If a kind entry is also passed,
    the database will not be queried for the kind based on its id.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param kind_id: the id of the kind to join.
    :type kind_id: str

    :param document: use this kind document as a basis for the join instead finding it using the kind id.
    :type document: dict

    :return: the joined kind document
    :rtype: Coroutine[dict]

    """
    # Get the kind entry if a ``document`` parameter was not passed.
    document = document or await db.kinds.find_one(kind_id)

    if document is None:
        return None

    # Get the sequence entries associated with the isolate ids.
    sequences = await db.sequences.find({"kind_id": kind_id}).to_list(None) or list()

    # Merge the sequence entries into the kind entry.
    return virtool.kinds.merge_kind(document, sequences)


async def join_and_format(db, kind_id, joined=None, issues=False):
    """
    Join the kind identified by the passed ``kind_id`` or use the ``joined`` kind document if available. Then,
    format the joined kind into a format that can be directly returned to API clients.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param kind_id: the id of the kind to join
    :type kind_id: str

    :param joined:
    :type joined: Union[dict, NoneType]

    :param issues: an object describing issues in the kind
    :type issues: Union[dict, NoneType, bool]

    :return: a joined and formatted kind
    :rtype: Coroutine[dict]

    """
    joined = joined or await join(db, kind_id)

    if not joined:
        return None

    joined = virtool.utils.base_processor(joined)

    del joined["lower_name"]

    for isolate in joined["isolates"]:

        for sequence in isolate["sequences"]:
            del sequence["kind_id"]
            del sequence["isolate_id"]

            sequence["id"] = sequence.pop("_id")

    most_recent_change = await virtool.db.history.get_most_recent_change(db, kind_id)

    if most_recent_change:
        most_recent_change["change_id"] = most_recent_change.pop("_id")

    joined.update({
        "most_recent_change": most_recent_change,
        "issues": issues
    })

    if issues is False:
        joined["issues"] = await verify(db, kind_id)

    return joined


async def verify(db, kind_id, joined=None):
    """
    Verifies that the associated kind is ready to be included in an index rebuild. Returns verification errors if
    necessary.

    """
    # Get the kind document of interest.
    joined = joined or await join(db, kind_id)

    if not joined:
        raise virtool.errors.DatabaseError("Could not find kind '{}'".format(kind_id))

    return virtool.kinds.validate_kind(joined)


async def update_last_indexed_version(db, id_list, version):
    """
    Called from a index rebuild job. Updates the last indexed version and _version fields
    of all kind involved in the rebuild when the build completes.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param id_list: a list the ``kind_id`` of each kind to update
    :type id_list: list

    :param version: the value to set for the kind ``version`` and ``last_indexed_version`` fields
    :type: int

    :return: the Pymongo update result
    :rtype: :class:`~pymongo.results.UpdateResult`

    """
    result = await db.kinds.update_many({"_id": {"$in": id_list}}, {
        "$set": {
            "last_indexed_version": version,
            "version": version
        }
    })

    return result

