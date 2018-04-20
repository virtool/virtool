import os
import pytest
from copy import deepcopy

import virtool.db.refs
import virtool.refs


FIXTURE_DIR = os.path.join(os.path.dirname(os.path.realpath(__file__)), "test_files")


@pytest.fixture
def iresine():
    return {
        "last_indexed_version": 0,
        "abbreviation": "IrVd",
        "_id": "008lgo",
        "name": "Iresine viroid",
        "isolates": [
            {
                "source_name": "",
                "id": "6kplarn7",
                "source_type": "unknown",
                "default": True
            }
        ]
    }


@pytest.fixture
def iresine_sequence():
    return {
        "sequence": "CGTGGTT",
        "_id": "NC_003613",
        "host": "Iresine herbstii",
        "definition": "Iresine viroid complete sequence",
        "length": 370,
        "isolate_id": "6kplarn7"
    }


class TestValidateKinds:

    def test(self, test_kind_list):
        """
        Test that a valid virus list returns no duplicates or errors.

        """
        result = virtool.refs.validate_kinds(test_kind_list)
        assert result == (None, None)

    @pytest.mark.parametrize("multiple", [False, True])
    def test_duplicate_kind_ids(self, multiple, test_kind_list):
        test_kind_list[0]["_id"] = "067jz0t3"

        if multiple:
            test_kind_list[3]["_id"] = "067jz213"

        duplicates, error = virtool.refs.validate_kinds(test_kind_list)

        assert error is None

        assert all([duplicates[key] == [] for key in ["isolate_id", "name", "abbreviation", "sequence_id"]])

        expected = {"067jz0t3"}

        if multiple:
            expected.add("067jz213")

        assert set(duplicates["_id"]) == expected

    def test_empty_abbreviations(self, test_kind_list):
        """
        Ensure that abbreviations with value "" are not counted as duplicates.

        """
        test_kind_list[0]["abbreviation"] = ""
        test_kind_list[1]["abbreviation"] = ""

        result = virtool.refs.validate_kinds(test_kind_list)

        assert result == (None, None)

    @pytest.mark.parametrize("multiple", [False, True])
    def test_duplicate_abbreviations(self, multiple, test_kind_list):
        """
        Test that duplicate abbreviations are detected. Use parametrization to test if single and multiple occurrences
        are detected.

        """
        test_kind_list[0]["abbreviation"] = "TST"

        if multiple:
            test_kind_list[3]["abbreviation"] = "EXV"

        duplicates, error = virtool.refs.validate_kinds(test_kind_list)

        assert error is None

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

        duplicates, error = virtool.refs.validate_kinds(test_kind_list)

        assert error is None

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

        duplicates, error = virtool.refs.validate_kinds(test_kind_list)

        assert error is None

        assert all([duplicates[key] == [] for key in ["isolate_id", "_id", "name", "abbreviation"]])

        expected = {test_kind_list[0]["isolates"][0]["sequences"][0]["_id"]}

        if multiple:
            expected.add(test_kind_list[1]["isolates"][0]["sequences"][0]["_id"])

        assert set(duplicates["sequence_id"]) == expected

    def test_isolate_inconsistency(self, test_kind_list):
        """
        Test that kinds containing isolates associated with disparate numbers of sequences are detected.

        """
        extra_isolate = deepcopy(test_kind_list[0]["isolates"][0])

        test_kind_list[0]["isolates"].append(extra_isolate)

        extra_isolate.update({
            "_id": "extra",
            "isolate_id": "extra"
        })

        extra_isolate["sequences"][0].update({
            "_id": "extra_0",
            "isolate_id": "extra"
        })

        extra_sequence = dict(test_kind_list[0]["isolates"][0]["sequences"][0])

        extra_sequence.update({
            "_id": "extra_1",
            "isolate_id": "extra"
        })

        extra_isolate["sequences"].append(extra_sequence)

        duplicates, errors = virtool.refs.validate_kinds(test_kind_list)

        assert duplicates is None

        assert errors["prunus virus f"]["isolate_inconsistency"]

    @pytest.mark.parametrize("multiple", [False, True])
    def test_empty_kind(self, multiple, test_kind_list):
        """
        Test that kinds with no isolates are detected. Use parametrization to test if single and multiple occurrences
        are detected.

        """
        test_kind_list[0]["isolates"] = list()

        if multiple:
            test_kind_list[1]["isolates"] = list()

        duplicates, errors = virtool.refs.validate_kinds(test_kind_list)

        assert duplicates is None

        assert errors["prunus virus f"]["empty_kind"]

        if multiple:
            assert errors["test virus"]["empty_kind"] is True

    @pytest.mark.parametrize("multiple", [False, True])
    def test_empty_isolate(self, multiple, test_kind_list):
        """
        Test that isolates with no sequences are detected. Use parametrization to test if single and multiple
        occurrences are detected.

        """
        test_kind_list[0]["isolates"][0]["sequences"] = list()

        if multiple:
            test_kind_list[1]["isolates"][0]["sequences"] = list()

        _, errors = virtool.refs.validate_kinds(test_kind_list)

        assert errors["prunus virus f"]["empty_isolate"] == ["cab8b360"]

        if multiple:
            assert errors["test virus"]["empty_isolate"] == ["second_0"]

    @pytest.mark.parametrize("multiple", [False, True])
    def test_empty_sequences(self, multiple, test_kind_list):
        """
        Test that sequences with empty ``sequence`` fields are detected. Use parametrization to test if single and
        multiple occurrences are detected.

        """
        test_kind_list[1]["isolates"][0]["sequences"][0]["sequence"] = ""

        if multiple:
            test_kind_list[2]["isolates"][0]["sequences"][0]["sequence"] = ""

        duplicates, errors = virtool.refs.validate_kinds(test_kind_list)

        assert duplicates is None

        assert errors["test virus"]["empty_sequence"][0]["_id"] == "second_seq_0"

        if multiple:
            assert errors["example virus"]["empty_sequence"][0]["_id"] == "third_seq_0"


class TestImportFile:

    @pytest.mark.parametrize("errors,dups", [(True, True), (True, False), (False, True), (False, False)])
    async def test(self, errors, dups, mocker, test_motor, test_dispatch, import_data):

        m = mocker.patch(
            "virtool.refs.validate_kinds",
            return_value=("Duplicates" if dups else None, "Errors" if errors else None)
        )

        await test_motor.status.insert_one({
            "_id": "virus_import"
        })

        await virtool.db.refs.import_data(test_motor, test_dispatch, "foo", import_data, "test")

        expected = {
            "_id": "virus_import",
            "version": "v0.2.0",
            "file_created_at": "2017-09-27T21:32:51.901919+00:00",
            "errors": None,
            "duplicates": None
        }

        expected["id"] = expected.pop("_id")

        assert test_dispatch.stub.call_args_list[0][0] == (
            "status",
            "update",
            expected
        )

        if errors or dups:
            if errors:
                expected["errors"] = "Errors"

            if dups:
                expected["duplicates"] = "Duplicates"

            expected["_id"] = expected.pop("id")

            assert await test_motor.status.find_one() == expected

            expected["id"] = expected.pop("_id")

            assert m.call_args[0][0] is import_data["data"]

            assert test_dispatch.stub.call_args_list[1][0] == (
                "status",
                "update",
                expected
            )

            return

        expected["totals"] = {
            "kinds": 1419,
            "isolates": 2053,
            "sequences": 2752
        }

        for i in range(0, 20):
            expected["inserted"] = i * 50

            assert test_dispatch.stub.call_args_list[1 + i][0] == (
                "status",
                "update",
                expected
            )

        expected.update({
            "inserted": 1419,
            "totals": {
                "kinds": 1419,
                "isolates": 2053,
                "sequences": 2752
            }
        })

        expected["_id"] = expected.pop("id")

        assert await test_motor.status.find_one() == expected
