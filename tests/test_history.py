import pytest
import datetime

import virtool.utils
import virtool.virus_history


class TestAdd:

    async def test(self, test_motor, static_time, test_virus_edit, test_change):

        old, new = test_virus_edit

        returned_change = await virtool.virus_history.add(
            test_motor,
            "edit",
            old,
            new,
            "Edited virus {}".format(new["name"]),
            "test"
        )

        document = await test_motor.history.find_one()

        # Sort the real and expected diffs so they are directly comparable.
        returned_change["diff"].sort()
        document["diff"].sort()
        test_change["diff"].sort()

        assert document == test_change

        assert returned_change == {
            "_id": "6116cba1.1",
            "description": "Edited virus Prunus virus E",
            "diff": [
                ("change", "abbreviation", ("PVF", "")),
                ("change", "name", ("Prunus virus F", "Prunus virus E")),
                ("change", "version", (0, 1))
            ],
            "index": {
                "id": "unbuilt",
                "version": "unbuilt"
            },
            "method_name": "edit",
            "created_at": static_time,
            "user": {
                "id": "test"
            },
            "virus": {
                "id": "6116cba1",
                "name": "Prunus virus F",
                "version": 1
            }
        }

    async def test_create(self, test_motor, static_time, test_virus_edit, test_change):
        # There is no old document because this is a change document for a virus creation operation.
        old = None

        new, _ = test_virus_edit

        description = "Created virus {}".format(new["name"])

        returned_change = await virtool.virus_history.add(test_motor, "create", old, new, description, "test")

        document = await test_motor.history.find_one()

        # Update the base test_change document to verify the real added change document.
        test_change.update({
            "_id": "6116cba1.0",
            "virus": {
                "id": "6116cba1",
                "name": "Prunus virus F",
                "version": 0
            },
            "description": description,
            "diff": new,
            "method_name": "create"
        })

        assert document == test_change

        test_change.update({
            "description": test_change["description"],
            "created_at": static_time
        })

        assert returned_change == test_change

    async def test_remove(self, test_motor, static_time, test_virus_edit, test_change):
        """
        Test that the addition of a change due to virus removal inserts the expected change document.

        """
        # There is no new document because this is a change document for a virus removal operation.
        new = None

        old, _ = test_virus_edit

        description = "Removed virus {}".format(old["name"])

        returned_change = await virtool.virus_history.add(test_motor, "remove", old, new, description, "test")

        document = await test_motor.history.find_one()

        # Update the base test_change document to verify the real added change document.
        test_change.update({
            "_id": "6116cba1.removed",
            "virus": {
                "id": "6116cba1",
                "name": "Prunus virus F",
                "version": "removed"
            },
            "description": description,
            "diff": old,
            "method_name": "remove"
        })

        assert document == test_change

        test_change.update({
            "description": test_change["description"],
            "created_at": static_time
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

    async def test(self, test_motor, static_time):
        """
        Test that the most recent change document is returned for the given ``virus_id``.

        """
        # First change is 3 days before the second
        delta = datetime.timedelta(3)

        await test_motor.history.insert_many([
            {
                "_id": "6116cba1.1",
                "description": "Description",
                "method_name": "update",
                "created_at": static_time - delta,
                "user": {
                    "id": "test"
                },
                "virus": {
                    "id": "6116cba1",
                    "name": "Prunus virus F",
                    "version": 1
                },
                "index": {
                    "id": "unbuilt"
                }
            },
            {
                "_id": "6116cba1.2",
                "description": "Description number 2",
                "method_name": "update",
                "created_at": static_time,
                "user": {
                    "id": "test"
                },
                "virus": {
                    "id": "6116cba1",
                    "name": "Prunus virus F",
                    "version": 1
                },
                "index": {
                    "id": "unbuilt"
                }
            }
        ])

        most_recent = await virtool.virus_history.get_most_recent_change(test_motor, "6116cba1")

        assert most_recent == {
            "_id": "6116cba1.2",
            "description": "Description number 2",
            "method_name": "update",
            "created_at": static_time,
            "user": {
                "id": "test"
            },
            "virus": {
                "id": "6116cba1",
                "name": "Prunus virus F",
                "version": 1
            }
        }

    async def test_none(self, test_motor, static_time):
        """
        Test that ``None`` is returned if no change documents exist for the given ``virus_id``.

        """
        most_recent = await virtool.virus_history.get_most_recent_change(test_motor, "6116cba1.1")
        assert most_recent is None


class TestPatchVirusToVersion:

    @pytest.mark.parametrize("remove", [True, False])
    async def test(self, remove, test_motor, test_merged_virus, create_mock_history):
        expected_current = await create_mock_history(remove)

        current, patched, reverted_change_ids = await virtool.virus_history.patch_virus_to_version(
            test_motor,
            "6116cba1",
            1
        )

        assert current == expected_current

        assert patched == dict(test_merged_virus, abbreviation="TST", version=1)

        expected_reverted_change_ids = ["6116cba1.3", "6116cba1.2"]

        if remove:
            expected_reverted_change_ids = ["6116cba1.removed"] + expected_reverted_change_ids

        assert reverted_change_ids == expected_reverted_change_ids
