import pytest

import virtool.db.kinds
import virtool.kinds


class TestValidateKind:

    def test_pass(self, test_merged_kind):
        """
        Test that a valid kind and sequence list results in return value of ``None``.

        """
        result = virtool.kinds.verify(test_merged_kind)
        assert result is None

    def test_empty_isolate(self, test_merged_kind):
        """
        Test that an isolate with no sequences is detected.

        """
        test_merged_kind["isolates"][0]["sequences"] = list()

        result = virtool.kinds.verify(test_merged_kind)

        assert result == {
            "empty_isolate": ["cab8b360"],
            "empty_sequence": False,
            "empty_kind": False,
            "isolate_inconsistency": False
        }

    def test_empty_sequence(self, test_merged_kind):
        """
        Test that a sequence with an empty ``sequence`` field is detected.

        """
        test_merged_kind["isolates"][0]["sequences"][0]["sequence"] = ""

        result = virtool.kinds.verify(test_merged_kind)

        assert result == {
            "empty_isolate": False,
            "empty_sequence": [{
                "_id": "KX269872",
                "definition": "Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene, complete cds.",
                "host": "sweet cherry",
                "kind_id": "6116cba1",
                "isolate_id": "cab8b360",
                "sequence": "",
                "segment": None
            }],
            "empty_kind": False,
            "isolate_inconsistency": False
        }

    def test_empty_kind(self, test_merged_kind):
        """
        Test that an kind with no isolates is detected.

        """
        test_merged_kind["isolates"] = []

        result = virtool.kinds.verify(test_merged_kind)

        assert result == {
            "empty_isolate": False,
            "empty_sequence": False,
            "empty_kind": True,
            "isolate_inconsistency": False
        }

    def test_isolate_inconsistency(self, test_merged_kind, test_sequence):
        """
        Test that isolates in a single kind with disparate sequence counts are detected.

        """
        test_merged_kind["isolates"].append(dict(test_merged_kind["isolates"][0], id="foobar"))

        test_merged_kind["isolates"][1]["sequences"] = [
            dict(test_sequence, _id="foobar_1"),
            dict(test_sequence, _id="foobar_2")
        ]

        result = virtool.kinds.verify(test_merged_kind)

        assert result == {
            "empty_isolate": False,
            "empty_sequence": False,
            "empty_kind": False,
            "isolate_inconsistency": True
        }


class TestGetDefaultIsolate:

    def test(self, test_kind, test_isolate):
        """
        Test that the function can find the default isolate.

        """
        default_isolate = dict(test_isolate, isolate_id="foobar3", default=True)

        test_kind["isolates"] = [
            dict(test_isolate, isolate_id="foobar1", default=False),
            dict(test_isolate, isolate_id="foobar2", default=False),
            default_isolate,
            dict(test_isolate, isolate_id="foobar4", default=False)
        ]

        assert virtool.kinds.extract_default_isolate(test_kind) == default_isolate

    def test_processor(self, test_kind, test_isolate):
        """
        Test that the ``processor`` argument works.

        """

        default_isolate = dict(test_isolate, isolate_id="foobar3", default=True)

        expected = dict(default_isolate, processed=True)

        test_kind["isolates"] = [
            dict(test_isolate, isolate_id="foobar1", default=False),
            default_isolate
        ]

        def test_processor(isolate):
            return dict(isolate, processed=True)

        assert virtool.kinds.extract_default_isolate(test_kind, test_processor) == expected

    def test_no_default(self, test_kind):
        """
        Test that a ``ValueError`` is raised when the kind contains not default isolates.

        """
        test_kind["isolates"][0]["default"] = False

        with pytest.raises(ValueError) as err:
            virtool.kinds.extract_default_isolate(test_kind)

        assert "No default isolate found" in str(err)

    def test_multiple_defaults(self, test_kind, test_isolate):
        """
        Test that a ``ValueError`` is raised when the kind contains more than one default isolate.

        """
        extra_isolate = dict(test_isolate, isolate_id="foobar3", default=True)

        test_kind["isolates"].append(extra_isolate)

        with pytest.raises(ValueError) as err:
            virtool.kinds.extract_default_isolate(test_kind)

        assert "More than one" in str(err)


def test_merge_kind(test_kind, test_sequence, test_merged_kind):
    merged = virtool.kinds.merge_kind(test_kind, [test_sequence])
    assert merged == test_merged_kind


def test_split(test_kind, test_sequence, test_merged_kind):
    kind, sequences = virtool.kinds.split(test_merged_kind)

    assert kind == test_kind
    assert sequences == [test_sequence]


class TestExtractIsolateIds:

    @pytest.mark.parametrize("multiple", [True, False])
    def test(self, multiple, test_kind):
        if multiple:
            test_kind["isolates"].append({
                "id": "foobar"
            })

        expected = ["cab8b360"]

        if multiple:
            expected.append("foobar")

        assert virtool.kinds.extract_isolate_ids(test_kind) == expected

    def test_missing(self, test_kind):
        del test_kind["isolates"]

        with pytest.raises(KeyError):
            virtool.kinds.extract_isolate_ids(test_kind)


class TestFindIsolate:

    def test(self, test_kind, test_isolate):
        new_isolate = dict(test_isolate, id="foobar", source_type="isolate", source_name="b")

        test_kind["isolates"].append(new_isolate)

        isolate = virtool.kinds.find_isolate(test_kind["isolates"], "foobar")

        assert isolate == new_isolate

    def test_does_not_exist(self, test_kind):
        assert virtool.kinds.find_isolate(test_kind["isolates"], "foobar") is None


class TestExtractSequenceIds:

    def test_valid(self, test_merged_kind):
        sequence_ids = virtool.kinds.extract_sequence_ids(test_merged_kind)
        assert sequence_ids == ["KX269872"]

    def test_missing_isolates(self, test_merged_kind):
        del test_merged_kind["isolates"]

        with pytest.raises(KeyError) as err:
            virtool.kinds.extract_sequence_ids(test_merged_kind)

        assert "'isolates'" in str(err)

    def test_empty_isolates(self, test_merged_kind):
        test_merged_kind["isolates"] = list()

        with pytest.raises(ValueError) as err:
            virtool.kinds.extract_sequence_ids(test_merged_kind)

        assert "Empty isolates list" in str(err)

    def test_missing_sequences(self, test_merged_kind):
        del test_merged_kind["isolates"][0]["sequences"]

        with pytest.raises(KeyError) as err:
            virtool.kinds.extract_sequence_ids(test_merged_kind)

        assert "missing sequences field" in str(err)

    def test_empty_sequences(self, test_merged_kind):
        test_merged_kind["isolates"][0]["sequences"] = list()

        with pytest.raises(ValueError) as err:
            virtool.kinds.extract_sequence_ids(test_merged_kind)

        assert "Empty sequences list" in str(err)


class TestFormatIsolateName:

    @pytest.mark.parametrize("source_type, source_name", [("Isolate", ""), ("Isolate", ""), ("", "8816 - v2")])
    def test(self, source_type, source_name, test_isolate):
        """
        Test that a formatted isolate name is produced for a full ``source_type`` and ``source_name``. Test that if
        either of these fields are missing, "Unnamed isolate" is returned.

        """
        test_isolate.update({
            "source_type": source_type,
            "source_name": source_name
        })

        formatted = virtool.kinds.format_isolate_name(test_isolate)

        if source_type and source_name:
            assert formatted == "Isolate 8816 - v2"
        else:
            assert formatted == "Unnamed Isolate"
