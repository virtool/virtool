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

    def test_add_reserved(self, mock_pymongo, file_documents):
        mock_pymongo.files.insert_many(file_documents)

        organize_files(mock_pymongo)

        assert all([document["reserved"] is False for document in mock_pymongo.files.find()])

    def test_retain_existing(self, mock_pymongo, file_documents):
        file_documents[0]["reserved"] = True
        file_documents[1]["reserved"] = True

        mock_pymongo.files.insert_many(file_documents)

        organize_files(mock_pymongo)

        assert [document["reserved"] for document in mock_pymongo.files.find()] == [True, True, False, False]
