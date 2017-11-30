import pytest
from operator import itemgetter

import virtool.organize


@pytest.fixture
def subtraction_documents():
    return [
        {"_id": 1, "ready": True, "job": {"id": "345asd"}},
        {"_id": 2, "ready": True, "job": {"id": "3i4l1s"}},
        {"_id": 3, "ready": True, "job": {"id": "8jj3lq"}}
    ]


class TestJobId:

    async def test(self, tmpdir, test_motor, subtraction_documents):
        """
        Test that flat ``job`` fields are updated to the new subdocument format.

        """
        tmpdir.mkdir("samples")

        subtraction_documents[1]["job"] = subtraction_documents[1]["job"]["id"]

        await test_motor.hosts.insert_many(subtraction_documents)

        await virtool.organize.organize_subtraction(test_motor, {"data_path": str(tmpdir)})

        subtractions = await test_motor.subtraction.find().to_list(None)

        assert sorted([s["job"] for s in subtractions], key=itemgetter("id")) == [
            {"id": "345asd"},
            {"id": "3i4l1s"},
            {"id": "8jj3lq"}
        ]

    async def test_missing_job(self, tmpdir, test_motor, subtraction_documents):
        """
        Test that the ``job`` field is set to a default value of ``None`` if it doesn't exist.

        """
        tmpdir.mkdir("samples")

        del subtraction_documents[0]["job"]
        del subtraction_documents[2]["job"]

        await test_motor.hosts.insert_many(subtraction_documents)

        await virtool.organize.organize_subtraction(test_motor, {"data_path": str(tmpdir)})

        subtractions = await test_motor.subtraction.find().to_list(None)

        assert sorted([s["job"] for s in subtractions], key=bool) == sorted([None, {"id": "3i4l1s"}, None], key=bool)

    async def test_no_change(self, tmpdir, test_motor, subtraction_documents):
        """
        Test that no changes are made if the document already contains a valid ``job`` field.

        """
        tmpdir.mkdir("samples")

        await test_motor.subtraction.insert_many(subtraction_documents)

        await virtool.organize.organize_subtraction(test_motor, {"data_path": str(tmpdir)})

        subtractions = await test_motor.subtraction.find().to_list(None)

        assert sorted([s["job"] for s in subtractions], key=itemgetter("id")) == sorted([
            {"id": "345asd"},
            {"id": "3i4l1s"},
            {"id": "8jj3lq"}
        ], key=itemgetter("id"))


class TestAddedReady:

    async def test_only_ready(self, tmpdir, test_motor, subtraction_documents):
        """
        Test that conversion of the ``added`` field to ``ready`` does not corrupt documents that already have the
        ``ready`` field set.

        """
        tmpdir.mkdir("samples")

        await test_motor.subtraction.insert_many(subtraction_documents)

        await virtool.organize.organize_subtraction(test_motor, {"data_path": str(tmpdir)})

        docs = await test_motor.subtraction.find({}, ["ready", "added"]).to_list(None)

        assert all(["added" not in d for d in docs])

        assert {d["ready"] for d in docs} == {True, True, True}

    async def test_has_ready(self, tmpdir, test_motor, subtraction_documents):
        """
        Test that conversion of the ``added`` field to ``ready`` is successful when some documents are using the
        ``added`` field.

        """
        tmpdir.mkdir("samples")

        del subtraction_documents[0]["ready"]
        subtraction_documents[0]["added"] = True

        test_motor.subtraction.insert_many(subtraction_documents)

        await virtool.organize.organize_subtraction(test_motor, {"data_path": str(tmpdir)})

        docs = await test_motor.subtraction.find({}, ["ready", "added"]).to_list(None)

        assert all(["added" not in d for d in docs])

        assert {d["ready"] for d in docs} == {True, True, True}

    async def test_neither(self, tmpdir, test_motor, subtraction_documents):
        """
        Test that documents with no ``ready`` or ``added`` field will have their ``ready`` fields set to ``True`` by
        default.

        """
        tmpdir.mkdir("samples")

        del subtraction_documents[1]["ready"]

        await test_motor.subtraction.insert_many(subtraction_documents)

        await virtool.organize.organize_subtraction(test_motor, {"data_path": str(tmpdir)})

        docs = await test_motor.subtraction.find({}, ["ready", "added"]).to_list(None)

        assert all(["added" not in d for d in docs])

        assert all(d["ready"] for d in docs)
