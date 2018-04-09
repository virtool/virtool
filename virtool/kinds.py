"""
Functions for working with kind documents.

"""
import logging
from copy import deepcopy

import virtool.errors
import virtool.history
import virtool.utils

logger = logging.getLogger(__name__)

LIST_PROJECTION = [
    "_id",
    "name",
    "abbreviation",
    "version",
    "verified"
]

SEQUENCE_PROJECTION = [
    "_id",
    "definition",
    "host",
    "kind_id",
    "isolate_id",
    "sequence",
    "segment"
]


def check_source_type(settings, source_type):
    """
    Check if the provided `source_type` is valid based on the current server `settings`.

    :param settings: a Virtool settings object
    :type settings: :class:`.Settings`

    :param source_type: the source type to check
    :type source_type: str

    :return: source type is valid
    :rtype: bool

    """
    # Return `False` when source_types are restricted and source_type is not allowed.
    if source_type and settings["restrict_source_types"]:
        return source_type in settings["allowed_source_types"]

    # Return `True` when:
    # - source_type is empty string (unknown)
    # - source_types are not restricted
    # - source_type is an allowed source_type
    return True


async def dispatch_version_only(req, new):
    """
    Dispatch a kind update. Should be called when the document itself is not being modified.

    :param req: the request object

    :param new: the kind document
    :type new: Coroutine[dict]

    """
    await req.app["dispatcher"].dispatch(
        "kinds",
        "update",
        virtool.utils.base_processor({key: new[key] for key in LIST_PROJECTION})
    )


def extract_default_isolate(kind, isolate_processor=None):
    """
    Returns the default isolate dict for the given kind document.

    :param kind: a kind document.
    :type kind: dict

    :param isolate_processor: a function to process the default isolate into a desired format.
    :type: func

    :return: the default isolate dict.
    :rtype: dict

    """
    # Get the kind isolates with the default flag set to True. This list should only contain one item.
    default_isolates = [isolate for isolate in kind["isolates"] if isolate["default"] is True]

    if len(default_isolates) > 1:
        raise ValueError("More than one default isolate found")

    if len(default_isolates) == 0:
        raise ValueError("No default isolate found")

    default_isolate = default_isolates[0]

    if isolate_processor:
        default_isolate = isolate_processor(default_isolate)

    return default_isolate


def extract_default_sequences(joined):
    """
    Return a list of sequences from the default isolate of the passed joined kind document.

    :param joined: the joined kind document.
    :type joined: dict

    :return: a list of sequences associated with the default isolate.
    :rtype: list

    """
    for isolate in joined["isolates"]:
        if isolate["default"]:
            return isolate["sequences"]


def extract_isolate_ids(kind):
    """
    Get the isolate ids from a kind document.

    :param kind: a kind document.
    :return: a list of isolate ids.

    """
    return [isolate["id"] for isolate in kind["isolates"]]


def extract_sequence_ids(kind):
    """
    Extract all sequence ids from a merged kind.

    :param kind: the merged kind
    :type kind: dict

    :return: the sequence ids belonging to ``kind``
    :rtype: list

    """
    sequence_ids = list()

    isolates = kind["isolates"]

    if not isolates:
        raise ValueError("Empty isolates list in merged kind")

    for isolate in isolates:
        if "sequences" not in isolate:
            raise KeyError("Isolate in merged kind missing sequences field")

        if not isolate["sequences"]:
            raise ValueError("Empty sequences list in merged kind")

        sequence_ids += [sequence["_id"] for sequence in isolate["sequences"]]

    return sequence_ids


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


def merge_kind(kind, sequences):
    """
    Merge the given sequences in the given kind document. The kind will gain a ``sequences`` field containing a
    list of its associated sequence documents.

    :param kind: a kind document.
    :type kind: dict

    :param sequences: the sequence documents to merge into the kind.
    :type sequences: list

    :return: the merged kind.
    :rtype: dict

    """
    merged = deepcopy(kind)

    for isolate in merged["isolates"]:
        isolate_id = isolate.get("id", None) or isolate.get("isolate_id", None)
        isolate["sequences"] = [s for s in sequences if s["isolate_id"] == isolate_id]

    return merged


def split(merged):
    """
    Split a merged kind document into a list of sequence documents associated with the kind and a regular kind
    document containing no sequence sub-documents.

    :param merged: the merged kind to split
    :type merged: dict

    :return: a tuple containing the new kind document and a list of sequence documents
    :type: tuple

    """
    sequences = list()

    kind = deepcopy(merged)

    for isolate in kind["isolates"]:
        sequences += isolate.pop("sequences")

    return kind, sequences


def validate_kind(joined):
    """
    Checks that the passed kind and sequences constitute valid Virtool records and can be included in a kind
    index. Error fields are:
    * emtpy_kind - kind has no isolates associated with it.
    * empty_isolate - isolates that have no sequences associated with them.
    * empty_sequence - sequences that have a zero length sequence field.
    * isolate_inconsistency - kind has isolates containing different numbers of sequences.

    :param joined: a joined kind
    :type joined: dict

    :return: return any errors or False if there are no errors.
    :rtype: Union[dict, None]

    """
    errors = {
        "empty_kind": len(joined["isolates"]) == 0,
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
    # error if the kind is not also emtpy (empty_kind error).
    errors["isolate_inconsistency"] = (
        len(set(isolate_sequence_counts)) != 1 and not
        (errors["empty_kind"] or errors["empty_isolate"])
    )

    # If there is an error in the kind, return the errors object. Otherwise return False.
    has_errors = False

    for key, value in errors.items():
        if value:
            has_errors = True
        else:
            errors[key] = False

    if has_errors:
        return errors

    return None
