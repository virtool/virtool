import json
import gzip

from copy import deepcopy
from Bio import Entrez, SeqIO

import virtool.gen


@virtool.gen.synchronous
def get_from_ncbi(accession):
    """
    Retrieve the Genbank data associated with the given accession and transform it into a Virtool-format sequence
    document.

    :param accession: the Genbank accession number.
    :return: a sequence document containing relevant Genbank data for the accession.

    """
    Entrez.tool = "Virtool"
    Entrez.email = "ian.boyes@inspection.gc.ca"

    term = "{}[accn]".format(accession)

    gi_handle = Entrez.esearch(db="nucleotide", term=term)
    gi_record = Entrez.read(gi_handle)

    gi_list = gi_record["IdList"]

    if len(gi_list) == 1:
        gb_handle = Entrez.efetch(db="nuccore", id=gi_list[0], rettype="gb", retmode="text")
        gb_record = list(SeqIO.parse(gb_handle, "gb"))

        seq_record = gb_record[0]

        seq_dict = {
            "accession": seq_record.name,
            "sequence": str(seq_record.seq),
            "definition": seq_record.description,
            "host": ""
        }

        for feature in seq_record.features:
            for key, value in feature.qualifiers.items():
                if key == "host":
                    seq_dict["host"] = value[0]

        return seq_dict
    else:
        return None


@virtool.gen.synchronous
def check_virus(virus, sequences):
    """
    Checks that the passed virus and sequences constitute valid Virtool records and can be included in a virus
    index. Error fields are:

    * emtpy_virus - virus has no isolates associated with it.
    * empty_isolate - isolates that have no sequences associated with them.
    * empty_sequence - sequences that have a zero length sequence field.
    * isolate_inconsistency - virus has isolates containing different numbers of sequences.

    :param virus: the virus document.
    :param sequences: a list of sequence documents associated with the virus.
    :return: return any errors or False if there are no errors.

    """
    errors = {
        "empty_virus": len(virus["isolates"]) == 0,  #
        "empty_isolate": list(),
        "empty_sequence": list(),
        "isolate_inconsistency": False
    }

    isolate_sequence_counts = list()

    # Append the isolate_ids of any isolates without sequences to empty_isolate. Append the isolate_id and sequence
    # id of any sequences that have an empty sequence.
    for isolate in virus["isolates"]:
        isolate_sequences = [sequence for sequence in sequences if sequence["isolate_id"] == isolate["isolate_id"]]
        isolate_sequence_count = len(isolate_sequences)

        if isolate_sequence_count == 0:
            errors["empty_isolate"].append(isolate["isolate_id"])

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
        isolate["sequences"] = [sequence for sequence in sequences if sequence["isolate_id"] == isolate["isolate_id"]]

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


def get_default_isolate(virus, processor=None):
    """
    Returns the default isolate dict for the given virus document.

    :param virus: a virus document.
    :type virus: dict
    :param processor: a function to process the default isolate into a desired format.
    :type: func
    :return: the default isolate dict.
    :rtype: dict

    """
    # Get the virus isolates with the default flag set to True. This list should only contain one item.
    default_isolates = [isolate for isolate in virus["isolates"] if virus["default"] is True]

    # Check that there is only one item.
    assert len(default_isolates) == 1

    default_isolate = default_isolates[0]

    if processor:
        default_isolate = processor(default_isolate)

    return default_isolate


@virtool.gen.synchronous
def extract_isolate_ids(virus):
    """
    Get the isolate ids from a virus document.

    :param virus: a virus document.
    :return: a list of isolate ids.

    """
    if not virus["isolates"]:
        raise ValueError("Empty isolates list in virus document")

    return [isolate["isolate_id"] for isolate in virus["isolates"]]


@virtool.gen.synchronous
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


@virtool.gen.synchronous
def read_import_file(path):
    # Load a list of joined virus from a the gzip-compressed JSON.
    with gzip.open(path, "rt") as input_file:
        return [virus for virus in json.load(input_file) if isinstance(virus, dict)]


@virtool.gen.coroutine
def verify_virus_list(viruses):
    fields = ["_id", "name", "abbreviation"]

    seen = {field: set() for field in fields + ["isolate_id", "sequence_id"]}
    duplicates = {field: set() for field in fields + ["isolate_id", "sequence_id"]}

    errors = dict()

    for virus in viruses:

        virus_document, sequences = split_virus(virus)

        errors[virus["name"].lower()] = yield check_virus(virus_document, sequences)

        for field in fields:

            value = virus[field]

            if field == "abbreviation" and value == "":
                continue

            if field == "name":
                value = value.lower()

            if value in seen[field]:
                duplicates[field].add(value)
            else:
                seen[field].add(value)

        for isolate in virus["isolates"]:
            isolate_id = isolate["isolate_id"]

            if isolate_id in seen:
                duplicates["isolate_id"].add(isolate_id)
            else:
                seen["isolate_id"].add(isolate_id)

            for sequence in isolate["sequences"]:
                sequence_id = sequence["_id"]

                if sequence_id in seen["sequence_id"]:
                    duplicates["sequence_id"].add(sequence_id)
                else:
                    seen["sequence_id"].add(sequence_id)

    if not any(duplicates.values()):
        duplicates = None
    else:
        duplicates = {key: list(duplicates[key]) for key in duplicates}

    if not any(errors.values()):
        errors = None

    return duplicates, errors
