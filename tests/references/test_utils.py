from datetime import datetime

import pytest
from pydantic import ValidationError

from virtool.references.models import ReferenceDataType
from virtool.references.utils import (
    ReferenceSourceData,
    reference_values,
)


class TestReferenceValues:
    """Test the Mongo-document to ``legacy_references`` column mapping."""

    @staticmethod
    def _document() -> dict:
        return {
            "_id": "ref_legacy",
            "name": "Reference",
            "description": "A reference.",
            "organism": "virus",
            "created_at": datetime(2026, 1, 2, 3, 4, 5),
            "archived": True,
            "restrict_source_types": True,
            "source_types": ["isolate", "strain"],
            "data_type": "genome",
            "space": {"id": 0},
            "internal_control": None,
            "user": {"id": 7},
            "imported_from": {"id": 11},
            "cloned_from": {"id": "source_legacy", "name": "Source"},
            "task": {"id": 3},
        }

    def test_maps_columns_and_foreign_keys(self):
        """Fields are relocated and the resolved integer foreign keys are used."""
        values = reference_values(
            self._document(),
            user_id=7,
            upload_id=11,
            cloned_from_id=4,
            task_id=3,
        )

        assert values == {
            "legacy_id": "ref_legacy",
            "name": "Reference",
            "description": "A reference.",
            "organism": "virus",
            "created_at": datetime(2026, 1, 2, 3, 4, 5),
            "archived": True,
            "restrict_source_types": True,
            "source_types": ["isolate", "strain"],
            "user_id": 7,
            "upload_id": 11,
            "cloned_from_id": 4,
            "task_id": 3,
        }

    def test_drops_mongo_only_fields(self):
        """``data_type``, ``space`` and ``internal_control`` are not persisted."""
        values = reference_values(
            self._document(),
            user_id=7,
            upload_id=11,
            cloned_from_id=4,
            task_id=3,
        )

        assert "data_type" not in values
        assert "space" not in values
        assert "internal_control" not in values

    def test_none_organism_becomes_empty_string(self):
        """A ``None`` organism is stored as an empty string for the non-null column."""
        document = {**self._document(), "organism": None}

        values = reference_values(
            document,
            user_id=7,
            upload_id=None,
            cloned_from_id=None,
            task_id=None,
        )

        assert values["organism"] == ""

    def test_defaults_for_absent_lifecycle_fields(self):
        """Missing ``archived``/``restrict_source_types``/``source_types`` default."""
        document = {
            "_id": "ref_legacy",
            "name": "Reference",
            "description": "A reference.",
            "organism": "virus",
            "created_at": datetime(2026, 1, 2, 3, 4, 5),
        }

        values = reference_values(
            document,
            user_id=None,
            upload_id=None,
            cloned_from_id=None,
            task_id=None,
        )

        assert values["archived"] is False
        assert values["restrict_source_types"] is False
        assert values["source_types"] == []


class TestReferenceSourceData:
    """Test the validation logic in the ReferenceSourceData model."""

    def test_ok(self, test_merged_otu: dict):
        """Test that valid data does not raise an error."""
        data = ReferenceSourceData.parse_obj(
            {"dat_type": "genome", "organism": "virus", "otus": [test_merged_otu]}
        )

        assert len(data.otus) == 1
        assert data.otus[0].name == test_merged_otu["name"]
        assert data.otus[0].id == test_merged_otu["_id"]

        assert data.data_type == "genome"
        assert data.organism == "virus"

    def test_default(self, test_merged_otu: dict):
        """Test that the default values are set correctly."""
        data = ReferenceSourceData.parse_obj({"otus": [test_merged_otu]})

        assert data.data_type == ReferenceDataType.genome
        assert data.organism == "Unknown"
        assert len(data.otus) == 1

    def test_empty(self):
        """Should raise an error if no OTUs are provided."""
        with pytest.raises(ValidationError):
            ReferenceSourceData.parse_obj({"otus": []})

    def test_duplicate_otu_names(self, test_merged_otu: dict):
        with pytest.raises(ValueError, match="Duplicate OTU names found"):
            ReferenceSourceData.parse_obj(
                {
                    "otus": [
                        test_merged_otu,
                        {
                            **test_merged_otu,
                            "_id": "different_id",
                        },
                    ]
                }
            )

    def test_duplicate_otu_abbreviations(self, test_merged_otu: dict):
        """Duplicate OTU abbreviations should be allowed."""
        otu_2 = {
            **test_merged_otu,
            "_id": "different_id",
            "name": "Different Name",
            "isolates": [
                {
                    **test_merged_otu["isolates"][0],
                    "sequences": [
                        {
                            **test_merged_otu["isolates"][0]["sequences"][0],
                            "_id": "unique_seq_id",
                        }
                    ],
                }
            ],
        }

        data = ReferenceSourceData.parse_obj({"otus": [test_merged_otu, otu_2]})

        assert len(data.otus) == 2

    def test_duplicate_ids(self, test_merged_otu: dict):
        otu_2 = dict(test_merged_otu)
        otu_2["name"] = "Different Name"  # Different name to avoid duplicate name error
        otu_2["abbreviation"] = (
            "DIF"  # Different abbreviation to avoid duplicate abbreviation error
        )

        with pytest.raises(ValueError, match="Duplicate OTU ids found"):
            ReferenceSourceData.parse_obj({"otus": [test_merged_otu, otu_2]})

    def test_duplicate_isolate_ids(self, test_merged_otu: dict):
        extra_isolate = dict(test_merged_otu["isolates"][0])
        test_merged_otu["isolates"].append(extra_isolate)

        with pytest.raises(
            ValueError, match="Duplicate isolate ids found in some OTUs"
        ):
            ReferenceSourceData.parse_obj({"otus": [test_merged_otu]})

    def test_duplicate_sequence_ids(self, test_merged_otu: dict):
        test_merged_otu["isolates"][0]["sequences"].append(
            test_merged_otu["isolates"][0]["sequences"][0]
        )

        with pytest.raises(ValueError, match="Duplicate sequence ids found"):
            ReferenceSourceData.parse_obj({"otus": [test_merged_otu]})
