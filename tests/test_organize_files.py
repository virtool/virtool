import pytest

from virtool.organize import organize_files


@pytest.fixture
def file_documents():
    return [
        {"_id": 1},
        {"_id": 2},
        {"_id": 3, "reserved": False},
        {"_id": 4, "reserved": False}
    ]


class TestOrganizeFiles:

    def test_add_reserved(self, test_db, file_documents):
        test_db.files.insert_many(file_documents)

        organize_files(test_db)

        assert all([document["reserved"] is False for document in test_db.files.find()])

    def test_retain_existing(self, test_db, file_documents):
        file_documents[0]["reserved"] = True
        file_documents[1]["reserved"] = True

        test_db.files.insert_many(file_documents)

        organize_files(test_db)

        assert [document["reserved"] for document in test_db.files.find()] == [True, True, False, False]
