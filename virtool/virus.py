"""
Functions for working with virus documents.

"""

import re
import logging
from copy import deepcopy

import virtool.utils
import virtool.errors
import virtool.virus_history

logger = logging.getLogger(__name__)

LIST_PROJECTION = [
    "_id",
    "name",
    "abbreviation",
    "version",
    "modified",
    "verified"
]

SEQUENCE_PROJECTION = [
    "_id",
    "definition",
    "host",
    "virus_id",
    "isolate_id",
    "sequence"
]


async def dispatch_version_only(req, new):
    """
    Dispatch a virus update. Should be called when the document itself is not being modified.
    
    :param req: the request object
    
    :param new: the virus document
    :type new: Coroutine[dict]
    
    """
    await req.app["dispatcher"].dispatch(
        "viruses",
        "update",
        virtool.utils.base_processor({key: new[key] for key in LIST_PROJECTION})
    )


async def join(db, virus_id, document=None):
    """
    Join the virus associated with the supplied virus id with its sequences. If a virus entry is also passed, the
    database will not be queried for the virus based on its id.
    
    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param virus_id: the id of the virus to join.
    :type virus_id: str

    :param document: use this virus document as a basis for the join instead finding it using the virus id.
    :type document: dict

    :return: the joined virus document
    :rtype: Coroutine[dict]

    """
    # Get the virus entry if a virus parameter was not passed.
    document = document or await db.viruses.find_one(virus_id)

    if document is None:
        return None

    # Get the sequence entries associated with the isolate ids.
    sequences = await db.sequences.find({"virus_id": virus_id}).to_list(None) or list()

    # Merge the sequence entries into the virus entry.
    return merge_virus(document, sequences)


async def join_and_format(db, virus_id, joined=None, issues=False):
    """
    Join the virus identified by the passed ``virus_id`` or use the ``joined`` virus document if available. Then, format
    the joined virus into a format that can be directly returned to API clients.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param virus_id: the id of the virus to join
    :type virus_id: str

    :param joined:
    :type joined: Union[dict, NoneType]

    :param issues: an object describing issues in the virus
    :type issues: Union[dict, NoneType, bool]

    :return: a joined and formatted virus
    :rtype: Coroutine[dict]

    """
    joined = joined or await join(db, virus_id)

    if not joined:
        return None

    joined = virtool.utils.base_processor(joined)

    del joined["lower_name"]

    for isolate in joined["isolates"]:

        for sequence in isolate["sequences"]:
            del sequence["virus_id"]
            del sequence["isolate_id"]

            sequence["id"] = sequence.pop("_id")

    most_recent_change = await virtool.virus_history.get_most_recent_change(db, virus_id)

    if most_recent_change:
        most_recent_change["change_id"] = most_recent_change.pop("_id")

    joined.update({
        "most_recent_change": most_recent_change,
        "issues": issues
    })

    if issues is False:
        joined["issues"] = await verify(db, virus_id)

    return joined


async def check_name_and_abbreviation(db, name=None, abbreviation=None):
    """
    Check is a virus name and abbreviation are already in use in the database. Returns a message if the ``name`` or
    ``abbreviation`` are already in use. Returns ``False`` if they are not in use.
    
    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`
    
    :param name: a virus name
    :type name: str
    
    :param abbreviation: a virus abbreviation
    :type abbreviation: str
    
    """
    name_count = 0

    if name:
        name_count = await db.viruses.count({"lower_name": name.lower()})

    abbr_count = 0

    if abbreviation:
        abbr_count = await db.viruses.find({"abbreviation": abbreviation}).count()

    unique_name = not name or not name_count
    unique_abbreviation = not abbreviation or not abbr_count

    if not unique_name and not unique_abbreviation:
        return "Name and abbreviation already exist"

    if not unique_name:
        return "Name already exists"

    if not unique_abbreviation:
        return "Abbreviation already exists"

    return False


def check_virus(joined):
    """
    Checks that the passed virus and sequences constitute valid Virtool records and can be included in a virus
    index. Error fields are:
    * emtpy_virus - virus has no isolates associated with it.
    * empty_isolate - isolates that have no sequences associated with them.
    * empty_sequence - sequences that have a zero length sequence field.
    * isolate_inconsistency - virus has isolates containing different numbers of sequences.
    
    :param joined: a joined virus
    :type joined: dict
    
    :return: return any errors or False if there are no errors.
    :rtype: Union[dict, None]
    
    """
    errors = {
        "empty_virus": len(joined["isolates"]) == 0,
        "empty_isolate": list(),
        "empty_sequence": list(),
        "isolate_inconsistency": False
    }

    isolate_sequence_counts = list()

    # Append the isolate_ids of any isolates without sequences to empty_isolate. Append the isolate_id and sequence
    # id of any sequences that have an empty sequence.
    for isolate in joined["isolates"]:
        isolate_sequences = isolate["sequences"]
        isolate_sequence_count = len(isolate_sequences)

        # If there are no sequences attached to the isolate it gets an empty_isolate error.
        if isolate_sequence_count == 0:
            errors["empty_isolate"].append(isolate["id"])

        isolate_sequence_counts.append(isolate_sequence_count)

        errors["empty_sequence"] += filter(lambda sequence: len(sequence["sequence"]) == 0, isolate_sequences)

    # Give an isolate_inconsistency error the number of sequences is not the same for every isolate. Only give the
    # error if the virus is not also emtpy (empty_virus error).
    errors["isolate_inconsistency"] = (
        len(set(isolate_sequence_counts)) != 1 and not
        (errors["empty_virus"] or errors["empty_isolate"])
    )

    # If there is an error in the virus, return the errors object. Otherwise return False.
    has_errors = False

    for key, value in errors.items():
        if value:
            has_errors = True
        else:
            errors[key] = False

    if has_errors:
        return errors

    return None


async def verify(db, virus_id, joined=None):
    """
    Verifies that the associated virus is ready to be included in an index rebuild. Returns verification errors if
    necessary.

    """
    # Get the virus document of interest.
    joined = joined or await join(db, virus_id)

    if not joined:
        raise virtool.errors.DatabaseError("Could not find virus '{}'".format(virus_id))

    return check_virus(joined)


async def update_last_indexed_version(db, virus_ids, version):
    """
    Called from a index rebuild job. Updates the last indexed version and _version fields
    of all viruses involved in the rebuild when the build completes.
    
    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`
    
    :param virus_ids: a list the ``virus_id`` of each virus to update
    :type virus_ids: list
    
    :param version: the value to set for the viruses ``version`` and ``last_indexed_version`` fields
    :type: int
    
    :return: the Pymongo update result
    :rtype: :class:`~pymongo.results.UpdateResult`

    """
    result = await db.viruses.update_many({"_id": {"$in": virus_ids}}, {
        "$set": {
            "last_indexed_version": version,
            "version": version
        }
    })

    return result


def get_default_isolate(virus, isolate_processor=None):
    """
    Returns the default isolate dict for the given virus document.

    :param virus: a virus document.
    :type virus: dict
    
    :param isolate_processor: a function to process the default isolate into a desired format.
    :type: func
    
    :return: the default isolate dict.
    :rtype: dict

    """
    # Get the virus isolates with the default flag set to True. This list should only contain one item.
    default_isolates = [isolate for isolate in virus["isolates"] if isolate["default"] is True]

    if len(default_isolates) > 1:
        raise ValueError("Found more than one default isolate")

    if len(default_isolates) == 0:
        raise ValueError("No default isolate found")

    default_isolate = default_isolates[0]

    if isolate_processor:
        default_isolate = isolate_processor(default_isolate)

    return default_isolate


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

    used_isolate_ids += await db.viruses.distinct("isolates.id")

    return virtool.utils.random_alphanumeric(8, excluded=set(used_isolate_ids))


def merge_virus(virus, sequences):
    """
    Merge the given sequences in the given virus document. The virus will gain a ``sequences`` field containing a list
    of its associated sequence documents.

    :param virus: a virus document.
    :type virus: dict

    :param sequences: the sequence documents to merge into the virus.
    :type sequences: list

    :return: the merged virus.
    :rtype: dict

    """
    for isolate in virus["isolates"]:
        isolate["sequences"] = [s for s in sequences if s["isolate_id"] == isolate["id"]]

    return virus


def split_virus(virus):
    """
    Split a merged virus document into a list of sequence documents associated with the virus and a regular virus
    document containing no sequence subdocuments.

    :param virus: the merged virus to split
    :type virus: dict

    :return: a tuple containing the new virus document and a list of sequence documents
    :type: tuple

    """
    sequences = list()

    virus_document = deepcopy(virus)

    for isolate in virus_document["isolates"]:
        sequences += isolate.pop("sequences")

    return virus_document, sequences


def extract_isolate_ids(virus):
    """
    Get the isolate ids from a virus document.

    :param virus: a virus document.
    :return: a list of isolate ids.

    """
    return [isolate["id"] for isolate in virus["isolates"]]


def find_isolate(isolates, isolate_id):
    """
    Return the isolate identified by ``isolate_id`` from a list of isolates.
    
    :param isolates: a list of isolate dicts
    :type isolates: list
    
    :param isolate_id: the isolate_id of the isolate to return
    :type isolate_id: str
    
    :return: an isolate
    :rtype: dict
    
    """
    return next((isolate for isolate in isolates if isolate["id"] == isolate_id), None)


def extract_sequence_ids(virus):
    """
    Extract all sequence ids from a merged virus.

    :param virus: the merged virus
    :type virus: dict

    :return: the sequence ids belonging to ``virus``
    :rtype: list

    """
    sequence_ids = list()

    isolates = virus["isolates"]

    if not isolates:
        raise ValueError("Empty isolates list in merged virus")

    for isolate in isolates:
        if "sequences" not in isolate:
            raise KeyError("Isolate in merged virus missing sequences field")

        if not isolate["sequences"]:
            raise ValueError("Empty sequences list in merged virus")

        sequence_ids += [sequence["_id"] for sequence in isolate["sequences"]]

    return sequence_ids


def get_default_sequences(joined_virus):
    """
    Return a list of sequences from the default isolate of the passed joined virus document.

    :param joined_virus: the joined virus document.
    :type joined_virus: dict
    
    :return: a list of sequences associated with the default isolate.
    :rtype: list

    """
    for isolate in joined_virus["isolates"]:
        if isolate["default"]:
            return isolate["sequences"]


def format_isolate_name(isolate):
    """
    Take a complete or partial isolate ``dict`` and return a readable isolate name.
    
    :param isolate: a complete or partial isolate ``dict`` containing ``source_type`` and ``source_name`` fields.
    :type isolate: dict
    
    :return: an isolate name
    :rtype: str
     
    """
    if not isolate["source_type"] or not isolate["source_name"]:
        return "Unnamed Isolate"

    return " ".join((isolate["source_type"].capitalize(), isolate["source_name"]))
