import pytest
from pydantic import ValidationError

from virtool.references.models import ReferenceDataType
from virtool.references.utils import (
    ReferenceSourceData,
)


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
        with pytest.raises(ValueError, match="Duplicate OTU abbreviations found"):
            ReferenceSourceData.parse_obj(
                {
                    "otus": [
                        test_merged_otu,
                        {
                            **test_merged_otu,
                            "_id": "different_id",
                            "name": "Different Name",
                        },
                    ]
                }
            )

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
