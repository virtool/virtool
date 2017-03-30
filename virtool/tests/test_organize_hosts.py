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

    def test_has_job(self, test_db, host_documents):
        test_db.hosts.insert_many(host_documents)

        organize_hosts(test_db)

        assert {host["job"] for host in test_db.hosts.find()} == {"345asd", "3i4l1s", "8jj3lq"}

    def test_missing_job(self, test_db, host_documents):
        del host_documents[0]["job"]
        del host_documents[2]["job"]

        test_db.hosts.insert_many(host_documents)

        organize_hosts(test_db)

        assert {host["job"] for host in test_db.hosts.find()} == {None, "3i4l1s", None}


class TestAddedReady:

    def test_only_ready(self, test_db, host_documents):
        test_db.hosts.insert_many(host_documents)

        organize_hosts(test_db)

        docs = list(test_db.hosts.find())

        assert all(["added" not in d for d in docs])

        assert {d["ready"] for d in docs} == {True, False, True}

    def test_has_ready(self, test_db, host_documents):
        del host_documents[0]["ready"]
        host_documents[0]["added"] = True

        test_db.hosts.insert_many(host_documents)

        organize_hosts(test_db)

        docs = list(test_db.hosts.find())

        assert all(["added" not in d for d in docs])

        assert {d["ready"] for d in docs} == {True, False, True}

    def test_neither(self, test_db, host_documents):
        del host_documents[1]["ready"]

        test_db.hosts.insert_many(host_documents)

        organize_hosts(test_db)

        docs = list(test_db.hosts.find())

        assert all(["added" not in d for d in docs])

        assert all(d["ready"] for d in docs)
