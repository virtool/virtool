import pytest

import virtool.db.references
import virtool.references


class TestDuplicates:

    def test_detect_duplicates(self, test_kind_list):
        """
        Test that a valid virus list returns no duplicates or errors.

        """
        assert virtool.references.detect_duplicates(test_kind_list) is None

    def test_empty_abbreviations(self, test_kind_list):
        """
        Ensure that abbreviations with value "" are not counted as duplicates.

        """
        test_kind_list[0]["abbreviation"] = ""
        test_kind_list[1]["abbreviation"] = ""

        result = virtool.references.detect_duplicates(test_kind_list)

        assert result is None

    @pytest.mark.parametrize("multiple", [False, True])
    def test_duplicate_kind_ids(self, multiple, test_kind_list):
        test_kind_list[0]["_id"] = "067jz0t3"

        if multiple:
            test_kind_list[3]["_id"] = "067jz213"

        duplicates = virtool.references.detect_duplicates(test_kind_list)

        assert all([duplicates[key] == [] for key in ["isolate_id", "name", "abbreviation", "sequence_id"]])

        expected = {"067jz0t3"}

        if multiple:
            expected.add("067jz213")

        assert set(duplicates["_id"]) == expected

    @pytest.mark.parametrize("multiple", [False, True])
    def test_duplicate_abbreviations(self, multiple, test_kind_list):
        """
        Test that duplicate abbreviations are detected. Use parametrization to test if single and multiple occurrences
        are detected.

        """
        test_kind_list[0]["abbreviation"] = "TST"

        if multiple:
            test_kind_list[3]["abbreviation"] = "EXV"

        duplicates = virtool.references.detect_duplicates(test_kind_list)

        for key in ["isolate_id", "name", "_id", "sequence_id"]:
            assert duplicates[key] == []

        expected = {"TST"}

        if multiple:
            expected.add("EXV")

        assert set(duplicates["abbreviation"]) == expected

    @pytest.mark.parametrize("multiple", [False, True])
    def test_duplicate_names(self, multiple, test_kind_list):
        """
        Test that duplicate virus names are detected. Use parametrization to test if single and multiple occurrences are
        detected.

        """
        # Add a duplicate virus name to the list.
        test_kind_list[1]["name"] = "Prunus virus F"

        if multiple:
            test_kind_list[3]["name"] = "Example virus"

        duplicates = virtool.references.detect_duplicates(test_kind_list)

        assert all([duplicates[key] == [] for key in ["isolate_id", "_id", "sequence_id"]])

        expected = {"prunus virus f"}

        if multiple:
            expected.add("example virus")

        assert set(duplicates["name"]) == expected

    @pytest.mark.parametrize("multiple", [False, True])
    def test_duplicate_sequence_ids(self, multiple, test_kind_list):
        """
        Test that duplicate sequence ids in a virus list are detected. Use parametrization to test if single and
        multiple occurrences are detected.

        """
        test_kind_list[0]["isolates"][0]["sequences"].append(
            dict(test_kind_list[0]["isolates"][0]["sequences"][0])
        )

        if multiple:
            test_kind_list[1]["isolates"][0]["sequences"].append(
                dict(test_kind_list[1]["isolates"][0]["sequences"][0])
            )

        duplicates = virtool.references.detect_duplicates(test_kind_list)

        assert all([duplicates[key] == [] for key in ["isolate_id", "_id", "name", "abbreviation"]])

        expected = {test_kind_list[0]["isolates"][0]["sequences"][0]["_id"]}

        if multiple:
            expected.add(test_kind_list[1]["isolates"][0]["sequences"][0]["_id"])

        assert set(duplicates["sequence_id"]) == expected
