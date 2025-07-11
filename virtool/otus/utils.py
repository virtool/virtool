from contextlib import suppress
from copy import deepcopy

from virtool.types import Document
from virtool.utils import base_processor


def evaluate_changes(data: dict, document: dict) -> tuple[str, str, Document]:
    name = data.get("name")
    abbreviation = data.get("abbreviation")
    schema = data.get("schema")

    with suppress(AttributeError):
        name = name.strip()

    with suppress(AttributeError):
        abbreviation = abbreviation.strip()

    if name == document["name"]:
        name = None

    old_abbreviation = document.get("abbreviation", "")

    if abbreviation == old_abbreviation:
        abbreviation = None

    if schema == document.get("schema"):
        schema = None

    return name, abbreviation, schema


def extract_sequence_ids(otu: dict) -> list[str]:
    """Extract all sequence ids from a merged otu.

    :param otu: the merged otu

    :return: the sequence ids belonging to ``otu``
    """
    sequence_ids = []

    isolates = otu["isolates"]

    if not isolates:
        raise ValueError("Empty isolates list in merged otu")

    for isolate in isolates:
        if "sequences" not in isolate:
            raise KeyError("Isolate in merged otu missing sequences field")

        if not isolate["sequences"]:
            raise ValueError("Empty sequences list in merged otu")

        sequence_ids += [sequence["_id"] for sequence in isolate["sequences"]]

    return sequence_ids


def find_isolate(isolates: list[dict], isolate_id: str) -> dict:
    """Return the isolate identified by ``isolate_id`` from a list of isolates.

    :param isolates: a list of isolate dicts
    :param isolate_id: the isolate_id of the isolate to return
    :return: an isolate

    """
    return next((isolate for isolate in isolates if isolate["id"] == isolate_id), None)


def format_otu(
    joined: Document | None,
    issues: Document | bool | None = False,
    most_recent_change: Document | None = None,
) -> Document:
    """Join and format an OTU.

    Join the otu identified by the passed ``otu_id`` or use the ``joined`` otu document
    if available. Then, format the joined otu into a format that can be directly
    returned to API clients.

    :param joined:
    :param issues: an object describing issues in the otu
    :param most_recent_change: a change document for the most recent change made to OTU
    :return: a joined and formatted otu

    """
    formatted = base_processor(joined)

    del formatted["lower_name"]

    for isolate in formatted["isolates"]:
        for sequence in isolate["sequences"]:
            del sequence["otu_id"]
            del sequence["isolate_id"]

            sequence["id"] = sequence.pop("_id")

    formatted["most_recent_change"] = None

    if most_recent_change:
        formatted["most_recent_change"] = base_processor(most_recent_change)

    if issues is False:
        issues = verify(joined)

    formatted["issues"] = issues

    return formatted


def format_isolate_name(isolate: Document) -> str:
    """Take a complete or partial isolate ``dict`` and return a readable isolate name.

    :param isolate: an isolate containing source_type and source_name fields
    :return: an isolate name
    """
    if not isolate["source_type"] or not isolate["source_name"]:
        return "Unnamed Isolate"

    return " ".join((isolate["source_type"].capitalize(), isolate["source_name"]))


def merge_otu(otu: dict, sequences: list[dict]) -> dict:
    """Merge the given sequences in the given otu document.

    The otu will gain a ``sequences`` field containing a list of its associated sequence
    documents.

    :param otu: a otu document.
    :param sequences: the sequence documents to merge into the otu.

    :return: the merged otu.

    """
    merged = deepcopy(otu)

    for isolate in merged["isolates"]:
        isolate_id = isolate["id"]
        isolate["sequences"] = [s for s in sequences if s["isolate_id"] == isolate_id]

    return merged


def split(merged: Document) -> tuple[Document, list[Document]]:
    """Split a merged OTU into an reduced OTU and list of associated sequences.

    The returned OTU contains no sequence sub-documents.

    :param merged: the merged otu to split
    :return: a tuple containing the new otu document and a list of sequence documents
    """
    sequences = []

    otu = deepcopy(merged)

    for isolate in otu["isolates"]:
        sequences += isolate.pop("sequences")

    return otu, sequences


def verify(joined: Document) -> bool | Document | None:
    """Check that the passed OTU is valid.

    This function must be called on a joined OTU (contains sequences sub-documents). Any
    OTUs being included in a new index must be verified.

    Error fields are:
    * emtpy_otu - otu has no isolates associated with it.
    * empty_isolate - isolates that have no sequences associated with them.
    * empty_sequence - sequences that have a zero length sequence field.
    * isolate_inconsistency - otu has different sequence counts between isolates.

    :param joined: a joined otu
    :return: return any errors or False if there are no errors.

    """
    errors = {
        "empty_otu": len(joined["isolates"]) == 0,
        "empty_isolate": [],
        "empty_sequence": [],
        "isolate_inconsistency": False,
    }

    isolate_sequence_counts = []

    # Append the isolate_ids of any isolates without sequences to empty_isolate. Append
    # the isolate_id and sequence id of any sequences that have an empty sequence.
    for isolate in joined["isolates"]:
        isolate_sequences = isolate["sequences"]
        isolate_sequence_count = len(isolate_sequences)

        # If there are no sequences attached to the isolate it gets an empty_isolate
        # error.
        if isolate_sequence_count == 0:
            errors["empty_isolate"].append(isolate["id"])

        isolate_sequence_counts.append(isolate_sequence_count)

        errors["empty_sequence"] += filter(
            lambda sequence: len(sequence["sequence"]) == 0,
            isolate_sequences,
        )

    # Give an isolate_inconsistency error the number of sequences is not the same for
    # every isolate. Only give the error if the otu is not also emtpy (empty_otu error).
    errors["isolate_inconsistency"] = len(set(isolate_sequence_counts)) != 1 and not (
        errors["empty_otu"] or errors["empty_isolate"]
    )

    # If there is an error in the otu, return the errors object. Otherwise return False.
    has_errors = False

    for key, value in errors.items():
        if value:
            has_errors = True
        else:
            errors[key] = False

    if has_errors:
        return errors

    return None


def format_fasta_entry(
    otu_name: str,
    isolate_name: str,
    sequence_id: str,
    sequence: str,
) -> str:
    """Create a FASTA header and sequence block for an OTU sequence.

    :param otu_name: the otu name to include in the header
    :param isolate_name: the isolate name to include in the header
    :param sequence_id: the sequence id to include in the header
    :param sequence: the sequence for the FASTA entry
    :return: a FASTA entry

    """
    return f">{otu_name}|{isolate_name}|{sequence_id}|{len(sequence)}\n{sequence}"


def format_fasta_filename(*parts: str) -> str:
    """Format a FASTA filename of the form "otu.isolate.sequence_id.fa".

    :param parts: the filename parts
    :return: a compound FASTA filename

    """
    if len(parts) > 3:
        raise ValueError("Unexpected number of filename parts")

    if len(parts) == 0:
        raise ValueError("At least one filename part required")

    filename = ".".join(parts).replace(" ", "_") + ".fa"

    return filename.lower()
