import os
import sys
import json
import pytest
from string import ascii_lowercase, digits
from copy import deepcopy

import virtool.db.species
import virtool.species

TEST_FILES_PATH = os.path.join(sys.path[0], "tests", "test_files")
OLD_SPECIES_PATH = os.path.join(TEST_FILES_PATH, "old_virus.json")
OLD_HISTORY_PATH = os.path.join(TEST_FILES_PATH, "old_history.json")
OLD_SEQUENCES_PATH = os.path.join(TEST_FILES_PATH, "old_sequences.json")


@pytest.fixture("session")
def test_old_files():
    with open(OLD_SPECIES_PATH, "r") as f:
        species = json.load(f)

    with open(OLD_HISTORY_PATH, "r") as f:
        history = json.load(f)

    with open(OLD_SEQUENCES_PATH, "r") as f:
        sequences = json.load(f)

    return species, sequences, history


@pytest.fixture
def test_old(loop, test_old_files, test_motor):
    species, sequences, history = test_old_files

    loop.run_until_complete(test_motor.species.insert_one(species))
    loop.run_until_complete(test_motor.sequences.insert_many(sequences))
    loop.run_until_complete(test_motor.history.insert_many(history))

    return test_motor


class TestJoin:

    async def test(self, test_motor, test_species, test_sequence, test_merged_species):
        """
        Test that a species is properly joined when only a ``species_id`` is provided.

        """
        await test_motor.species.insert(test_species)
        await test_motor.sequences.insert(test_sequence)

        joined = await virtool.db.species.join(test_motor, "6116cba1")

        assert joined == test_merged_species

    async def test_document(self, monkeypatch, mocker, test_motor, test_species, test_sequence, test_merged_species):
        """
        Test that the species is joined using a passed ``document`` when provided. Ensure that another ``find_one`` call
        to the species collection is NOT made.

        """
        stub = mocker.stub(name="find_one")

        async def async_stub(*args, **kwargs):
            stub(*args, **kwargs)
            return test_species

        monkeypatch.setattr("motor.motor_asyncio.AsyncIOMotorCollection.find_one", async_stub)

        await test_motor.species.insert(test_species)
        await test_motor.sequences.insert(test_sequence)

        assert not stub.called

        document = await test_motor.species.find_one()

        assert stub.called

        stub.reset_mock()

        assert not stub.called

        joined = await virtool.db.species.join(test_motor, "6116cba1", document)

        assert not stub.called

        assert joined == test_merged_species


@pytest.mark.parametrize("name,abbreviation,return_value", [
    ("Foobar Virus", "FBR", False),
    ("Prunus virus F", "FBR", "Name already exists"),
    ("Foobar Virus", "PVF", "Abbreviation already exists"),
    ("Prunus virus F", "PVF", "Name and abbreviation already exist"),
])
async def test_check_name_and_abbreviation(name, abbreviation, return_value, test_motor, test_species):
    """
    Test that the function works properly for all possible inputs.

    """
    await test_motor.species.insert_one(test_species)

    result = await virtool.db.species.check_name_and_abbreviation(test_motor, name, abbreviation)

    assert result == return_value


class TestValidateSpecies:

    def test_pass(self, test_merged_species):
        """
        Test that a valid species and sequence list results in return value of ``None``.

        """
        result = virtool.species.validate_species(test_merged_species)
        assert result is None

    def test_empty_isolate(self, test_merged_species):
        """
        Test that an isolate with no sequences is detected.

        """
        test_merged_species["isolates"][0]["sequences"] = list()

        result = virtool.species.validate_species(test_merged_species)

        assert result == {
            "empty_isolate": ["cab8b360"],
            "empty_sequence": False,
            "empty_species": False,
            "isolate_inconsistency": False
        }

    def test_empty_sequence(self, test_merged_species):
        """
        Test that a sequence with an empty ``sequence`` field is detected.

        """
        test_merged_species["isolates"][0]["sequences"][0]["sequence"] = ""

        result = virtool.species.validate_species(test_merged_species)

        assert result == {
            "empty_isolate": False,
            "empty_sequence": [{
                "_id": "KX269872",
                "definition": "Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene, complete cds.",
                "host": "sweet cherry",
                "species_id": "6116cba1",
                "isolate_id": "cab8b360",
                "sequence": "",
                "segment": None
            }],
            "empty_species": False,
            "isolate_inconsistency": False
        }

    def test_empty_species(self, test_merged_species):
        """
        Test that an species with no isolates is detected.

        """
        test_merged_species["isolates"] = []

        result = virtool.species.validate_species(test_merged_species)

        assert result == {
            "empty_isolate": False,
            "empty_sequence": False,
            "empty_species": True,
            "isolate_inconsistency": False
        }

    def test_isolate_inconsistency(self, test_merged_species, test_sequence):
        """
        Test that isolates in a single species with disparate sequence counts are detected.

        """
        test_merged_species["isolates"].append(dict(test_merged_species["isolates"][0], id="foobar"))

        test_merged_species["isolates"][1]["sequences"] = [
            dict(test_sequence, _id="foobar_1"),
            dict(test_sequence, _id="foobar_2")
        ]

        result = virtool.species.validate_species(test_merged_species)

        assert result == {
            "empty_isolate": False,
            "empty_sequence": False,
            "empty_species": False,
            "isolate_inconsistency": True
        }


async def test_update_last_indexed_version(test_motor, test_species):
    """
    Test that function works as expected.

    """
    species_1 = test_species
    species_2 = deepcopy(test_species)

    species_2.update({
        "_id": "foobar"
    })

    await test_motor.species.insert_many([species_1, species_2])

    await virtool.db.species.update_last_indexed_version(test_motor, ["foobar"], 5)

    species_1 = await test_motor.species.find_one({"_id": "6116cba1"})
    species_2 = await test_motor.species.find_one({"_id": "foobar"})

    assert species_1["version"] == 0
    assert species_1["last_indexed_version"] == 0

    assert species_2["version"] == 5
    assert species_2["last_indexed_version"] == 5


class TestGetDefaultIsolate:

    def test(self, test_species, test_isolate):
        """
        Test that the function can find the default isolate.

        """
        default_isolate = dict(test_isolate, isolate_id="foobar3", default=True)

        test_species["isolates"] = [
            dict(test_isolate, isolate_id="foobar1", default=False),
            dict(test_isolate, isolate_id="foobar2", default=False),
            default_isolate,
            dict(test_isolate, isolate_id="foobar4", default=False)
        ]

        assert virtool.species.extract_default_isolate(test_species) == default_isolate

    def test_processor(self, test_species, test_isolate):
        """
        Test that the ``processor`` argument works.

        """

        default_isolate = dict(test_isolate, isolate_id="foobar3", default=True)

        expected = dict(default_isolate, processed=True)

        test_species["isolates"] = [
            dict(test_isolate, isolate_id="foobar1", default=False),
            default_isolate
        ]

        def test_processor(isolate):
            return dict(isolate, processed=True)

        assert virtool.species.extract_default_isolate(test_species, test_processor) == expected

    def test_no_default(self, test_species):
        """
        Test that a ``ValueError`` is raised when the species contains not default isolates.

        """
        test_species["isolates"][0]["default"] = False

        with pytest.raises(ValueError) as err:
            virtool.species.extract_default_isolate(test_species)

        assert "No default isolate found" in str(err)

    def test_multiple_defaults(self, test_species, test_isolate):
        """
        Test that a ``ValueError`` is raised when the species contains more than one default isolate.

        """
        extra_isolate = dict(test_isolate, isolate_id="foobar3", default=True)

        test_species["isolates"].append(extra_isolate)

        with pytest.raises(ValueError) as err:
            virtool.species.extract_default_isolate(test_species)

        assert "More than one" in str(err)


class TestGetNewIsolateId:

    async def test(self, test_motor, test_species):
        await test_motor.species.insert(test_species)

        new_id = await virtool.db.species.get_new_isolate_id(test_motor)

        allowed = ascii_lowercase + digits

        assert all(c in allowed for c in new_id)

    async def test_exists(self, test_motor, test_species, test_random_alphanumeric):
        """
        Test that a different ``isolate_id`` is generated if the first generated one already exists in the database.

        """
        next_choice = test_random_alphanumeric.next_choice[:8].lower()

        expected = test_random_alphanumeric.choices[-2][:8].lower()

        test_species["isolates"][0]["id"] = next_choice

        await test_motor.species.insert(test_species)

        new_id = await virtool.db.species.get_new_isolate_id(test_motor)

        assert new_id == expected

    async def test_excluded(self, test_motor, test_random_alphanumeric):
        """
        Test that a different ``isolate_id`` is generated if the first generated one is in the ``excluded`` list.

        """
        excluded = [test_random_alphanumeric.next_choice[:8].lower()]

        expected = test_random_alphanumeric.choices[-2][:8].lower()

        new_id = await virtool.db.species.get_new_isolate_id(test_motor, excluded=excluded)

        assert new_id == expected

    async def test_exists_and_excluded(self, test_motor, test_species, test_random_alphanumeric):
        """
        Test that a different ``isolate_id`` is generated if the first generated one is in the ``excluded`` list.

        """
        excluded = [test_random_alphanumeric.choices[-2][:8].lower()]

        test_species["isolates"][0]["id"] = test_random_alphanumeric.next_choice[:8].lower()

        await test_motor.species.insert(test_species)

        expected = test_random_alphanumeric.choices[-3][:8].lower()

        new_id = await virtool.db.species.get_new_isolate_id(test_motor, excluded=excluded)

        assert new_id == expected


def test_merged_species(test_species, test_sequence, test_merged_species):
    merged = virtool.species.merge_species(test_species, [test_sequence])
    assert merged == test_merged_species


def test_split_species(test_species, test_sequence, test_merged_species):
    species, sequences = virtool.species.split_species(test_merged_species)

    assert species == test_species
    assert sequences == [test_sequence]


class TestExtractIsolateIds:

    def test_merged_species(self, test_merged_species):
        isolate_ids = virtool.species.extract_isolate_ids(test_merged_species)
        assert isolate_ids == ["cab8b360"]

    def test_species_document(self, test_species):
        isolate_ids = virtool.species.extract_isolate_ids(test_species)
        assert isolate_ids == ["cab8b360"]

    def test_multiple(self, test_species):
        test_species["isolates"].append({
            "source_type": "isolate",
            "source_name": "b",
            "id": "foobar",
            "default": False
        })

        isolate_ids = virtool.species.extract_isolate_ids(test_species)

        assert set(isolate_ids) == {"cab8b360", "foobar"}

    def test_missing_isolates(self, test_species):
        del test_species["isolates"]

        with pytest.raises(KeyError):
            virtool.species.extract_isolate_ids(test_species)


class TestFindIsolate:

    def test(self, test_species, test_isolate):
        new_isolate = dict(test_isolate, id="foobar", source_type="isolate", source_name="b")

        test_species["isolates"].append(new_isolate)

        isolate = virtool.species.find_isolate(test_species["isolates"], "foobar")

        assert isolate == new_isolate

    def test_does_not_exist(self, test_species):
        assert virtool.species.find_isolate(test_species["isolates"], "foobar") is None


class TestExtractSequenceIds:

    def test_valid(self, test_merged_species):
        sequence_ids = virtool.species.extract_sequence_ids(test_merged_species)
        assert sequence_ids == ["KX269872"]

    def test_missing_isolates(self, test_merged_species):
        del test_merged_species["isolates"]

        with pytest.raises(KeyError) as err:
            virtool.species.extract_sequence_ids(test_merged_species)

        assert "'isolates'" in str(err)

    def test_empty_isolates(self, test_merged_species):
        test_merged_species["isolates"] = list()

        with pytest.raises(ValueError) as err:
            virtool.species.extract_sequence_ids(test_merged_species)

        assert "Empty isolates list" in str(err)

    def test_missing_sequences(self, test_merged_species):
        del test_merged_species["isolates"][0]["sequences"]

        with pytest.raises(KeyError) as err:
            virtool.species.extract_sequence_ids(test_merged_species)

        assert "missing sequences field" in str(err)

    def test_empty_sequences(self, test_merged_species):
        test_merged_species["isolates"][0]["sequences"] = list()

        with pytest.raises(ValueError) as err:
            virtool.species.extract_sequence_ids(test_merged_species)

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

        formatted = virtool.species.format_isolate_name(test_isolate)

        if source_type and source_name:
            assert formatted == "Isolate 8816 - v2"
        else:
            assert formatted == "Unnamed Isolate"
