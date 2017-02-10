import pytest

from virtool.organize import organize_hosts


@pytest.fixture
def host_documents():
    return [
        {"_id": 1, "ready": True, "job": "345asd"},
        {"_id": 2, "ready": False, "job": "3i4l1s"},
        {"_id": 3, "ready": True, "job": "8jj3lq"}
    ]


class TestJobId:

    def test_has_job(self, mock_pymongo, host_documents):
        mock_pymongo.hosts.insert_many(host_documents)

        organize_hosts(mock_pymongo)

        assert {host["job"] for host in mock_pymongo.hosts.find()} == {"345asd", "3i4l1s", "8jj3lq"}

    def test_missing_job(self, mock_pymongo, host_documents):
        del host_documents[0]["job"]
        del host_documents[2]["job"]

        mock_pymongo.hosts.insert_many(host_documents)

        organize_hosts(mock_pymongo)

        assert {host["job"] for host in mock_pymongo.hosts.find()} == {None, "3i4l1s", None}


class TestAddedReady:

    def test_only_ready(self, mock_pymongo, host_documents):
        mock_pymongo.hosts.insert_many(host_documents)

        organize_hosts(mock_pymongo)

        docs = list(mock_pymongo.hosts.find())

        assert all(["added" not in d for d in docs])

        assert {d["ready"] for d in docs} == {True, False, True}

    def test_has_ready(self, mock_pymongo, host_documents):
        del host_documents[0]["ready"]
        host_documents[0]["added"] = True

        mock_pymongo.hosts.insert_many(host_documents)

        organize_hosts(mock_pymongo)

        docs = list(mock_pymongo.hosts.find())

        assert all(["added" not in d for d in docs])

        assert {d["ready"] for d in docs} == {True, False, True}

    def test_neither(self, mock_pymongo, host_documents):
        del host_documents[1]["ready"]

        mock_pymongo.hosts.insert_many(host_documents)

        organize_hosts(mock_pymongo)

        docs = list(mock_pymongo.hosts.find())

        assert all(["added" not in d for d in docs])

        assert all(d["ready"] for d in docs)



