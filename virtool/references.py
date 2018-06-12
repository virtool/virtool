import gzip
import json
from cerberus import Validator

import virtool.otus

RIGHTS = [
    "build",
    "modify",
    "modify_otu",
    "remove"
]


def check_import_data(import_data, strict=True, verify=True):
    errors = detect_duplicates(import_data["otus"])

    v = Validator(get_import_schema(require_meta=strict), allow_unknown=True)

    v.validate(import_data)

    if v.errors:
        errors.append({
            "id": "file",
            "issues": v.errors
        })

    otus = dict()

    for otu in import_data["otus"]:
        verification = None

        if verify:
            verification = virtool.otus.verify(otu)

        validation = validate_otu(otu, strict)

        issues = dict()

        if verification:
            issues["verification"] = verification

        if validation:
            issues["validation"] = validation

        if issues:
            otus[otu["_id"]] = issues

    return errors


def detect_duplicate_abbreviation(joined, duplicates, seen):
    abbreviation = joined.get("abbreviation", "")

    if abbreviation:
        if abbreviation in seen:
            duplicates.add(abbreviation)
        else:
            seen.add(abbreviation)


def detect_duplicate_ids(joined, duplicate_ids, seen_ids):
    if joined["_id"] in seen_ids:
        duplicate_ids.add(joined["_id"])
    else:
        seen_ids.add(joined["_id"])


def detect_duplicate_isolate_ids(joined, duplicate_isolate_ids):
    duplicates = set()

    isolate_ids = [i["id"] for i in joined["isolates"]]

    for isolate_id in isolate_ids:
        if isolate_ids.count(isolate_id) > 1:
            duplicates.add(isolate_id)

    if duplicates:
        duplicate_isolate_ids[joined["_id"]] = {
            "name": joined["name"],
            "duplicates": list(duplicates)
        }


def detect_duplicate_sequence_ids(joined, duplicate_sequence_ids, seen_sequence_ids):
    sequence_ids = virtool.otus.extract_sequence_ids(joined)

    # Add sequence ids that are duplicated within an OTU to the duplicate set.
    duplicate_sequence_ids.update({i for i in sequence_ids if sequence_ids.count(i) > 1})

    sequence_ids = set(sequence_ids)

    # Add sequence ids that have already been seen and are in the OTU.
    duplicate_sequence_ids.update(seen_sequence_ids & sequence_ids)

    # Add all sequences to seen list.
    seen_sequence_ids.update(sequence_ids)


def detect_duplicate_name(joined, duplicates, seen):
    lowered = joined["name"].lower()

    if joined["name"].lower() in seen:
        duplicates.add(joined["name"])
    else:
        seen.add(lowered)


def detect_duplicates(otus, strict=True):
    duplicate_abbreviations = set()
    duplicate_ids = set()
    duplicate_isolate_ids = dict()
    duplicate_names = set()
    duplicate_sequence_ids = set()

    seen_abbreviations = set()
    seen_ids = set()
    seen_names = set()
    seen_sequence_ids = set()

    for joined in otus:
        detect_duplicate_abbreviation(
            joined,
            duplicate_abbreviations,
            seen_abbreviations
        )

        detect_duplicate_name(
            joined,
            duplicate_names,
            seen_names
        )

        if strict:
            detect_duplicate_ids(
                joined,
                duplicate_ids,
                seen_ids,
            )

            detect_duplicate_isolate_ids(
                joined,
                duplicate_isolate_ids
            )

            detect_duplicate_sequence_ids(
                joined,
                duplicate_sequence_ids,
                seen_sequence_ids
            )

    errors = list()

    if duplicate_abbreviations:
        errors.append({
            "id": "duplicate_abbreviations",
            "message": "Duplicate OTU abbreviations found",
            "duplicates": list(duplicate_abbreviations)
        })

    if duplicate_ids:
        errors.append({
            "id": "duplicate_ids",
            "message": "Duplicate OTU ids found",
            "duplicates": list(duplicate_ids)
        })

    if duplicate_isolate_ids:
        errors.append({
            "id": "duplicate_isolate_ids",
            "message": "Duplicate isolate ids found in some OTUs",
            "duplicates": duplicate_isolate_ids
        })

    if duplicate_names:
        errors.append({
            "id": "duplicate_names",
            "message": "Duplicate OTU names found",
            "duplicates": list(duplicate_names)
        })

    if duplicate_sequence_ids:
        errors.append({
            "id": "duplicate_sequence_ids",
            "message": "Duplicate sequence ids found",
            "duplicates": duplicate_sequence_ids
        })

    return errors


def get_import_schema(require_meta=True):
    return {
        "data_type": {
            "type": "string",
            "required": require_meta
        },
        "organism": {
            "type": "string",
            "required": require_meta
        },
        "otus": {
            "type": "list",
            "required": True
        }
    }


def get_isolate_schema(require_id):
    return {
        "id": {
            "type": "string",
            "required": require_id
        },
        "source_type": {
            "type": "string",
            "required": True
        },
        "source_name": {
            "type": "string",
            "required": True
        },
        "default": {
            "type": "boolean",
            "required": True
        },
        "sequences": {
            "type": "list",
            "required": True
        }
    }


def get_otu_schema(require_id):
    return {
        "_id": {
            "type": "string",
            "required": require_id
        },
        "abbreviation": {
            "type": "string"
        },
        "name": {
            "type": "string",
            "required": True
        },
        "isolates": {
            "type": "list",
            "required": True
        }
    }


def get_owner_user(user_id):
    return {
        "id": user_id,
        "build": True,
        "modify": True,
        "modify_otu": True,
        "remove": True
    }


def get_sequence_schema(require_id):
    return {
        "_id": {
            "type": "string",
            "required": require_id
        },
        "accession": {
            "type": "string",
            "required": True
        },
        "definition": {
            "type": "string",
            "required": True
        },
        "sequence": {
            "type": "string",
            "required": True
        }
    }


def load_reference_file(path):
    """
    Load a list of merged otus documents from a file associated with a Virtool reference file.

    :param path: the path to the otus.json.gz file
    :type path: str

    :return: the otus data to import
    :rtype: dict

    """
    with open(path, "rb") as handle:
        with gzip.open(handle, "rt") as gzip_file:
            return json.load(gzip_file)


def validate_otu(otu, strict):
    report = {
        "otu": None,
        "isolates": dict(),
        "sequences": dict()
    }

    otu_validator = Validator(get_otu_schema(strict), allow_unknown=True)

    if not otu_validator.validate(otu):
        report["otu"] = otu_validator.errors

    report["isolates"] = dict()

    if "isolates" in otu:
        isolate_validator = Validator(get_isolate_schema(strict), allow_unknown=True)
        sequence_validator = Validator(get_sequence_schema(strict), allow_unknown=True)

        for isolate in otu["isolates"]:
            if not isolate_validator.validate(isolate):
                report["isolates"][isolate["id"]] = isolate_validator.errors

            if "sequences" in isolate:
                for sequence in isolate["sequences"]:
                    if not sequence_validator.validate(sequence):
                        report["sequences"][sequence["_id"]] = isolate_validator.errors

    if any(value for value in report.values()):
        return report
