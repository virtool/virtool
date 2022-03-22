import pytest

import virtool.otus.utils
from virtool.otus.utils import find_isolate, format_isolate_name


class TestVerify:
    def test_pass(self, test_merged_otu):
        """
        Test that a valid otu and sequence list results in return value of ``None``.

        """
        assert virtool.otus.utils.verify(test_merged_otu) is None

    def test_empty_isolate(self, test_merged_otu):
        """
        Test that an isolate with no sequences is detected.

        """
        test_merged_otu["isolates"][0]["sequences"] = list()

        assert virtool.otus.utils.verify(test_merged_otu) == {
            "empty_isolate": ["cab8b360"],
            "empty_sequence": False,
            "empty_otu": False,
            "isolate_inconsistency": False,
        }

    def test_empty_sequence(self, test_merged_otu, snapshot):
        """
        Test that a sequence with an empty ``sequence`` field is detected.

        """
        test_merged_otu["isolates"][0]["sequences"][0]["sequence"] = ""
        assert virtool.otus.utils.verify(test_merged_otu) == snapshot

    def test_empty_otu(self, test_merged_otu):
        """
        Test that an otu with no isolates is detected.

        """
        test_merged_otu["isolates"] = []

        assert virtool.otus.utils.verify(test_merged_otu) == {
            "empty_isolate": False,
            "empty_sequence": False,
            "empty_otu": True,
            "isolate_inconsistency": False,
        }

    def test_isolate_inconsistency(self, test_merged_otu, test_sequence):
        """
        Test that isolates in a single otu with disparate sequence counts are detected.

        """
        test_merged_otu["isolates"].append(
            dict(test_merged_otu["isolates"][0], id="foobar")
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


def test_merge_otu(test_otu, test_sequence, test_merged_otu):
    assert virtool.otus.utils.merge_otu(test_otu, [test_sequence]) == test_merged_otu


def test_split(test_otu, test_sequence, test_merged_otu):
    otu, sequences = virtool.otus.utils.split(test_merged_otu)

    assert otu == test_otu
    assert sequences == [test_sequence]


@pytest.mark.parametrize("exists", [True, False])
def test_find_isolate(exists, test_otu, test_isolate):

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
    def test_valid(self, test_merged_otu):
        sequence_ids = virtool.otus.utils.extract_sequence_ids(test_merged_otu)
        assert sequence_ids == ["KX269872"]

    def test_missing_isolates(self, test_merged_otu):
        del test_merged_otu["isolates"]

        with pytest.raises(KeyError) as excinfo:
            virtool.otus.utils.extract_sequence_ids(test_merged_otu)

        assert "'isolates'" in str(excinfo.value)

    def test_empty_isolates(self, test_merged_otu):
        test_merged_otu["isolates"] = list()

        with pytest.raises(ValueError) as excinfo:
            virtool.otus.utils.extract_sequence_ids(test_merged_otu)

        assert "Empty isolates list" in str(excinfo.value)

    def test_missing_sequences(self, test_merged_otu):
        del test_merged_otu["isolates"][0]["sequences"]

        with pytest.raises(KeyError) as excinfo:
            virtool.otus.utils.extract_sequence_ids(test_merged_otu)

        assert "missing sequences field" in str(excinfo.value)

    def test_empty_sequences(self, test_merged_otu):
        test_merged_otu["isolates"][0]["sequences"] = list()

        with pytest.raises(ValueError) as excinfo:
            virtool.otus.utils.extract_sequence_ids(test_merged_otu)

        assert "Empty sequences list" in str(excinfo.value)


@pytest.mark.parametrize(
    "source_type, source_name", [("Isolate", ""), ("Isolate", ""), ("", "8816 - v2")]
)
def test_format_isolate_name(source_type, source_name, test_isolate):
    """
    Test that a formatted isolate name is produced for a full ``source_type`` and
    ``source_name``.

    Test that if either of these fields are missing, "Unnamed isolate" is returned.

    """
    formatted = format_isolate_name(
        {**test_isolate, "source_type": source_type, "source_name": source_name}
    )

    assert (
        formatted == "Isolate 8816 - v2"
        if source_type and source_name
        else "Unnamed Isolate"
    )
