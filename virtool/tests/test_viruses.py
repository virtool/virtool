import os
import pytest
import virtool.viruses

from copy import deepcopy


FIXTURE_DIR = os.path.join(os.path.dirname(os.path.realpath(__file__)), "test_files")


@pytest.fixture
def duplicate_result():
    return {"isolate_id": [], "_id": [], "name": [], "sequence_id": [], "abbreviation": []}


class TestMergeVirus:

    def test_valid(self, test_virus, test_sequence, test_merged_virus):
        merged = virtool.viruses.merge_virus(test_virus, [test_sequence])

        assert merged == test_merged_virus


class TestSplitVirus:

    def test_valid(self, test_virus, test_sequence, test_merged_virus):
        virus, sequences = virtool.viruses.split_virus(test_merged_virus)

        assert virus == test_virus
        assert sequences == [test_sequence]


class TestExtractIsolateIds:

    def test_merged_virus(self, test_merged_virus):
        isolate_ids = virtool.viruses.extract_isolate_ids(test_merged_virus)
        assert isolate_ids == ["cab8b360"]

    def test_virus_document(self, test_virus):
        isolate_ids = virtool.viruses.extract_isolate_ids(test_virus)
        assert isolate_ids == ["cab8b360"]

    def test_multiple(self, test_virus):
        test_virus["isolates"].append({
            "source_type": "isolate",
            "source_name": "b",
            "isolate_id": "foobar",
            "default": False
        })

        isolate_ids = virtool.viruses.extract_isolate_ids(test_virus)

        assert set(isolate_ids) == {"cab8b360", "foobar"}

    def test_missing_isolates(self, test_virus):
        del test_virus["isolates"]

        with pytest.raises(KeyError):
            virtool.viruses.extract_isolate_ids(test_virus)


class TestExtractSequenceIds:

    def test_valid(self, test_merged_virus):
        sequence_ids = virtool.viruses.extract_sequence_ids(test_merged_virus)
        assert sequence_ids == ["KX269872"]

    def test_missing_isolates(self, test_merged_virus):
        del test_merged_virus["isolates"]

        with pytest.raises(KeyError) as err:
            virtool.viruses.extract_sequence_ids(test_merged_virus)

        assert "'isolates'" in str(err)

    def test_empty_isolates(self, test_merged_virus):
        test_merged_virus["isolates"] = list()

        with pytest.raises(ValueError) as err:
            virtool.viruses.extract_sequence_ids(test_merged_virus)

        assert "Empty isolates list" in str(err)

    def test_missing_sequences(self, test_merged_virus):
        del test_merged_virus["isolates"][0]["sequences"]

        with pytest.raises(KeyError) as err:
            virtool.viruses.extract_sequence_ids(test_merged_virus)

        assert "missing sequences field" in str(err)

    def test_empty_sequences(self, test_merged_virus):
        test_merged_virus["isolates"][0]["sequences"] = list()

        with pytest.raises(ValueError) as err:
            virtool.viruses.extract_sequence_ids(test_merged_virus)

        assert "Empty sequences list" in str(err)


class TestReadImportFile:

    def test_valid(self):
        body = virtool.viruses.read_import_file(os.path.join(FIXTURE_DIR, "files", "import.json.gz"))

        expected_names = {
            "Iresine viroid",
            "Blueberry shock virus",
            "Raphanus sativus cryptic virus 2",
            "Butterbur mosaic virus",
            "Cucumber mosaic virus"
        }

        assert {virus["name"] for virus in body} == expected_names

    def test_non_existent(self):
        with pytest.raises(FileNotFoundError):
            virtool.viruses.read_import_file(os.path.join(FIXTURE_DIR, "file", "import.json"))


class TestVerifyVirusList:

    def test_valid(self, test_virus_list):
        """
        Test that a valid virus list returns no duplicates or errors.
         
        """
        result = virtool.viruses.verify_virus_list(test_virus_list)
        assert result == (None, None)

    @pytest.mark.parametrize("multiple", [False, True])
    def test_duplicate_virus_ids(self, multiple, test_virus_list):
        test_virus_list[0]["_id"] = "067jz0t3"

        if multiple:
            test_virus_list[3]["_id"] = "067jz213"

        duplicates, error = virtool.viruses.verify_virus_list(test_virus_list)

        assert error is None

        assert all([duplicates[key] == [] for key in ["isolate_id", "name", "abbreviation", "sequence_id"]])

        expected = {"067jz0t3"}

        if multiple:
            expected.add("067jz213")

        assert set(duplicates["_id"]) == expected

    def test_empty_abbreviations(self, test_virus_list, duplicate_result):
        """
        Ensure that abbreviations with value "" are not counted as duplicates.

        """
        test_virus_list[0]["abbreviation"] = ""
        test_virus_list[1]["abbreviation"] = ""

        result = virtool.viruses.verify_virus_list(test_virus_list)

        assert result == (None, None)

    @pytest.mark.parametrize("multiple", [False, True])
    def test_duplicate_abbreviations(self, multiple, test_virus_list):
        """
        Test that duplicate abbreviations are detected. Use parametrization to test if single and multiple occurrences
        are detected.
        
        """
        test_virus_list[0]["abbreviation"] = "TST"

        if multiple:
            test_virus_list[3]["abbreviation"] = "EXV"

        duplicates, error = virtool.viruses.verify_virus_list(test_virus_list)

        assert error is None

        for key in ["isolate_id", "name", "_id", "sequence_id"]:
            assert duplicates[key] == []

        expected = {"TST"}

        if multiple:
            expected.add("EXV")

        assert set(duplicates["abbreviation"]) == expected

    @pytest.mark.parametrize("multiple", [False, True])
    def test_duplicate_names(self, multiple, test_virus_list):
        """
        Test that duplicate virus names are detected. Use parametrization to test if single and multiple occurrences are
        detected.
         
        """
        # Add a duplicate virus name to the list.
        test_virus_list[1]["name"] = "Prunus virus F"

        if multiple:
            test_virus_list[3]["name"] = "Example virus"

        duplicates, error = virtool.viruses.verify_virus_list(test_virus_list)

        assert error is None

        assert all([duplicates[key] == [] for key in ["isolate_id", "_id", "sequence_id"]])

        expected = {"prunus virus f"}

        if multiple:
            expected.add("example virus")

        assert set(duplicates["name"]) == expected

    @pytest.mark.parametrize("multiple", [False, True])
    def test_duplicate_sequence_ids(self, multiple, test_virus_list):
        """
        Test that duplicate sequence ids in a virus list are detected. Use parametrization to test if single and
        multiple occurrences are detected.
    
        """
        test_virus_list[0]["isolates"][0]["sequences"].append(
            dict(test_virus_list[0]["isolates"][0]["sequences"][0])
        )

        if multiple:
            test_virus_list[1]["isolates"][0]["sequences"].append(
                dict(test_virus_list[1]["isolates"][0]["sequences"][0])
            )

        duplicates, error = virtool.viruses.verify_virus_list(test_virus_list)

        assert error is None

        assert all([duplicates[key] == [] for key in ["isolate_id", "_id", "name", "abbreviation"]])

        expected = {test_virus_list[0]["isolates"][0]["sequences"][0]["_id"]}

        if multiple:
            expected.add(test_virus_list[1]["isolates"][0]["sequences"][0]["_id"])

        assert set(duplicates["sequence_id"]) == expected

    def test_isolate_inconsistency(self, test_virus_list):
        """
        Test that viruses containing isolates associated with disparate numbers of sequences are detected.

        """
        extra_isolate = deepcopy(test_virus_list[0]["isolates"][0])

        test_virus_list[0]["isolates"].append(extra_isolate)

        extra_isolate.update({
            "_id": "extra",
            "isolate_id": "extra"
        })

        extra_isolate["sequences"][0].update({
            "_id": "extra_0",
            "isolate_id": "extra"
        })

        extra_sequence = dict(test_virus_list[0]["isolates"][0]["sequences"][0])

        extra_sequence.update({
            "_id": "extra_1",
            "isolate_id": "extra"
        })

        extra_isolate["sequences"].append(extra_sequence)

        duplicates, errors = virtool.viruses.verify_virus_list(test_virus_list)

        assert duplicates is None

        assert errors["prunus virus f"]["isolate_inconsistency"]

    @pytest.mark.parametrize("multiple", [False, True])
    def test_empty_virus(self, multiple, test_virus_list):
        """
        Test that viruses with no isolates are detected. Use parametrization to test if single and multiple occurrences
        are detected.
    
        """
        test_virus_list[0]["isolates"] = list()

        if multiple:
            test_virus_list[1]["isolates"] = list()

        duplicates, errors = virtool.viruses.verify_virus_list(test_virus_list)

        assert duplicates is None

        assert errors["prunus virus f"]["empty_virus"]

        if multiple:
            assert errors["test virus"]["empty_virus"] is True

    @pytest.mark.parametrize("multiple", [False, True])
    def test_empty_isolate(self, multiple, test_virus_list):
        """
        Test that isolates with no sequences are detected. Use parametrization to test if single and multiple
        occurrences are detected.

        """
        test_virus_list[0]["isolates"][0]["sequences"] = list()

        if multiple:
            test_virus_list[1]["isolates"][0]["sequences"] = list()

        duplicates, errors = virtool.viruses.verify_virus_list(test_virus_list)

        assert errors["prunus virus f"]["empty_isolate"] == ["cab8b360"]

        if multiple:
            assert errors["test virus"]["empty_isolate"] == ["second_0"]

    @pytest.mark.parametrize("multiple", [False, True])
    def test_empty_sequences(self, multiple, test_virus_list):
        """
        Test that sequences with empty ``sequence`` fields are detected. Use parametrization to test if single and
        multiple occurrences are detected.
         
        """
        test_virus_list[1]["isolates"][0]["sequences"][0]["sequence"] = ""

        if multiple:
            test_virus_list[2]["isolates"][0]["sequences"][0]["sequence"] = ""

        duplicates, errors = virtool.viruses.verify_virus_list(test_virus_list)

        assert duplicates is None

        assert errors["test virus"]["empty_sequence"][0]["_id"] == "second_seq_0"

        if multiple:
            assert errors["example virus"]["empty_sequence"][0]["_id"] == "third_seq_0"
