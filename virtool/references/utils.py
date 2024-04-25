import gzip
import json
from datetime import datetime
from operator import itemgetter
from pathlib import Path
from typing import Dict, List, Optional, Set

from cerberus import Validator
from pydantic import BaseModel
from virtool_core.models.reference import ReferenceDataType

import virtool.otus.utils

RIGHTS = ["build", "modify", "modify_otu", "remove"]


class ReferenceSourceData(BaseModel):
    data_type: ReferenceDataType = ReferenceDataType.genome
    organism: str = "Unknown"
    otus: List[Dict]
    targets: Optional[List[Dict]] = None


def check_import_data(
    data: Dict,
    strict: bool = True,
    verify: bool = True,
) -> List[dict]:
    errors = detect_duplicates(data["otus"])

    v = Validator(get_import_schema(require_meta=strict), allow_unknown=True)

    v.validate(data)

    if v.errors:
        errors.append({"id": "file", "issues": v.errors})

    otus = {}

    for otu in data["otus"]:
        verification = None

        if verify:
            verification = virtool.otus.utils.verify(otu)

        validation = validate_otu(otu, strict)

        issues = {}

        if verification:
            issues["verification"] = verification

        if validation:
            issues["validation"] = validation

        if issues:
            otus[otu["_id"]] = issues

    return errors


def check_will_change(old: dict, imported: dict) -> bool:
    for key in ["name", "abbreviation"]:
        if old[key] != imported[key]:
            return True

    # Will change if isolate ids have changed, meaning an isolate has been added or
    # removed.
    if {i["id"] for i in old["isolates"]} != {i["id"] for i in imported["isolates"]}:
        return True

    # Will change if the schema has changed.
    if json.dumps(old["schema"], sort_keys=True) != json.dumps(
        imported["schema"],
        sort_keys=True,
    ):
        return True

    new_isolates = sorted(imported["isolates"], key=itemgetter("id"))
    old_isolates = sorted(old["isolates"], key=itemgetter("id"))

    # Check isolate by isolate. Order is ignored.
    for new_isolate, old_isolate in zip(new_isolates, old_isolates):
        # Will change if a value property of the isolate has changed.
        for key in ("id", "source_type", "source_name", "default"):
            if new_isolate[key] != old_isolate[key]:
                return True

        # Check if sequence ids have changed.
        if {i["_id"] for i in new_isolate["sequences"]} != {
            i["remote"]["id"] for i in old_isolate["sequences"]
        }:
            return True

        # Check sequence-by-sequence. Order is ignored.
        new_sequences = sorted(new_isolate["sequences"], key=itemgetter("_id"))
        old_sequences = sorted(
            old_isolate["sequences"],
            key=lambda d: d["remote"]["id"],
        )

        for new_sequence, old_sequence in zip(new_sequences, old_sequences):
            for key in ("accession", "definition", "host", "sequence"):
                if new_sequence[key] != old_sequence[key]:
                    return True

    return False


def detect_duplicate_abbreviation(joined: dict, duplicates: set, seen: set):
    abbreviation = joined.get("abbreviation", "")

    if abbreviation:
        if abbreviation in seen:
            duplicates.add(abbreviation)
        else:
            seen.add(abbreviation)


def detect_duplicate_ids(joined: dict, duplicate_ids: set, seen_ids: set):
    if joined["_id"] in seen_ids:
        duplicate_ids.add(joined["_id"])
    else:
        seen_ids.add(joined["_id"])


def detect_duplicate_isolate_ids(joined: dict, duplicate_isolate_ids: dict):
    duplicates = set()

    isolate_ids = [i["id"] for i in joined["isolates"]]

    for isolate_id in isolate_ids:
        if isolate_ids.count(isolate_id) > 1:
            duplicates.add(isolate_id)

    if duplicates:
        duplicate_isolate_ids[joined["_id"]] = {
            "name": joined["name"],
            "duplicates": list(duplicates),
        }


def detect_duplicate_sequence_ids(
    joined: dict,
    duplicate_sequence_ids: Set[str],
    seen_sequence_ids: Set[str],
):
    sequence_ids = virtool.otus.utils.extract_sequence_ids(joined)

    # Add sequence ids that are duplicated within an OTU to the duplicate set.
    duplicate_sequence_ids.update(
        {i for i in sequence_ids if sequence_ids.count(i) > 1},
    )

    sequence_ids = set(sequence_ids)

    # Add sequence ids that have already been seen and are in the OTU.
    duplicate_sequence_ids.update(seen_sequence_ids & sequence_ids)

    # Add all sequences to seen list.
    seen_sequence_ids.update(sequence_ids)


def detect_duplicate_name(joined: dict, duplicates: Set[str], seen: Set[str]):
    lowered = joined["name"].lower()

    if joined["name"].lower() in seen:
        duplicates.add(joined["name"])
    else:
        seen.add(lowered)


def detect_duplicates(otus: List[dict], strict: bool = True) -> List[dict]:
    duplicate_abbreviations = set()
    duplicate_ids = set()
    duplicate_isolate_ids = {}
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
            seen_abbreviations,
        )

        detect_duplicate_name(joined, duplicate_names, seen_names)

        if strict:
            detect_duplicate_ids(
                joined,
                duplicate_ids,
                seen_ids,
            )

            detect_duplicate_isolate_ids(joined, duplicate_isolate_ids)

            detect_duplicate_sequence_ids(
                joined,
                duplicate_sequence_ids,
                seen_sequence_ids,
            )

    errors = []

    if duplicate_abbreviations:
        errors.append(
            {
                "id": "duplicate_abbreviations",
                "message": "Duplicate OTU abbreviations found",
                "duplicates": list(duplicate_abbreviations),
            },
        )

    if duplicate_ids:
        errors.append(
            {
                "id": "duplicate_ids",
                "message": "Duplicate OTU ids found",
                "duplicates": list(duplicate_ids),
            },
        )

    if duplicate_isolate_ids:
        errors.append(
            {
                "id": "duplicate_isolate_ids",
                "message": "Duplicate isolate ids found in some OTUs",
                "duplicates": duplicate_isolate_ids,
            },
        )

    if duplicate_names:
        errors.append(
            {
                "id": "duplicate_names",
                "message": "Duplicate OTU names found",
                "duplicates": list(duplicate_names),
            },
        )

    if duplicate_sequence_ids:
        errors.append(
            {
                "id": "duplicate_sequence_ids",
                "message": "Duplicate sequence ids found",
                "duplicates": duplicate_sequence_ids,
            },
        )

    return errors


def get_import_schema(require_meta: bool = True) -> dict:
    return {
        "data_type": {"type": "string", "required": require_meta},
        "organism": {"type": "string", "required": require_meta},
        "otus": {"type": "list", "required": True},
    }


def get_isolate_schema(require_id: bool) -> dict:
    return {
        "id": {"type": "string", "required": require_id},
        "source_type": {"type": "string", "required": True},
        "source_name": {"type": "string", "required": True},
        "default": {"type": "boolean", "required": True},
        "sequences": {"type": "list", "required": True},
    }


def get_otu_schema(require_id: bool) -> dict:
    return {
        "_id": {"type": "string", "required": require_id},
        "abbreviation": {"type": "string"},
        "name": {"type": "string", "required": True},
        "isolates": {"type": "list", "required": True},
    }


def get_owner_user(user_id: str, created_at: datetime) -> dict:
    return {
        "id": user_id,
        "build": True,
        "modify": True,
        "modify_otu": True,
        "created_at": created_at,
        "remove": True,
    }


def get_sequence_schema(require_id: bool) -> dict:
    return {
        "_id": {"type": "string", "required": require_id},
        "accession": {"type": "string", "required": True},
        "definition": {"type": "string", "required": True},
        "sequence": {"type": "string", "required": True},
    }


def load_reference_file(path: Path) -> dict:
    """Load a list of merged otus documents from a file associated with a Virtool
    reference file.

    :param path: the path to the otus.json.gz file
    :return: the otus data to import
    """
    if not path.suffixes == [".json", ".gz"]:
        raise ValueError("Reference file must be a gzip-compressed JSON file")

    with open(path, "rb") as handle, gzip.open(handle, "rt") as gzip_file:
        return json.load(gzip_file)


def validate_otu(otu: dict, strict: bool) -> dict:
    report = {"otu": None, "isolates": {}, "sequences": {}}

    otu_validator = Validator(get_otu_schema(strict), allow_unknown=True)

    if not otu_validator.validate(otu):
        report["otu"] = otu_validator.errors

    report["isolates"] = {}

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
