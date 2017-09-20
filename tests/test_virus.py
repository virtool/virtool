import os
import sys
import json
import pytest
from string import ascii_lowercase, digits
from copy import deepcopy

import virtool.virus

TEST_FILES_PATH = os.path.join(sys.path[0], "tests", "test_files")
OLD_VIRUS_PATH = os.path.join(TEST_FILES_PATH, "old_virus.json")
OLD_HISTORY_PATH = os.path.join(TEST_FILES_PATH, "old_history.json")
OLD_SEQUENCES_PATH = os.path.join(TEST_FILES_PATH, "old_sequences.json")


@pytest.fixture("session")
def test_old_files():
    with open(OLD_VIRUS_PATH, "r") as f:
        virus = json.load(f)

    with open(OLD_HISTORY_PATH, "r") as f:
        history = json.load(f)

    with open(OLD_SEQUENCES_PATH, "r") as f:
        sequences = json.load(f)

    return virus, sequences, history


@pytest.fixture
def test_old(loop, test_old_files, test_motor):
    virus, sequences, history = test_old_files

    loop.run_until_complete(test_motor.viruses.insert_one(virus))
    loop.run_until_complete(test_motor.sequences.insert_many(sequences))
    loop.run_until_complete(test_motor.history.insert_many(history))

    return test_motor


class TestJoin:

    async def test(self, test_motor, test_virus, test_sequence, test_merged_virus):
        """
        Test that a virus is properly joined when only a ``virus_id`` is provided.

        """
        await test_motor.viruses.insert(test_virus)
        await test_motor.sequences.insert(test_sequence)

        joined = await virtool.virus.join(test_motor, "6116cba1")

        assert joined == test_merged_virus

    async def test_document(self, monkeypatch, mocker, test_motor, test_virus, test_sequence, test_merged_virus):
        """
        Test that the virus is joined using a passed ``document`` when provided. Ensure that another ``find_one`` call
        to the virus collection is NOT made.
         
        """
        stub = mocker.stub(name="find_one")

        async def async_stub(*args, **kwargs):
            stub(*args, **kwargs)
            return test_virus

        monkeypatch.setattr("motor.motor_asyncio.AsyncIOMotorCollection.find_one", async_stub)

        await test_motor.viruses.insert(test_virus)
        await test_motor.sequences.insert(test_sequence)

        assert not stub.called

        document = await test_motor.viruses.find_one()

        assert stub.called

        stub.reset_mock()

        assert not stub.called

        joined = await virtool.virus.join(test_motor, "6116cba1", document)

        assert not stub.called

        assert joined == test_merged_virus


class TestCheckNameAndAbbreviation:

    @pytest.mark.parametrize("name,abbreviation,return_value", [
        ("Foobar Virus", "FBR", False),
        ("Prunus virus F", "FBR", "Name already exists"),
        ("Foobar Virus", "PVF", "Abbreviation already exists"),
        ("Prunus virus F", "PVF", "Name and abbreviation already exist"),
    ])
    async def test(self, name, abbreviation, return_value, test_motor, test_virus):
        """
        Test that the function works properly for all possible inputs.
         
        """
        await test_motor.viruses.insert_one(test_virus)

        result = await virtool.virus.check_name_and_abbreviation(test_motor, name, abbreviation)

        assert result == return_value


class TestCheckVirus:

    def test_pass(self, test_merged_virus):
        """
        Test that a valid virus and sequence list results in return value of ``None``.
         
        """
        result = virtool.virus.check_virus(test_merged_virus)
        assert result is None

    def test_empty_isolate(self, test_merged_virus):
        """
        Test that an isolate with no sequences is detected.
         
        """
        test_merged_virus["isolates"][0]["sequences"] = list()

        result = virtool.virus.check_virus(test_merged_virus)

        assert result == {
            "empty_isolate": ["cab8b360"],
            "empty_sequence": False,
            "empty_virus": False,
            "isolate_inconsistency": False
        }

    def test_empty_sequence(self, test_merged_virus):
        """
        Test that a sequence with an empty ``sequence`` field is detected.
         
        """
        test_merged_virus["isolates"][0]["sequences"][0]["sequence"] = ""

        result = virtool.virus.check_virus(test_merged_virus)

        assert result == {
            "empty_isolate": False,
            "empty_sequence": [{
                "_id": "KX269872",
                "definition": "Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene, complete cds.",
                "host": "sweet cherry",
                "virus_id": "6116cba1",
                "isolate_id": "cab8b360",
                "sequence": ""
            }],
            "empty_virus": False,
            "isolate_inconsistency": False
        }

    def test_empty_virus(self, test_merged_virus):
        """
        Test that an virus with no isolates is detected.
         
        """
        test_merged_virus["isolates"] = []

        result = virtool.virus.check_virus(test_merged_virus)

        assert result == {
            "empty_isolate": False,
            "empty_sequence": False,
            "empty_virus": True,
            "isolate_inconsistency": False
        }

    def test_isolate_inconsistency(self, test_merged_virus, test_sequence):
        """
        Test that isolates in a single virus with disparate sequence counts are detected.

        """
        test_merged_virus["isolates"].append(dict(test_merged_virus["isolates"][0], id="foobar"))

        test_merged_virus["isolates"][1]["sequences"] = [
            dict(test_sequence, _id="foobar_1"),
            dict(test_sequence, _id="foobar_2")
        ]

        result = virtool.virus.check_virus(test_merged_virus)

        assert result == {
            "empty_isolate": False,
            "empty_sequence": False,
            "empty_virus": False,
            "isolate_inconsistency": True
        }


class TestUpdateLastIndexedVersion:

    async def test(self, test_motor, test_virus):
        """
        Test that function works as expected.
         
        """
        virus_1 = test_virus
        virus_2 = deepcopy(test_virus)

        virus_2.update({
            "_id": "foobar"
        })

        await test_motor.viruses.insert_many([virus_1, virus_2])

        await virtool.virus.update_last_indexed_version(test_motor, ["foobar"], 5)

        virus_1 = await test_motor.viruses.find_one({"_id": "6116cba1"})
        virus_2 = await test_motor.viruses.find_one({"_id": "foobar"})

        assert virus_1["version"] == 0
        assert virus_1["last_indexed_version"] == 0

        assert virus_2["version"] == 5
        assert virus_2["last_indexed_version"] == 5


class TestGetDefaultIsolate:

    def test(self, test_virus, test_isolate):
        """
        Test that the function can find the default isolate.
         
        """
        default_isolate = dict(test_isolate, isolate_id="foobar3", default=True)

        test_virus["isolates"] = [
            dict(test_isolate, isolate_id="foobar1", default=False),
            dict(test_isolate, isolate_id="foobar2", default=False),
            default_isolate,
            dict(test_isolate, isolate_id="foobar4", default=False)
        ]

        assert virtool.virus.get_default_isolate(test_virus) == default_isolate

    def test_processor(self, test_virus, test_isolate):
        """
        Test that the ``processor`` argument works.
         
        """

        default_isolate = dict(test_isolate, isolate_id="foobar3", default=True)

        expected = dict(default_isolate, processed=True)

        test_virus["isolates"] = [
            dict(test_isolate, isolate_id="foobar1", default=False),
            default_isolate
        ]

        def test_processor(isolate):
            return dict(isolate, processed=True)

        assert virtool.virus.get_default_isolate(test_virus, test_processor) == expected

    def test_no_default(self, test_virus):
        """
        Test that a ``ValueError`` is raised when the virus contains not default isolates.

        """
        test_virus["isolates"][0]["default"] = False

        with pytest.raises(ValueError) as err:
            virtool.virus.get_default_isolate(test_virus)

        assert "No default isolate found" in str(err)

    def test_multiple_defaults(self, test_virus, test_isolate):
        """
        Test that a ``ValueError`` is raised when the virus contains more than one default isolate.

        """
        extra_isolate = dict(test_isolate, isolate_id="foobar3", default=True)

        test_virus["isolates"].append(extra_isolate)

        with pytest.raises(ValueError) as err:
            virtool.virus.get_default_isolate(test_virus)

        assert "Found more than one" in str(err)


class TestGetNewIsolateId:

    async def test(self, test_motor, test_virus):
        await test_motor.viruses.insert(test_virus)

        new_id = await virtool.virus.get_new_isolate_id(test_motor)

        allowed = ascii_lowercase + digits

        assert all(c in allowed for c in new_id)

    async def test_exists(self, test_motor, test_virus, test_random_alphanumeric):
        """
        Test that a different ``isolate_id`` is generated if the first generated one already exists in the database.

        """
        next_choice = test_random_alphanumeric.next_choice[:8].lower()

        expected = test_random_alphanumeric.choices[1][:8].lower()

        test_virus["isolates"][0]["id"] = next_choice

        await test_motor.viruses.insert(test_virus)

        new_id = await virtool.virus.get_new_isolate_id(test_motor)

        assert new_id == expected

    async def test_excluded(self, test_motor, test_random_alphanumeric):
        """
        Test that a different ``isolate_id`` is generated if the first generated one is in the ``excluded`` list.

        """
        excluded = [test_random_alphanumeric.next_choice[:8].lower()]

        expected = test_random_alphanumeric.choices[1][:8].lower()

        new_id = await virtool.virus.get_new_isolate_id(test_motor, excluded=excluded)

        assert new_id == expected

    async def test_exists_and_excluded(self, test_motor, test_virus, test_random_alphanumeric):
        """
        Test that a different ``isolate_id`` is generated if the first generated one is in the ``excluded`` list.        

        """
        excluded = [test_random_alphanumeric.choices[2][:8].lower()]

        test_virus["isolates"][0]["id"] = test_random_alphanumeric.choices[1][:8].lower()

        await test_motor.viruses.insert(test_virus)

        expected = test_random_alphanumeric.choices[0][:8].lower()

        new_id = await virtool.virus.get_new_isolate_id(test_motor, excluded=excluded)

        assert new_id == expected


class TestMergeVirus:

    def test(self, test_virus, test_sequence, test_merged_virus):
        merged = virtool.virus.merge_virus(test_virus, [test_sequence])

        assert merged == test_merged_virus


class TestSplitVirus:

    def test(self, test_virus, test_sequence, test_merged_virus):
        virus, sequences = virtool.virus.split_virus(test_merged_virus)

        assert virus == test_virus
        assert sequences == [test_sequence]


class TestExtractIsolateIds:

    def test_merged_virus(self, test_merged_virus):
        isolate_ids = virtool.virus.extract_isolate_ids(test_merged_virus)
        assert isolate_ids == ["cab8b360"]

    def test_virus_document(self, test_virus):
        isolate_ids = virtool.virus.extract_isolate_ids(test_virus)
        assert isolate_ids == ["cab8b360"]

    def test_multiple(self, test_virus):
        test_virus["isolates"].append({
            "source_type": "isolate",
            "source_name": "b",
            "id": "foobar",
            "default": False
        })

        isolate_ids = virtool.virus.extract_isolate_ids(test_virus)

        assert set(isolate_ids) == {"cab8b360", "foobar"}

    def test_missing_isolates(self, test_virus):
        del test_virus["isolates"]

        with pytest.raises(KeyError):
            virtool.virus.extract_isolate_ids(test_virus)


class TestFindIsolate:

    def test(self, test_virus, test_isolate):
        new_isolate = dict(test_isolate, id="foobar", source_type="isolate", source_name="b")

        test_virus["isolates"].append(new_isolate)

        isolate = virtool.virus.find_isolate(test_virus["isolates"], "foobar")

        assert isolate == new_isolate

    def test_does_not_exist(self, test_virus):
        assert virtool.virus.find_isolate(test_virus["isolates"], "foobar") is None


class TestExtractSequenceIds:

    def test_valid(self, test_merged_virus):
        sequence_ids = virtool.virus.extract_sequence_ids(test_merged_virus)
        assert sequence_ids == ["KX269872"]

    def test_missing_isolates(self, test_merged_virus):
        del test_merged_virus["isolates"]

        with pytest.raises(KeyError) as err:
            virtool.virus.extract_sequence_ids(test_merged_virus)

        assert "'isolates'" in str(err)

    def test_empty_isolates(self, test_merged_virus):
        test_merged_virus["isolates"] = list()

        with pytest.raises(ValueError) as err:
            virtool.virus.extract_sequence_ids(test_merged_virus)

        assert "Empty isolates list" in str(err)

    def test_missing_sequences(self, test_merged_virus):
        del test_merged_virus["isolates"][0]["sequences"]

        with pytest.raises(KeyError) as err:
            virtool.virus.extract_sequence_ids(test_merged_virus)

        assert "missing sequences field" in str(err)

    def test_empty_sequences(self, test_merged_virus):
        test_merged_virus["isolates"][0]["sequences"] = list()

        with pytest.raises(ValueError) as err:
            virtool.virus.extract_sequence_ids(test_merged_virus)

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

        formatted = virtool.virus.format_isolate_name(test_isolate)

        if source_type and source_name:
            assert formatted == "Isolate 8816 - v2"
        else:
            assert formatted == "Unnamed Isolate"


class TestUpgradeVirusAndHistoryFormat:

    async def test(self, test_old, capsys):
        with capsys.disabled():
            await virtool.virus.upgrade_legacy_virus_and_history(test_old, "4114ebff")
