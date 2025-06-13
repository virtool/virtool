import gzip
import json
from operator import itemgetter
from pathlib import Path

from pydantic import BaseModel, Field, validator

from virtool.references.models import ReferenceDataType

RIGHTS = ["build", "modify", "modify_otu", "remove"]


class ReferenceSourceDataError(Exception):
    """An exception raised when source data used to create a reference is invalid."""

    def __init__(self, errors: list[dict] | None = None):
        super().__init__("Found errors in reference input.")

        self.errors = errors if errors else []


class ReferenceSourceSequence(BaseModel):
    """Pydantic validator for sequence data being used to populate a new reference."""

    id: str = Field(min_length=1, alias="_id")
    accession: str = Field(min_length=1)
    definition: str
    sequence: str = Field(min_length=10)

    class Config:
        extra = "allow"
        allow_population_by_field_name = True


class ReferenceSourceIsolate(BaseModel):
    """Pydantic validator for isolate data."""

    id: str
    default: bool
    source_type: str
    source_name: str
    sequences: list[ReferenceSourceSequence] = Field(min_items=1)

    class Config:
        extra = "allow"
        allow_population_by_field_name = True


class ReferenceSourceOTU(BaseModel):
    """Pydantic validator for OTU data."""

    id: str = Field(alias="_id")
    abbreviation: str = ""
    name: str
    isolates: list[ReferenceSourceIsolate] = Field(min_items=1)

    class Config:
        extra = "allow"
        allow_population_by_field_name = True


class ReferenceSourceData(BaseModel):
    data_type: ReferenceDataType = ReferenceDataType.genome
    organism: str = "Unknown"
    targets: list[str] | None = None
    otus: list[ReferenceSourceOTU] = Field(min_items=1)

    @validator("otus")
    def validate_no_duplicate_names(cls, v):
        """Validate that there are no duplicate OTU names."""
        duplicate_names = set()
        seen_names = set()

        for otu in v:
            lowered = otu.name.lower()

            if lowered in seen_names:
                duplicate_names.add(otu.name)
            else:
                seen_names.add(lowered)

        if duplicate_names:
            raise ValueError(f"Duplicate OTU names found: {list(duplicate_names)}")
        return v

    @validator("otus")
    def validate_no_duplicate_abbreviations(cls, v):
        """Validate that there are no duplicate OTU abbreviations."""
        duplicate_abbreviations = set()
        seen_abbreviations = set()

        for otu in v:
            abbreviation = otu.abbreviation
            if abbreviation:
                if abbreviation in seen_abbreviations:
                    duplicate_abbreviations.add(abbreviation)
                else:
                    seen_abbreviations.add(abbreviation)

        if duplicate_abbreviations:
            raise ValueError(
                f"Duplicate OTU abbreviations found: {list(duplicate_abbreviations)}"
            )

        return v

    @validator("otus")
    def validate_no_duplicate_ids(cls, v):
        """Validate that there are no duplicate OTU IDs."""
        duplicate_ids = set()
        seen_ids = set()

        for otu in v:
            if otu.id in seen_ids:
                duplicate_ids.add(otu.id)
            else:
                seen_ids.add(otu.id)

        if duplicate_ids:
            raise ValueError(f"Duplicate OTU ids found: {list(duplicate_ids)}")

        return v

    @validator("otus")
    def validate_no_duplicate_isolate_ids(cls, v):
        """Validate that there are no duplicate isolate IDs within OTUs."""
        duplicate_isolate_ids = {}

        for otu in v:
            duplicates = set()
            isolate_ids = [i.id for i in otu.isolates]

            for isolate_id in isolate_ids:
                if isolate_ids.count(isolate_id) > 1:
                    duplicates.add(isolate_id)

            if duplicates:
                duplicate_isolate_ids[otu.id] = {
                    "name": otu.id,
                    "duplicates": list(duplicates),
                }

        if duplicate_isolate_ids:
            raise ValueError(
                f"Duplicate isolate ids found in some OTUs: {duplicate_isolate_ids}"
            )
        return v

    @validator("otus")
    def validate_no_duplicate_sequence_ids(cls, v):
        """Validate that there are no duplicate sequence IDs."""
        duplicate_sequence_ids = set()
        seen_sequence_ids = set()

        for otu in v:
            # Extract sequence IDs from the OTU model
            sequence_ids = []
            for isolate in otu.isolates:
                sequence_ids.extend([sequence.id for sequence in isolate.sequences])

            duplicate_sequence_ids.update(
                {i for i in sequence_ids if sequence_ids.count(i) > 1},
            )

            sequence_ids = set(sequence_ids)

            # Add sequence ids that have already been seen and are in the OTU.
            duplicate_sequence_ids.update(seen_sequence_ids & sequence_ids)

            # Add all sequences to seen list.
            seen_sequence_ids.update(sequence_ids)

        if duplicate_sequence_ids:
            raise ValueError(f"Duplicate sequence ids found: {duplicate_sequence_ids}")

        return v


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
    for new_isolate, old_isolate in zip(new_isolates, old_isolates, strict=False):
        # Will change if a value property of the isolate has changed.
        for key in ("id", "source_type", "source_name", "default"):
            if new_isolate[key] != old_isolate[key]:
                return True

        # Check if sequence ids have changed.
        if {i["id"] for i in new_isolate["sequences"]} != {
            i["remote"]["id"] for i in old_isolate["sequences"]
        }:
            return True

        # Check sequence-by-sequence. Order is ignored.
        new_sequences = sorted(new_isolate["sequences"], key=itemgetter("id"))
        old_sequences = sorted(
            old_isolate["sequences"],
            key=lambda d: d["remote"]["id"],
        )

        for new_sequence, old_sequence in zip(
            new_sequences, old_sequences, strict=False
        ):
            for key in ("accession", "definition", "host", "sequence"):
                if new_sequence[key] != old_sequence[key]:
                    return True

    return False


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
