import os
import pytest
import virtool.virusutils

from virtool.tests.fixtures_viruses import FIXTURE_DIR


@pytest.fixture
def duplicate_result():
    return {"isolate_id": [], "_id": [], "name": [], "sequence_id": [], "abbreviation": []}


class TestCheckVirus:

    @pytest.mark.gen_test
    def test_valid(self, virus_document, sequences_list):
        """
        Ensure that :meth:`.check_virus` returns no errors (``None``) for a valid virus document and sequence list.

        """
        result = yield virtool.virusutils.check_virus(virus_document, sequences_list)

        assert result is None

    @pytest.mark.gen_test
    def test_isolate_inconsistency(self, virus_document, sequences_list):
        """
        Ensure that :meth:`.check_virus` detects a mismatch in sequence count between isolates of the same virus.

        """
        extra_sequence = dict(sequences_list[0])

        extra_sequence["isolate_id"] = "dqz9u58g"

        sequences_list.append(extra_sequence)

        result = yield virtool.virusutils.check_virus(virus_document, sequences_list)

        assert result == {
            "isolate_inconsistency": True,
            "empty_virus": False,
            "empty_isolate": False,
            "empty_sequence": False
        }

    @pytest.mark.gen_test
    def test_empty_virus(self, virus_document, sequences_list):
        """
        Ensure that :meth:`.check_virus` detects isolates that have no associated sequences.

        """
        virus_document["isolates"] = list()

        result = yield virtool.virusutils.check_virus(virus_document, sequences_list)

        assert result == {
            "isolate_inconsistency": False,
            "empty_virus": True,
            "empty_isolate": False,
            "empty_sequence": False
        }

    @pytest.mark.gen_test
    def test_empty_isolate(self, virus_document, sequences_list):
        """
        Ensure that :meth:`.check_virus` detects isolates that have no associated sequences.

        """
        sequences_list[0]["isolate_id"] = "nothing"

        result = yield virtool.virusutils.check_virus(virus_document, sequences_list)

        assert result == {
            "isolate_inconsistency": False,
            "empty_virus": False,
            "empty_isolate": ["dqz9u58g"],
            "empty_sequence": False
        }

    @pytest.mark.gen_test
    def test_empty_sequence(self, virus_document, sequences_list):
        sequences_list[0]["isolate_id"] = "nothing"

        result = yield virtool.virusutils.check_virus(virus_document, sequences_list)

        assert result == {
            "isolate_inconsistency": False,
            "empty_virus": False,
            "empty_isolate": ["dqz9u58g"],
            "empty_sequence": False
        }


class TestMergeVirus:

    def test_valid(self, virus_document, sequences_list, merged_virus):
        merged = virtool.virusutils.merge_virus(virus_document, sequences_list)

        assert merged == merged_virus


class TestSplitVirus:

    def test_valid(self, merged_virus, virus_document, sequences_list):
        virus, sequences = virtool.virusutils.split_virus(merged_virus)

        assert virus == virus_document
        assert sequences == sequences_list


class TestExtractIsolateIds:

    @pytest.mark.gen_test
    def test_merged_virus(self, merged_virus):
        isolate_ids = yield virtool.virusutils.extract_isolate_ids(merged_virus)

        assert set(isolate_ids) == {"dqz9u58g", "sad23gat"}

    @pytest.mark.gen_test
    def test_virus_document(self, virus_document):
        isolate_ids = yield virtool.virusutils.extract_isolate_ids(virus_document)

        assert set(isolate_ids) == {"dqz9u58g", "sad23gat"}

    @pytest.mark.gen_test
    def test_missing_isolates(self, virus_document):
        del virus_document["isolates"]

        with pytest.raises(KeyError) as err:
            yield virtool.virusutils.extract_isolate_ids(virus_document)

        assert "'isolates'" in str(err)


class TestExtractSequenceIds:

    @pytest.mark.gen_test
    def test_valid(self, merged_virus):
        sequence_ids = yield virtool.virusutils.extract_sequence_ids(merged_virus)

        assert set(sequence_ids) == {"NC_001440", "NC_001441"}

    @pytest.mark.gen_test
    def test_missing_isolates(self, merged_virus):
        del merged_virus["isolates"]

        with pytest.raises(KeyError) as err:
            yield virtool.virusutils.extract_sequence_ids(merged_virus)

        assert "'isolates'" in str(err)

    @pytest.mark.gen_test
    def test_empty_isolates(self, merged_virus):
        merged_virus["isolates"] = list()

        with pytest.raises(ValueError) as err:
            yield virtool.virusutils.extract_sequence_ids(merged_virus)

        assert "Empty isolates list" in str(err)

    @pytest.mark.gen_test
    def test_missing_sequences(self, merged_virus):
        del merged_virus["isolates"][0]["sequences"]

        with pytest.raises(KeyError) as err:
            yield virtool.virusutils.extract_sequence_ids(merged_virus)

        assert "missing sequences field" in str(err)

    @pytest.mark.gen_test
    def test_empty_sequences(self, merged_virus):
        merged_virus["isolates"][0]["sequences"] = list()

        with pytest.raises(ValueError) as err:
            yield virtool.virusutils.extract_sequence_ids(merged_virus)

        assert "Empty sequences list" in str(err)


class TestReadImportFile:

    @pytest.mark.gen_test
    def test_valid(self):
        body = yield virtool.virusutils.read_import_file(os.path.join(FIXTURE_DIR, "files", "import.json.gz"))

        expected_names = {
            "Iresine viroid",
            "Blueberry shock virus",
            "Raphanus sativus cryptic virus 2",
            "Butterbur mosaic virus",
            "Cucumber mosaic virus"
        }

        assert {virus["name"] for virus in body} == expected_names

    @pytest.mark.gen_test
    def test_non_existent(self):
        with pytest.raises(FileNotFoundError):
            yield virtool.virusutils.read_import_file(os.path.join(FIXTURE_DIR, "file", "import.json"))


class TestVerifyVirusList:

    @pytest.mark.gen_test
    def test_valid(self, virus_list):
        result = yield virtool.virusutils.verify_virus_list(virus_list)

        assert result == (None, None)

    @pytest.mark.gen_test
    def test_duplicate_virus_id(self, virus_list, duplicate_result):
        virus_list[0]["_id"] = "067jz0t3"
        result = yield virtool.virusutils.verify_virus_list(virus_list)

        duplicate_result["_id"] = ["067jz0t3"]

        assert result == (duplicate_result, None)

    @pytest.mark.gen_test
    def test_duplicate_virus_ids(self, virus_list):
        virus_list[0]["_id"] = "067jz0t3"
        virus_list[3]["_id"] = "067jz213"

        duplicates, error = yield virtool.virusutils.verify_virus_list(virus_list)

        assert error is None

        for key in ["isolate_id", "name", "abbreviation", "sequence_id"]:
            assert duplicates[key] == []

        assert set(duplicates["_id"]) == {"067jz0t3", "067jz213"}

    @pytest.mark.gen_test
    def test_empty_abbreviations(self, virus_list, duplicate_result):
        """
        Ensure that duplicate abbreviations with value "" are not counted as duplicates.

        """
        virus_list[0]["abbreviation"] = ""
        virus_list[1]["abbreviation"] = ""

        result = yield virtool.virusutils.verify_virus_list(virus_list)

        assert result == (None, None)

    @pytest.mark.gen_test
    def test_duplicate_abbreviation(self, virus_list, duplicate_result):
        virus_list[0]["abbreviation"] = "TST"
        result = yield virtool.virusutils.verify_virus_list(virus_list)

        duplicate_result["abbreviation"] = ["TST"]

        assert result == (duplicate_result, None)

    @pytest.mark.gen_test
    def test_duplicate_virus_abbreviations(self, virus_list):
        virus_list[0]["abbreviation"] = "TST"
        virus_list[3]["abbreviation"] = "EXV"

        duplicates, error = yield virtool.virusutils.verify_virus_list(virus_list)

        assert error is None

        for key in ["isolate_id", "name", "_id", "sequence_id"]:
            assert duplicates[key] == []

        assert set(duplicates["abbreviation"]) == {"TST", "EXV"}

    @pytest.mark.gen_test
    def test_duplicate_name(self, virus_list, duplicate_result):
        virus_list[1]["name"] = "Cucumber mosaic Virus"
        result = yield virtool.virusutils.verify_virus_list(virus_list)

        duplicate_result["name"] = ["cucumber mosaic virus"]

        assert result == (duplicate_result, None)

    @pytest.mark.gen_test
    def test_duplicate_virus_names(self, virus_list):
        virus_list[0]["name"] = "Test virus"
        virus_list[3]["name"] = "Example virus"

        duplicates, error = yield virtool.virusutils.verify_virus_list(virus_list)

        assert error is None

        for key in ["isolate_id", "abbreviation", "_id", "sequence_id"]:
            assert duplicates[key] == []

        assert set(duplicates["name"]) == {"test virus", "example virus"}

    @pytest.mark.gen_test
    def test_duplicate_sequence_id(self, virus_list, duplicate_result):
        virus_list[2]["isolates"][0]["sequences"][0]["_id"] = "NC_001440"

        result = yield virtool.virusutils.verify_virus_list(virus_list)

        duplicate_result["sequence_id"] = ["NC_001440"]

        assert result == (duplicate_result, None)

    @pytest.mark.gen_test
    def test_duplicate_sequence_ids(self, virus_list, duplicate_result):
        virus_list[2]["isolates"][0]["sequences"][0]["_id"] = "NC_001440"
        virus_list[2]["isolates"][1]["sequences"][0]["_id"] = "NC_001441"

        duplicates, errors = yield virtool.virusutils.verify_virus_list(virus_list)

        duplicate_result["sequence_id"] = ["NC_001440", "NC_001441"]

        assert errors is None

        for key in ["_id", "isolate_id", "name", "abbreviation"]:
            assert duplicates[key] == []

        assert set(duplicates["sequence_id"]) == {"NC_001440", "NC_001441"}

    @pytest.mark.gen_test
    def test_isolate_inconsistency(self, virus_list):
        extra_sequence = dict(virus_list[0]["isolates"][0]["sequences"][0])

        extra_sequence["isolate_id"] = "third_0"
        extra_sequence["_id"] = "extra"

        virus_list[2]["isolates"][0]["sequences"].append(extra_sequence)

        duplicates, errors = yield virtool.virusutils.verify_virus_list(virus_list)

        assert duplicates is None

        assert len(([x for x in errors.values() if x is None])) == 3

        assert errors["example virus"]["isolate_inconsistency"]

    @pytest.mark.gen_test
    def test_isolate_inconsistencies(self, virus_list):
        extra_sequence = dict(virus_list[0]["isolates"][0]["sequences"][0])

        extra_sequence.update({
            "_id": "extra",
            "isolate_id": "third_0"
        })

        virus_list[2]["isolates"][0]["sequences"].append(extra_sequence)

        another_extra_sequence = dict(extra_sequence)

        another_extra_sequence.update({
            "_id": "another",
            "isolate_id": "second_0"
        })

        virus_list[1]["isolates"][0]["sequences"].append(another_extra_sequence)

        duplicates, errors = yield virtool.virusutils.verify_virus_list(virus_list)

        assert duplicates is None

        assert len(([x for x in errors.values() if x is None])) == 2

        assert errors["example virus"]["isolate_inconsistency"]
        assert errors["test virus"]["isolate_inconsistency"]

    @pytest.mark.gen_test
    def test_empty_virus(self, virus_list):
        virus_list[0]["isolates"] = list()

        duplicates, errors = yield virtool.virusutils.verify_virus_list(virus_list)

        assert duplicates is None

        assert len(([x for x in errors.values() if x is None])) == 3

        assert errors["cucumber mosaic virus"]["empty_virus"]

    @pytest.mark.gen_test
    def test_empty_viruses(self, virus_list):
        virus_list[0]["isolates"] = list()
        virus_list[1]["isolates"] = list()

        duplicates, errors = yield virtool.virusutils.verify_virus_list(virus_list)

        assert duplicates is None

        assert len(([x for x in errors.values() if x is None])) == 2

        assert errors["cucumber mosaic virus"]["empty_virus"] is True
        assert errors["test virus"]["empty_virus"] is True

    @pytest.mark.gen_test
    def test_empty_isolate(self, virus_list):
        virus_list[1]["isolates"][0]["sequences"] = list()

        duplicates, errors = yield virtool.virusutils.verify_virus_list(virus_list)

        assert duplicates is None

        assert len(([x for x in errors.values() if x is None])) == 3

        assert errors["test virus"]["empty_isolate"] == ["second_0"]

    @pytest.mark.gen_test
    def test_empty_isolates(self, virus_list):
        virus_list[1]["isolates"][0]["sequences"] = list()
        virus_list[2]["isolates"][0]["sequences"] = list()

        duplicates, errors = yield virtool.virusutils.verify_virus_list(virus_list)

        assert duplicates is None

        assert len(([x for x in errors.values() if x is None])) == 2

        assert errors["example virus"]["empty_isolate"] == ["third_0"]
        assert errors["test virus"]["empty_isolate"] == ["second_0"]

    @pytest.mark.gen_test
    def test_empty_sequence(self, virus_list):
        virus_list[1]["isolates"][0]["sequences"][0]["sequence"] = ""

        duplicates, errors = yield virtool.virusutils.verify_virus_list(virus_list)

        assert duplicates is None

        assert len(([x for x in errors.values() if x is None])) == 3

        assert errors["test virus"]["empty_sequence"][0]["_id"] == "second_seq_0"

    @pytest.mark.gen_test
    def test_empty_sequences(self, virus_list):
        virus_list[1]["isolates"][0]["sequences"][0]["sequence"] = ""
        virus_list[2]["isolates"][0]["sequences"][0]["sequence"] = ""

        duplicates, errors = yield virtool.virusutils.verify_virus_list(virus_list)

        assert duplicates is None

        assert len(([x for x in errors.values() if x is None])) == 2

        assert errors["test virus"]["empty_sequence"][0]["_id"] == "second_seq_0"
        assert errors["example virus"]["empty_sequence"][0]["_id"] == "third_seq_0"


