__author__ = 'igboyes'

import re
import pymongo

import virtool.utils as utils


def generate_id(used, length=6):
    """
    Generates a unique alphanumeric identifier given a list of reserved identifiers and a length for the identifier.

    """
    _id = None

    # Until the _id has a value other than None, the loop will keep looking for an unreserved string.
    while _id is None:
        candidate = utils.random_alphanumeric(length)
        if not candidate in used:
            used.append(candidate)
            _id = candidate

    return _id


def parse_table_and_fasta(table_path, fasta_path):
    # Stores all virus entries and sequence entries
    entries = list()
    sequences = list()

    # Lists of used _ids for viruses and isolates
    used_virus_ids = list()
    used_isolate_ids = list()

    with open(table_path, "r") as table_file:
        entry = dict()

        isolate = None
        isolate_id = None

        for line in table_file:
            # Skip header lines
            if not line.startswith("#") and not line.startswith('"Genome"'):
                if not line.startswith(" "):
                    # If there was a previous entry under construction, save it.
                    if entry:
                        entries.append(entry)

                    # Make base document dict
                    entry = {"isolates": list(), "_version": 0, "new": False, "modified": False}

                    # Generate and 8-character, unique, alphanumeric _id for the virus.
                    entry["_id"] = generate_id(used_virus_ids, 8)

                    # Split the current line for parseing.
                    split = line.strip().split("\t")

                    # The name of the virus.
                    entry["name"] = split[0]

                    # The number of segments in the virus. If the field is empty, set the segment count to 1.
                    try:
                        entry["segments"] = int(split[3])
                    except ValueError:
                        entry["segments"] = 1

                    # The source information for the sample in which the sequence was discovered. Will be attached to
                    # the isolate dict
                    if split[2] == "-":
                        source = ["unknown", "unknown"]
                    else:
                        source = split[2].split(":")

                    # The source data only describes one isolate for each virus. Add this initial isolate to the list
                    # of isolates associated with the virus we are constructing a document for.
                    isolate_id = generate_id(used_isolate_ids, 8)

                    isolate = {
                        "isolate_id": isolate_id,
                        "sequence_count": 0,
                        "source_type": source[0],
                        "source_name": source[1],
                        "default": True
                    }

                    # If the line does specifies an accession, it describes a single-segment record. Add the sequence
                    # accession to the isolate record in this case. Otherwise, accessions will be added from subsequent
                    # lines.
                    if split[1] != "-":
                        # Add isolate entry
                        sequence = {
                            "_id": split[1],
                            "isolate_id": isolate_id,
                            "sequence": []
                        }

                        isolate["sequence_count"] += 1

                        try:
                            sequence["proteins"] = int(split[5])
                        except ValueError:
                            sequence["proteins"] = 0

                        try:
                            sequence["neighbours"] = int(split[6])
                        except ValueError:
                            sequence["neighbours"] = 0

                        sequences.append(sequence)

                    entry["isolates"].append(isolate)

                elif isolate_id and isolate:
                    # This line describes a segment of a multisegment record. Add the accession to the isolate sequence
                    # list.
                    split = re.split(r"\s{2,}", line.strip())

                    sequence = {
                        "_id": split[2],
                        "_version": 0,
                        "proteins": 0,
                        "neighbours": 0,
                        "sequence": [],
                        "isolate_id": isolate_id
                    }

                    for field in split:
                        if "proteins" in field:
                            sequence["proteins"] = int(field.split()[1])
                        if "neighbours" in field:
                            sequence["neighbours"] = int(field.split()[1])

                    assert sequence["sequence"] != ""

                    isolate["sequence_count"] += 1
                    sequences.append(sequence)

    with open(fasta_path, "r") as fasta_file:
        current_index = None
        lookup = {item["_id"]: index for index, item in enumerate(sequences)}

        for line in fasta_file:
            if line.startswith(">"):
                accession = line.split("ref|")[1].split(".")[0]
                current_index = None

                try:
                    current_index = lookup[accession]
                except KeyError:
                    pass
            else:
                if current_index is not None:
                    sequences[current_index]["sequence"].append(line.rstrip())

    for index, sequence in enumerate(sequences):
        sequences[index]["sequence"] = "".join(sequence["sequence"])

        try:
            assert sequences[index]["sequence"] != ""
        except AssertionError:
            print("Entry has no sequence data: ")
            print(sequences[index])
            print()
            do_remove = input("Remove entry? [y]")
            if do_remove != "y":
                raise
            else:
                sequences.remove(sequence)

    for entry in entries:
        assert len(entry["isolates"]) > 0

    return entries, sequences


def attach_gb(sequences, gb):
    gb_dict = {entry["_id"]: entry for entry in gb}

    for i, sequence in enumerate(sequences):
        if sequence["_id"] in gb_dict:
            for key in ["definition", "length", "host"]:
                try:
                    sequences[i][key] = gb_dict[sequence["_id"]][key]
                except KeyError:
                    sequences[i][key] = None
            sequences[i]["annotated"] = True
        else:
            sequences[i]["annotated"] = False

    return sequences


def process_gb(gb_path):
    with open(gb_path, "r") as gb_file:
        chunks = gb_file.read().split("//\n")

    gbs = []

    for chunk in chunks:

        entry = {}

        if not "LOCUS" in chunk:
            continue

        chunk = chunk.split("\n")

        for line in chunk:
            line = line.strip().split()

            if "LOCUS" in line:
                entry["_id"] = line[1]
                entry["length"] = int(line[2])
                entry["molecule_type"] = line[4]
                entry["molecule_structure"] = line[5]

            if "DEFINITION" in line:
                entry["definition"] = " ".join(line[1:]).replace(".", "")

            if "ORGANISM" in line:
                entry["virus"] = " ".join(line[1:]).replace(".", "")
            if "/host" in " ".join(line):
                entry["host"] = prop_line(" ".join(line))

        gbs.append(entry)

    return gbs


def prop_line(line, xref=False):
    sep = line.split("=")[1].replace('"', '')

    if xref:
        sep = sep.split(":")
        key = sep[0]

        if key in ["ATCC", "GeneID", "GI", "GOA", "HSSP", "InterPro", "PDB", "taxon"]:
            key = key.lower()

        elif "Swiss-Prot" in key:
            key = "uniSP"
        else:
            key = "uniTR"

        return (key, sep[1])

    else:
        return sep


def run(db_name, table_path="ncbi/plants.tsv", fasta_path="ncbi/sequences.fa", gb_path="ncbi/annotation.gbff"):
    db = pymongo.MongoClient()[db_name]

    print("Clearing old collections")
    db.samples.remove({})
    db.viruses.remove({})
    db.sequences.remove({})
    db.history.remove({})

    print("Parsing NCBI viral table and FASTA")
    documents, sequences =  parse_table_and_fasta(table_path, fasta_path)

    print("Parsing GB annotations")
    gb = process_gb(gb_path)

    print("Attaching annotations to sequences")
    sequences = attach_gb(sequences, gb)

    print("Inserting viruses")
    db["viruses"].remove({})
    for document in documents:
        db["viruses"].insert(document)

    print("Inserting sequences")
    db["sequences"].remove({})
    for document in sequences:
        db["sequences"].insert(document)

    print("Done")