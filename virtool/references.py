import gzip
import json
from cerberus import Validator

RIGHTS = [
    "build",
    "modify",
    "modify_otu",
    "remove"
]


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
            "type": list,
            "schema": {
                "type": dict,
                "schema": get_sequence_schema(require_id)
            }
        }
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
            "required": require_id
        },
        "sequence": {
            "type": "string",
            "required": True
        }
    }


def get_import_schema(require_id=True, require_meta=True):
    return {
        "data_type": {
            "type": "string",
            "required": require_meta
        },
        "organism": {
            "type": "string",
            "required": require_meta
        },
        "data": {
            "type": "list",
            "schema": {
                "type": dict,
                "schema": get_otu_schema(require_id)
            }
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
            "required": True,
            "schema": get_isolate_schema(require_id)
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


def detect_duplicate_abbreviation(otu, seen, duplicates):
    abbreviation = otu.get("abbreviation", "")

    if abbreviation and abbreviation in seen:
        duplicates.add(abbreviation)
    else:
        seen.add(abbreviation)


def detect_duplicate_isolate_ids(otu, duplicate_isolate_ids):
    duplicates = set()

    isolate_ids = [i["id"] for i in otu["isolates"]]

    for isolate_id in isolate_ids:
        if isolate_ids.count(isolate_id) > 1:
            duplicates.add(isolate_id)

    if duplicates:
        duplicate_isolate_ids[otu["_id"]] = {
            "name": otu["name"],
            "duplicates": list(duplicates)
        }


def detect_duplicate_name(otu, seen, duplicates):
    lowered = otu["name"].lower()

    if otu.lower() in seen:
        duplicates.add(otu["name"])
    else:
        seen.add(lowered)


def detect_duplicates(otus):
    seen_names = set()
    seen_abbreviations = set()

    duplicate_abbreviations = set()
    duplicate_names = set()
    duplicate_isolate_ids = dict()

    for joined in otus:
        detect_duplicate_name(
            joined,
            seen_names,
            duplicate_names
        )

        detect_duplicate_abbreviation(
            joined,
            seen_abbreviations,
            duplicate_abbreviations
        )

        detect_duplicate_isolate_ids(
            joined,
            duplicate_isolate_ids
        )

    return (
        duplicate_abbreviations,
        duplicate_names,
        duplicate_isolate_ids
    )


def load_reference_file(path):
    """
    Load a list of merged otus documents from a file handle associated with a Virtool ``otus.json.gz`` file.

    :param path: the path to the otus.json.gz file
    :type path: str

    :return: the otus data to import
    :rtype: dict

    """
    with open(path, "rb") as handle:
        with gzip.open(handle, "rt") as gzip_file:
            return json.load(gzip_file)


def validate_import_data(import_data, strict=True, verify=True):
    errors = list()

    v = Validator(get_import_schema(require_id=strict, require_meta=strict))

    if not v.validate(import_data):
        return [{
            "id": "missing fields",
            "message": "Some fields are missing",
            "missing": v.errors
        }]

    duplicate_abbreviations, duplicate_names, duplicate_isolate_ids = detect_duplicates(import_data["data"])

    if duplicate_abbreviations:
        errors.append({
            "id": "duplicate_abbreviations",
            "message": "Duplicate OTU abbreviations found",
            "duplicates": duplicate_abbreviations
        })

    if duplicate_names:
        errors.append({
            "id": "duplicate_names",
            "message": "Duplicate OTU names found",
            "duplicates": duplicate_abbreviations
        })

    if duplicate_isolate_ids:
        errors.append({
            "id": "duplicate_isolate_ids",
            "message": "Duplicate isolate ids found in some OTUs",
            "duplicates": duplicate_isolate_ids
        })

    if verify:
        pass

    return errors or None
