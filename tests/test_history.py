import json
import pytest
import datetime
from pprint import pprint
from copy import deepcopy

import virtool.virus_history


class TestProcessor:

    def test(self, test_change):
        processed = virtool.virus_history.processor(deepcopy(test_change))

        expected = dict(test_change)
        expected["change_id"] = expected.pop("_id")

        assert processed == expected


class TestAdd:

    async def test(self, test_motor, static_time, test_virus_edit, test_change):

        old, new = test_virus_edit

        returned_change = await virtool.virus_history.add(test_motor, "edit", old, new, ("Edited virus", new["name"]), "test")

        document = await test_motor.history.find_one()

        # Sort the real and expected diffs so they are directly comparable.
        returned_change["diff"].sort()
        document["diff"].sort()
        test_change["diff"].sort()

        assert document == test_change

        pprint(returned_change)

        assert returned_change == {
            "_id": "6116cba1.1",
            "description": ("Edited virus", "Prunus virus E"),
            "diff": [
                ("change", "abbreviation", ("PVF", "")),
                ("change", "name", ("Prunus virus F", "Prunus virus E")),
                ("change", "version", (0, 1))
            ],
            "index_id": "unbuilt",
            "index_version": "unbuilt",
            "method_name": "edit",
            "timestamp": datetime.datetime(2017, 10, 6, 20, 0, tzinfo=datetime.timezone.utc),
            "user_id": "test",
            "virus_id": "6116cba1",
            "virus_name": "Prunus virus F",
            "virus_version": 1
        }

    async def test_create(self, test_motor, static_time, test_virus_edit, test_change):
        # There is no old document because this is a change document for a virus creation operation.
        old = None

        new, _ = test_virus_edit

        description = ("Created virus", new["name"])

        returned_change = await virtool.virus_history.add(test_motor, "create", old, new, description, "test")

        document = await test_motor.history.find_one()

        pprint(document)

        # Update the base test_change document to verify the real added change document.
        test_change.update({
            "_id": "6116cba1.0",
            "virus_name": "Prunus virus F",
            "virus_version": 0,
            "description": list(description),
            "diff": new,
            "method_name": "create"
        })

        assert document == test_change

        test_change.update({
            "description": tuple(test_change["description"]),
            "timestamp": static_time
        })

        assert returned_change == test_change

    async def test_remove(self, test_motor, static_time, test_virus_edit, test_change):
        """
        Test that the addition of a change due to virus removal inserts the expected change document.
        
        """
        # There is no new document because this is a change document for a virus removal operation.
        new = None

        old, _ = test_virus_edit

        description = ("Created virus", old["name"])

        returned_change = await virtool.virus_history.add(test_motor, "remove", old, new, description, "test")

        document = await test_motor.history.find_one()

        # Update the base test_change document to verify the real added change document.
        test_change.update({
            "_id": "6116cba1.removed",
            "virus_name": "Prunus virus F",
            "virus_version": "removed",
            "description": list(description),
            "diff": old,
            "method_name": "remove"
        })

        assert document == test_change

        test_change.update({
            "description": tuple(test_change["description"]),
            "timestamp": static_time
        })

        assert returned_change == test_change


class TestCalculateDiff:

    def test(self, test_virus_edit):
        """
        Test that a diff is correctly calculated. Should work since the tested function is a very light wrapper for the
        dictdiffer function.
         
        """
        old, new = test_virus_edit

        diff = virtool.virus_history.calculate_diff(old, new)

        assert diff.sort() == [
            ("change", "name", ("Prunus virus F", "Prunus virus E")),
            ("change", "abbreviation", ("PVF", "")), ("change", "version", (0, 1))
        ].sort()


class TestGetMostRecentChange:

    async def test(self, test_motor, static_time, test_virus, test_sequence):
        """
        Test that the most recent change document is returned for the given ``virus_id``. 
        """
        old = deepcopy(test_virus)
        new = deepcopy(test_virus)

        # Fake a change in a virus document.
        new.update({
            "abbreviation": "TST",
            "version": 1
        })

        await test_motor.viruses.insert_one(test_virus)
        await test_motor.sequences.insert_one(test_sequence)

        # Add change documents for creation and abbreviation update operations on the virus.
        await virtool.virus_history.add(test_motor, "create", None, old, "Description", "test")
        await virtool.virus_history.add(test_motor, "update", old, new, "Description", "test")

        most_recent = await virtool.virus_history.get_most_recent_change(test_motor, test_virus["_id"])
        
        assert most_recent == {
            "_id": "6116cba1.1",
            "description": "Description",
            "method_name": "update",
            "timestamp": datetime.datetime(2017, 10, 6, 20, 0),
            "user_id": "test",
            "virus_version": 1
        }

    async def test_none(self, test_motor, static_time):
        """
        Test that ``None`` is returned if no change documents exist for the given ``virus_id``.
         
        """
        most_recent = await virtool.virus_history.get_most_recent_change(test_motor, "6116cba1.1")
        assert most_recent is None


class TestPatchVirusToVersion:

    @pytest.mark.parametrize("remove", [True, False])
    async def test(self, remove, test_motor, test_merged_virus):
        # Apply a series of changes to a test virus document to build up a history.
        await virtool.virus_history.add(test_motor, "create", None, test_merged_virus, "Description", "test")

        old = deepcopy(test_merged_virus)

        test_merged_virus.update({
            "abbreviation": "TST",
            "version": 1
        })

        await virtool.virus_history.add(test_motor, "update", old, test_merged_virus, "Description", "test")

        old = deepcopy(test_merged_virus)

        # We will try to patch to this version of the joined virus.
        expected = deepcopy(old)

        test_merged_virus.update({
            "name": "Test Virus",
            "version": 2
        })

        await virtool.virus_history.add(test_motor, "update", old, test_merged_virus, "Description", "test")

        old = deepcopy(test_merged_virus)

        test_merged_virus.update({
            "isolates": [],
            "version": 3
        })

        await virtool.virus_history.add(test_motor, "remove_isolate", old, test_merged_virus, "Description", "test")

        if remove:
            old = deepcopy(test_merged_virus)

            test_merged_virus = {
                "_id": "6116cba1"
            }

            await virtool.virus_history.add(test_motor, "remove", old, test_merged_virus, "Description", "test")

        return_value = await virtool.virus_history.patch_virus_to_version(test_motor, test_merged_virus, 1)

        current, patched, reverted_change_ids = return_value

        assert current == test_merged_virus

        assert patched == expected

        expected_reverted_change_ids = ["6116cba1.3", "6116cba1.2"]

        if remove:
            expected_reverted_change_ids = ["6116cba1.removed"] + expected_reverted_change_ids

        assert reverted_change_ids == expected_reverted_change_ids


class TestSetIndexAsUnbuilt:

    async def test(self, test_motor, test_change):
        """
        Test that change docs with the given ``index_id`` have their ``index_id`` and ``index_version`` fields changed
        to "unbuilt".
         
        """
        one = test_change
        two = dict(test_change, _id="foobar.1")

        one.update({
            "index_id": "foo",
            "index_version": 3
        })

        two.update({
            "index_id": "bar",
            "index_version": 4
        })

        await test_motor.history.insert_many([one, two])

        await virtool.virus_history.set_index_as_unbuilt(test_motor, "bar")

        assert await test_motor.history.find_one("6116cba1.1") == one

        assert await test_motor.history.find_one("foobar.1") == dict(two, index_id="unbuilt", index_version="unbuilt")



