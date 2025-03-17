import gzip
import json
from datetime import datetime
from operator import itemgetter
from pathlib import Path

from pydantic import BaseModel, ValidationError
from virtool_core.models.reference import ReferenceDataType

import virtool.otus.utils

RIGHTS = ["build", "modify", "modify_otu", "remove"]


class ReferenceSourceData(BaseModel):
    data_type: ReferenceDataType = ReferenceDataType.genome
    organism: str = "Unknown"
    otus: list[dict]
    targets: list[dict] | None = None


def check_import_data(data: dict) -> list[dict]:
    errors = detect_duplicates(data["otus"])

    try:
        ref = ImportableReference.model_validate(data)
    except ValidationError as err:
        errors.append({"id": "file", "issues": err.errors()})
        return errors

    otus = {}

    for otu in ref.otus:
        issues = {}

        if verification := virtool.otus.utils.verify(otu):
            issues["verification"] = verification

        if validation := validate_otu(otu):
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
    for new_isolate, old_isolate in zip(new_isolates, old_isolates, strict=True):
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

        for new_sequence, old_sequence in zip(
            new_sequences,
            old_sequences,
            strict=True,
        ):
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
    duplicate_sequence_ids: set[str],
    seen_sequence_ids: set[str],
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


def detect_duplicate_name(joined: dict, duplicates: set[str], seen: set[str]):
    lowered = joined["name"].lower()

    if joined["name"].lower() in seen:
        duplicates.add(joined["name"])
    else:
        seen.add(lowered)


def detect_duplicates(otus: list[dict], strict: bool = True) -> list[dict]:
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


def get_owner_user(user_id: str, created_at: datetime) -> dict:
    return {
        "id": user_id,
        "build": True,
        "modify": True,
        "modify_otu": True,
        "created_at": created_at,
        "remove": True,
    }


class ImportableSequence(BaseModel):
    """A validator for a sequence in an importable reference data set."""

    _id: str
    accession: str
    definition: str
    sequence: str


class ImportableIsolate(BaseModel):
    """A validator for an isolate in an importable reference data set."""

    id: str
    source_type: str
    source_name: str
    default: bool
    sequences: list[ImportableSequence]


class ImportableOTU(BaseModel):
    """A validator for an OTU in an importable reference data set."""

    _id: str
    abbreviation: str
    name: str
    isolates: list[ImportableIsolate]


class ImportableReference(BaseModel):
    """A validator for the metadata in a reference file."""

    data_type: ReferenceDataType
    organism: str = "Unknown"
    otus: list[dict]
    targets: list[dict] | None = None


def load_reference_file(path: Path) -> dict:
    """Load the importable reference at ``path``.

    :param path: the path to the otus.json.gz file
    :return: the otus data to import
    """
    if path.suffixes != [".json", ".gz"]:
        msg = "Reference file must be a gzip-compressed JSON file"
        raise ValueError(msg)

    with path.open("rb") as handle, gzip.open(handle, "rt") as gzip_file:
        return json.load(gzip_file)


def validate_otu(otu: dict) -> dict | None:
    report = {"otu": [], "isolates": [], "sequences": []}

    try:
        ImportableOTU.model_validate(otu)
    except ValidationError as exc:
        for error in exc.errors():
            del error["input"]
            del error["type"]
            del error["url"]

            try:
                level = error["loc"][-3]
            except IndexError:
                level = "otu"

            if level == "otu":
                report["otu"].append(error)
                continue

            isolate_index = error["loc"][1]
            isolate_id = otu["isolates"][isolate_index]["id"]

            if level == "isolates":
                report["isolates"].append({**error, "isolate_id": isolate_id})
            else:
                sequence_index = error["loc"][3]
                sequence_id = otu["isolates"][isolate_index]["sequences"][
                    sequence_index
                ]["_id"]

                report["sequences"].append(
                    {**error, "isolate_id": isolate_id, "sequence_id": sequence_id},
                )

    if any(value for value in report.values()):
        return report

    return None
