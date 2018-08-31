import pytest

import virtool.db.otus
import virtool.otus


class TestValidateKind:

    def test_pass(self, test_merged_otu):
        """
        Test that a valid otu and sequence list results in return value of ``None``.

        """
        result = virtool.otus.verify(test_merged_otu)
        assert result is None

    def test_empty_isolate(self, test_merged_otu):
        """
        Test that an isolate with no sequences is detected.

        """
        test_merged_otu["isolates"][0]["sequences"] = list()

        result = virtool.otus.verify(test_merged_otu)

        assert result == {
            "empty_isolate": ["cab8b360"],
            "empty_sequence": False,
            "empty_otu": False,
            "isolate_inconsistency": False
        }

    def test_empty_sequence(self, test_merged_otu):
        """
        Test that a sequence with an empty ``sequence`` field is detected.

        """
        test_merged_otu["isolates"][0]["sequences"][0]["sequence"] = ""

        result = virtool.otus.verify(test_merged_otu)

        assert result == {
            "empty_isolate": False,
            "empty_sequence": [{
                "_id": "KX269872",
                "definition": "Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene, complete cds.",
                "host": "sweet cherry",
                "otu_id": "6116cba1",
                "isolate_id": "cab8b360",
                "sequence": "",
                "segment": None
            }],
            "empty_otu": False,
            "isolate_inconsistency": False
        }

    def test_empty_otu(self, test_merged_otu):
        """
        Test that an otu with no isolates is detected.

        """
        test_merged_otu["isolates"] = []

        result = virtool.otus.verify(test_merged_otu)

        assert result == {
            "empty_isolate": False,
            "empty_sequence": False,
            "empty_otu": True,
            "isolate_inconsistency": False
        }

    def test_isolate_inconsistency(self, test_merged_otu, test_sequence):
        """
        Test that isolates in a single otu with disparate sequence counts are detected.

        """
        test_merged_otu["isolates"].append(dict(test_merged_otu["isolates"][0], id="foobar"))

        test_merged_otu["isolates"][1]["sequences"] = [
            dict(test_sequence, _id="foobar_1"),
            dict(test_sequence, _id="foobar_2")
        ]

        result = virtool.otus.verify(test_merged_otu)

        assert result == {
            "empty_isolate": False,
            "empty_sequence": False,
            "empty_otu": False,
            "isolate_inconsistency": True
        }


class TestGetDefaultIsolate:

    def test(self, test_otu, test_isolate):
        """
        Test that the function can find the default isolate.

        """
        default_isolate = dict(test_isolate, isolate_id="foobar3", default=True)

        test_otu["isolates"] = [
            dict(test_isolate, isolate_id="foobar1", default=False),
            dict(test_isolate, isolate_id="foobar2", default=False),
            default_isolate,
            dict(test_isolate, isolate_id="foobar4", default=False)
        ]

        assert virtool.otus.extract_default_isolate(test_otu) == default_isolate

    def test_processor(self, test_otu, test_isolate):
        """
        Test that the ``processor`` argument works.

        """

        default_isolate = dict(test_isolate, isolate_id="foobar3", default=True)

        expected = dict(default_isolate, processed=True)

        test_otu["isolates"] = [
            dict(test_isolate, isolate_id="foobar1", default=False),
            default_isolate
        ]

        def test_processor(isolate):
            return dict(isolate, processed=True)

        assert virtool.otus.extract_default_isolate(test_otu, test_processor) == expected

    def test_no_default(self, test_otu):
        """
        Test that a ``ValueError`` is raised when the otu contains not default isolates.

        """
        test_otu["isolates"][0]["default"] = False

        with pytest.raises(ValueError) as err:
            virtool.otus.extract_default_isolate(test_otu)

        assert "No default isolate found" in str(err)

    def test_multiple_defaults(self, test_otu, test_isolate):
        """
        Test that a ``ValueError`` is raised when the otu contains more than one default isolate.

        """
        extra_isolate = dict(test_isolate, isolate_id="foobar3", default=True)

        test_otu["isolates"].append(extra_isolate)

        with pytest.raises(ValueError) as err:
            virtool.otus.extract_default_isolate(test_otu)

        assert "More than one" in str(err)


def test_merge_otu(test_otu, test_sequence, test_merged_otu):
    merged = virtool.otus.merge_otu(test_otu, [test_sequence])
    assert merged == test_merged_otu


def test_split(test_otu, test_sequence, test_merged_otu):
    otu, sequences = virtool.otus.split(test_merged_otu)

    assert otu == test_otu
    assert sequences == [test_sequence]


class TestExtractIsolateIds:

    @pytest.mark.parametrize("multiple", [True, False])
    def test_extract_isolate_ids(self, multiple, test_otu):
        if multiple:
            test_otu["isolates"].append({
                "id": "foobar"
            })

        expected = ["cab8b360"]

        if multiple:
            expected.append("foobar")

        assert virtool.otus.extract_isolate_ids(test_otu) == expected

    def test_missing(self, test_otu):
        del test_otu["isolates"]

        with pytest.raises(KeyError):
            virtool.otus.extract_isolate_ids(test_otu)


class TestFindIsolate:

    def test(self, test_otu, test_isolate):
        new_isolate = dict(test_isolate, id="foobar", source_type="isolate", source_name="b")

        test_otu["isolates"].append(new_isolate)

        isolate = virtool.otus.find_isolate(test_otu["isolates"], "foobar")

        assert isolate == new_isolate

    def test_does_not_exist(self, test_otu):
        assert virtool.otus.find_isolate(test_otu["isolates"], "foobar") is None


class TestExtractSequenceIds:

    def test_valid(self, test_merged_otu):
        sequence_ids = virtool.otus.extract_sequence_ids(test_merged_otu)
        assert sequence_ids == ["KX269872"]

    def test_missing_isolates(self, test_merged_otu):
        del test_merged_otu["isolates"]

        with pytest.raises(KeyError) as err:
            virtool.otus.extract_sequence_ids(test_merged_otu)

        assert "'isolates'" in str(err)

    def test_empty_isolates(self, test_merged_otu):
        test_merged_otu["isolates"] = list()

        with pytest.raises(ValueError) as err:
            virtool.otus.extract_sequence_ids(test_merged_otu)

        assert "Empty isolates list" in str(err)

    def test_missing_sequences(self, test_merged_otu):
        del test_merged_otu["isolates"][0]["sequences"]

        with pytest.raises(KeyError) as err:
            virtool.otus.extract_sequence_ids(test_merged_otu)

        assert "missing sequences field" in str(err)

    def test_empty_sequences(self, test_merged_otu):
        test_merged_otu["isolates"][0]["sequences"] = list()

        with pytest.raises(ValueError) as err:
            virtool.otus.extract_sequence_ids(test_merged_otu)

        assert "Empty sequences list" in str(err)


@pytest.mark.parametrize("source_type, source_name", [
    ("Isolate", ""),
    ("Isolate", ""),
    ("", "8816 - v2")
])
def test_format_isolate_name(source_type, source_name, test_isolate):
    """
    Test that a formatted isolate name is produced for a full ``source_type`` and ``source_name``. Test that if
    either of these fields are missing, "Unnamed isolate" is returned.

    """
    test_isolate.update({
        "source_type": source_type,
        "source_name": source_name
    })

    formatted = virtool.otus.format_isolate_name(test_isolate)

    if source_type and source_name:
        assert formatted == "Isolate 8816 - v2"
    else:
        assert formatted == "Unnamed Isolate"
