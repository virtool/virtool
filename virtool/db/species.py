import virtool.db.history
import virtool.errors
import virtool.utils
import virtool.species


async def join(db, species_id, document=None):
    """
    Join the species associated with the supplied ``species_id`` with its sequences. If a species entry is also passed,
    the database will not be queried for the species based on its id.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param species_id: the id of the species to join.
    :type species_id: str

    :param document: use this species document as a basis for the join instead finding it using the species id.
    :type document: dict

    :return: the joined species document
    :rtype: Coroutine[dict]

    """
    # Get the species entry if a ``document`` parameter was not passed.
    document = document or await db.species.find_one(species_id)

    if document is None:
        return None

    # Get the sequence entries associated with the isolate ids.
    sequences = await db.sequences.find({"species_id": species_id}).to_list(None) or list()

    # Merge the sequence entries into the species entry.
    return virtool.species.merge_species(document, sequences)


async def join_and_format(db, species_id, joined=None, issues=False):
    """
    Join the species identified by the passed ``species_id`` or use the ``joined`` species document if available. Then,
    format the joined species into a format that can be directly returned to API clients.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param species_id: the id of the species to join
    :type species_id: str

    :param joined:
    :type joined: Union[dict, NoneType]

    :param issues: an object describing issues in the species
    :type issues: Union[dict, NoneType, bool]

    :return: a joined and formatted species
    :rtype: Coroutine[dict]

    """
    joined = joined or await join(db, species_id)

    if not joined:
        return None

    joined = virtool.utils.base_processor(joined)

    del joined["lower_name"]

    for isolate in joined["isolates"]:

        for sequence in isolate["sequences"]:
            del sequence["species_id"]
            del sequence["isolate_id"]

            sequence["id"] = sequence.pop("_id")

    most_recent_change = await virtool.db.history.get_most_recent_change(db, species_id)

    if most_recent_change:
        most_recent_change["change_id"] = most_recent_change.pop("_id")

    joined.update({
        "most_recent_change": most_recent_change,
        "issues": issues
    })

    if issues is False:
        joined["issues"] = await verify(db, species_id)

    return joined


async def check_name_and_abbreviation(db, name=None, abbreviation=None):
    """
    Check is a species name and abbreviation are already in use in the database. Returns a message if the ``name`` or
    ``abbreviation`` are already in use. Returns ``False`` if they are not in use.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param name: a species name
    :type name: str

    :param abbreviation: a species abbreviation
    :type abbreviation: str

    """
    name_count = 0

    if name:
        name_count = await db.species.count({"lower_name": name.lower()})

    abbr_count = 0

    if abbreviation:
        abbr_count = await db.species.find({"abbreviation": abbreviation}).count()

    unique_name = not name or not name_count
    unique_abbreviation = not abbreviation or not abbr_count

    if not unique_name and not unique_abbreviation:
        return "Name and abbreviation already exist"

    if not unique_name:
        return "Name already exists"

    if not unique_abbreviation:
        return "Abbreviation already exists"

    return False


async def verify(db, species_id, joined=None):
    """
    Verifies that the associated species is ready to be included in an index rebuild. Returns verification errors if
    necessary.

    """
    # Get the species document of interest.
    joined = joined or await join(db, species_id)

    if not joined:
        raise virtool.errors.DatabaseError("Could not find species '{}'".format(species_id))

    return virtool.species.validate_species(joined)


async def update_last_indexed_version(db, species_ids, version):
    """
    Called from a index rebuild job. Updates the last indexed version and _version fields
    of all species involved in the rebuild when the build completes.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param species_ids: a list the ``species_id`` of each species to update
    :type species_ids: list

    :param version: the value to set for the species ``version`` and ``last_indexed_version`` fields
    :type: int

    :return: the Pymongo update result
    :rtype: :class:`~pymongo.results.UpdateResult`

    """
    result = await db.species.update_many({"_id": {"$in": species_ids}}, {
        "$set": {
            "last_indexed_version": version,
            "version": version
        }
    })

    return result


async def get_new_isolate_id(db, excluded=None):
    """
    Generates a unique isolate id.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param excluded: a list or set of strings that may not be returned.
    :type excluded: Union[list, set]

    :return: a new unique isolate id
    :rtype: Coroutine[str]

    """
    used_isolate_ids = excluded or list()

    used_isolate_ids += await db.species.distinct("isolates.id")

    return virtool.utils.random_alphanumeric(8, excluded=set(used_isolate_ids))
