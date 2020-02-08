import virtool.utils
import semver
import sys

MINIMUM_MONGO_VERSION = "3.6.0"


def apply_projection(document, projection):
    """
    Apply a Mongo-style projection to a document and return it.

    :param document: the document to project
    :type document: dict

    :param projection: the projection to apply
    :type projection: Union[dict,list]

    :return: the projected document
    :rtype: dict

    """
    if isinstance(projection, list):
        if "_id" not in projection:
            projection.append("_id")

        return {key: document[key] for key in document if key in projection}

    if not isinstance(projection, dict):
        raise TypeError(f"Invalid type for projection: {type(projection)}")

    if projection == {"_id": False}:
        return {key: document[key] for key in document if key != "_id"}

    if all(value is False for value in projection.values()):
        return {key: document[key] for key in document if key not in projection}

    if "_id" not in projection:
        projection["_id"] = True

    return {key: document[key] for key in document if projection.get(key, False)}


async def check_mongo_version(db, logger):
    """
    Check the MongoDB version. Log a critical error and exit if it is too old.

    :param db: the application database object
    :param logger: the app logger

    """
    server_version = (await db.server_info())["version"]

    if semver.compare(server_version, MINIMUM_MONGO_VERSION) == -1:
        logger.critical(f"Virtool requires MongoDB {MINIMUM_MONGO_VERSION}. Found {server_version}.")
        sys.exit(1)

    logger.info(f"Found MongoDB {server_version}.")


async def get_new_id(collection, excluded=None):
    """
    Returns a new, unique, id that can be used for inserting a new document. Will not return any id that is included
    in ``excluded``.

    :param collection: the Mongo collection to get a new _id for
    :type collection: :class:`motor.motor_asyncio.AsyncIOMotorCollection`

    :param excluded: a list of ids to exclude from the search
    :type excluded: Union[list, set]

    :return: an id unique to the collection
    :rtype: str

    """
    excluded = set(excluded or set())

    excluded.update(await collection.distinct("_id"))

    return virtool.utils.random_alphanumeric(length=8, excluded=excluded)


async def get_one_field(collection, field, query):
    projected = await collection.find_one(query, [field])

    if projected is None:
        return None

    return projected.get(field)


async def get_non_existent_ids(collection, id_list):
    existing_group_ids = await collection.distinct("_id", {"_id": {"$in": id_list}})
    return set(id_list) - set(existing_group_ids)


async def id_exists(collection, _id):
    """
    Check if the document id exists in the collection.

    :param collection: the Mongo collection to check the _id against
    :type collection: :class:`motor.motor_asyncio.AsyncIOMotorCollection`

    :param _id: the _id to check for
    :type _id: str

    :return: ``bool`` indicating if the id exists
    :rtype: bool

    """
    return bool(await collection.count_documents({"_id": _id}))


async def ids_exist(collection, id_list):
    """
    Check if all of the ids passed in ``id_list`` exist in the collection.

    :param collection: the Mongo collection to check ``id_list`` against
    :type collection: :class:`motor.motor_asyncio.AsyncIOMotorCollection`

    :param id_list: the ids to check for
    :type id_list: str

    :return: ``bool`` indicating if the ids exist
    :rtype: bool

    """
    return await collection.count_documents({"_id": {"$in": id_list}}) == len(id_list)
