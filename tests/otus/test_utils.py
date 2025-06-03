import pytest
from syrupy import SnapshotAssertion

import virtool.otus
import virtool.otus.utils
from virtool.otus.utils import find_isolate, format_isolate_name


class TestVerify:
    def test_pass(self, test_merged_otu: dict):
        """Test that a valid otu and sequence list results in return value of ``None``."""
        assert virtool.otus.utils.verify(test_merged_otu) is None

    def test_empty_isolate(self, test_merged_otu: dict):
        """Test that an isolate with no sequences is detected."""
        test_merged_otu["isolates"][0]["sequences"] = []

        assert virtool.otus.utils.verify(test_merged_otu) == {
            "empty_isolate": ["cab8b360"],
            "empty_sequence": False,
            "empty_otu": False,
            "isolate_inconsistency": False,
        }

    def test_empty_sequence(
        self,
        snapshot: SnapshotAssertion,
        test_merged_otu: dict,
    ):
        """Test that a sequence with an empty ``sequence`` field is detected."""
        test_merged_otu["isolates"][0]["sequences"][0]["sequence"] = ""
        assert virtool.otus.utils.verify(test_merged_otu) == snapshot

    def test_empty_otu(self, test_merged_otu: dict):
        """Test that an otu with no isolates is detected."""
        test_merged_otu["isolates"] = []

        assert virtool.otus.utils.verify(test_merged_otu) == {
            "empty_isolate": False,
            "empty_sequence": False,
            "empty_otu": True,
            "isolate_inconsistency": False,
        }

    def test_isolate_inconsistency(self, test_merged_otu: dict, test_sequence: dict):
        """Test that isolates in a single otu with disparate sequence counts are detected."""
        test_merged_otu["isolates"].append(
            dict(test_merged_otu["isolates"][0], id="foobar"),
        )

        test_merged_otu["isolates"][1]["sequences"] = [
            dict(test_sequence, _id="foobar_1"),
            dict(test_sequence, _id="foobar_2"),
        ]

        assert virtool.otus.utils.verify(test_merged_otu) == {
            "empty_isolate": False,
            "empty_sequence": False,
            "empty_otu": False,
            "isolate_inconsistency": True,
        }


def test_merge_otu(test_otu: dict, test_sequence: dict, test_merged_otu: dict):
    assert virtool.otus.utils.merge_otu(test_otu, [test_sequence]) == test_merged_otu


def test_split(test_otu: dict, test_sequence: dict, test_merged_otu: dict):
    otu, sequences = virtool.otus.utils.split(test_merged_otu)

    assert otu == test_otu
    assert sequences == [test_sequence]


@pytest.mark.parametrize("exists", [True, False])
def test_find_isolate(exists: bool, test_otu: dict, test_isolate: dict):
    new_isolate = {
        **test_isolate,
        "id": "foobar",
        "source_type": "isolate",
        "source_name": "b",
    }

    if exists:
        test_otu["isolates"].append(new_isolate)

    isolate = find_isolate(test_otu["isolates"], "foobar")

    assert isolate == (new_isolate if exists else None)


class TestExtractSequenceIds:
    def test_valid(self, test_merged_otu: dict):
        sequence_ids = virtool.otus.utils.extract_sequence_ids(test_merged_otu)
        assert sequence_ids == ["abcd1234"]

    def test_missing_isolates(self, test_merged_otu: dict):
        del test_merged_otu["isolates"]

        with pytest.raises(KeyError) as excinfo:
            virtool.otus.utils.extract_sequence_ids(test_merged_otu)

        assert "'isolates'" in str(excinfo.value)

    def test_empty_isolates(self, test_merged_otu: dict):
        test_merged_otu["isolates"] = []

        with pytest.raises(ValueError) as excinfo:
            virtool.otus.utils.extract_sequence_ids(test_merged_otu)

        assert "Empty isolates list" in str(excinfo.value)

    def test_missing_sequences(self, test_merged_otu: dict):
        del test_merged_otu["isolates"][0]["sequences"]

        with pytest.raises(KeyError) as excinfo:
            virtool.otus.utils.extract_sequence_ids(test_merged_otu)

        assert "missing sequences field" in str(excinfo.value)

    def test_empty_sequences(self, test_merged_otu: dict):
        test_merged_otu["isolates"][0]["sequences"] = []

        with pytest.raises(ValueError) as excinfo:
            virtool.otus.utils.extract_sequence_ids(test_merged_otu)

        assert "Empty sequences list" in str(excinfo.value)


@pytest.mark.parametrize(
    ("source_type", "source_name"),
    [("Isolate", ""), ("", "8816 - v2")],
)
def test_format_isolate_name(source_name: str, source_type: str, test_isolate: dict):
    """Test that a formatted isolate name is produced for a full ``source_type`` and
    ``source_name``.

    Test that if either of these fields are missing, "Unnamed isolate" is returned.

    """
    formatted = format_isolate_name(
        {**test_isolate, "source_type": source_type, "source_name": source_name},
    )

    assert (
        formatted == "Isolate 8816 - v2"
        if source_type and source_name
        else "Unnamed Isolate"
    )


def test_format_fasta_entry():
    virus_name = "Tobacco mosaic virus"
    isolate_name = "Isolate A"
    sequence_id = "AX12345"
    sequence = "ATAGAGTTACGAGCGACTACGACT"

    entry = virtool.otus.utils.format_fasta_entry(
        virus_name,
        isolate_name,
        sequence_id,
        sequence,
    )

    assert (
        entry == ">Tobacco mosaic virus|Isolate A|AX12345|24\nATAGAGTTACGAGCGACTACGACT"
    )


@pytest.mark.parametrize(
    ("parts", "filename"),
    [
        (("Tobacco mosaic virus", "Isolate A", "AX12345", "foobar"), None),
        (
            ("Tobacco mosaic virus", "Isolate A", "AX12345"),
            "tobacco_mosaic_virus.isolate_a.ax12345.fa",
        ),
        (("Tobacco mosaic virus", "Isolate A"), "tobacco_mosaic_virus.isolate_a.fa"),
        (("Tobacco mosaic virus",), "tobacco_mosaic_virus.fa"),
        ((), None),
    ],
)
def test_format_fasta_filename(parts: tuple[str], filename: str):
    """Test the formatting of FASTA filenames based on the provided parts."""
    if not parts or len(parts) > 3:
        with pytest.raises(ValueError) as excinfo:
            virtool.otus.utils.format_fasta_filename(*parts)

        assert (
            "Too many filename parts"
            if parts
            else "At least one filename part required" in str(excinfo.value)
        )

    else:
        assert virtool.otus.utils.format_fasta_filename(*parts) == filename
