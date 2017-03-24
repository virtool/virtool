import os
import gzip
import json
import shutil
import pytest
import operator
import subprocess

from virtool.gen import coroutine
from virtool.hmm import hmmstat, hmmpress, vfam_text_to_json


def test_init(hmm_collection):
    assert set(hmm_collection.sync_projector) == {
        "_id",
        "_version",
        "cluster",
        "label",
        "count",
        "families"
    }


class TestDetail:

    @pytest.mark.gen_test
    def test_exists(self, mock_transaction, hmm_collection, hmm_document):
        """
        Test that detail is dispatched for hmm document ids that DO exist.

        """
        yield hmm_collection.db.insert(hmm_document)

        transaction = mock_transaction({
            "interface": "hmm",
            "method": "detail",
            "data": {
                "_id": "f8666902"
            }
        })

        yield hmm_collection.detail(transaction)

        assert transaction.fulfill_called == (True, hmm_document)

    @pytest.mark.gen_test
    def test_missing(self, mock_transaction, hmm_collection):
        """
        Test that detail request for non-existent document ids fail.

        """
        transaction = mock_transaction({
            "interface": "hmm",
            "method": "detail",
            "data": {
                "_id": "foobar"
            }
        })

        yield hmm_collection.detail(transaction)

        assert transaction.fulfill_called == (False, dict(message="Document not found", warning=True))


class TestImportAnnotations:

    @pytest.mark.gen_test
    def test_non_zero(self, mock_transaction, hmm_collection, hmm_document):
        """
        Test that importing HMMs fails when the database is not empty.

        """
        yield hmm_collection.db.insert(hmm_document)

        transaction = mock_transaction({
            "interface": "hmm",
            "method": "import_annotations",
            "data": {
                "file_id": "foobar-file"
            }
        }, permissions=["modify_hmm"])

        yield hmm_collection.import_annotations(transaction)

        assert transaction.fulfill_called == (False, dict(message="Annotations collection is not empty", warning=True))

    @pytest.mark.gen_test
    def test_valid(self, tmpdir, mock_transaction, hmm_collection):
        """
        Ensure that imported HMMs are properly inserted into the database collection.

        """
        files_path = os.path.join(str(tmpdir), "files")
        os.mkdir(files_path)

        test_file_path = os.path.join(os.path.dirname(os.path.realpath(__file__)), "test_files", "annotations.json.gz")

        shutil.copy(
            test_file_path,
            files_path
        )

        hmm_collection.settings.data["data_path"] = str(tmpdir)

        transaction = mock_transaction({
            "interface": "hmm",
            "method": "import_annotations",
            "data": {
                "file_id": "annotations.json.gz"
            }
        }, permissions=["modify_hmm"])

        yield hmm_collection.import_annotations(transaction)

        filter_keys = [
            "label",
            "length",
            "mean_entropy",
            "total_entropy",
            "genera",
            "families",
            "definition",
            "count",
            "cluster"
        ]

        cluster_two = yield hmm_collection.find_one({"cluster": 2})

        assert {key: cluster_two[key] for key in cluster_two if key in filter_keys} == {
            "cluster": 2,
            "count": 253,
            "definition": [
                "replication-associated protein",
                "replication associated protein",
                "Rep"
            ],
            "families": {
                "Geminiviridae": 235,
                "None": 2
            },
            "genera": {
                "Begomovirus": 208,
                "Curtovirus": 6,
                "Mastrevirus": 19,
                "None": 3,
                "Topocuvirus": 1
            },
            "label": "replication-associated protein",
            "length": 356,
            "mean_entropy": 0.52,
            "total_entropy": 185.12
        }

        assert cluster_two["_id"]
        assert cluster_two["_version"] == 0

        inserted = yield hmm_collection.db.find().to_list(None)

        assert len(inserted) == 7

        assert all(key in doc for key in filter_keys for doc in inserted)


class TestCheck:

    @pytest.mark.gen_test
    def test_good(self, hmm_check_transaction, hmm_documents, hmm_check_result, hmm_path, hmm_collection):
        """
        Ensure a good result is returned for a healthy HMM file and collection.

        """
        yield hmm_collection.db.insert_many(hmm_documents)

        hmm_collection.settings.data["data_path"] = hmm_path[0]

        yield hmm_collection.check(hmm_check_transaction)

        assert hmm_check_transaction.fulfill_called == (True, hmm_check_result)

        assert hmm_collection.collections["status"].stubs["update"].called

    @pytest.mark.gen_test
    def test_no_file(self, hmm_check_transaction, hmm_documents, hmm_check_result, hmm_path, hmm_collection):
        """
        Check that a missing profiles.hmm file is reported in the results.

        """
        yield hmm_collection.db.insert_many(hmm_documents)

        hmm_collection.settings.data["data_path"] = hmm_path[0]

        os.remove(os.path.join(hmm_path[0], "hmm", "profiles.hmm"))

        yield hmm_collection.check(hmm_check_transaction)

        hmm_check_result["hmm_file"] = True

        assert hmm_check_transaction.fulfill_called == (True, hmm_check_result)

    @pytest.mark.gen_test
    def test_not_in_db(self, hmm_check_transaction, hmm_documents, hmm_check_result, hmm_path, hmm_collection):
        """
        Make sure a list of cluster numbers present in the file, but not the database is reported.

        """
        yield hmm_collection.db.insert_many(hmm_documents[0:6])

        hmm_collection.settings.data["data_path"] = hmm_path[0]

        yield hmm_collection.check(hmm_check_transaction)

        hmm_check_result["not_in_database"] = [10]

        assert hmm_check_transaction.fulfill_called == (True, hmm_check_result)

    @pytest.mark.gen_test
    def test_not_in_file(self, hmm_check_transaction, hmm_documents, hmm_check_result, hmm_path, hmm_collection):
        """
        Make sure a list of cluster numbers missing from the file, but no the database is reported.

        """
        yield hmm_collection.db.insert_many(hmm_documents)

        hmm_collection.settings.data["data_path"] = hmm_path[0]

        with open(hmm_path[1], "r") as handle:
            replacement_lines = [next(handle) for x in range(5631)]

        with open(hmm_path[1], "w") as handle:
            for line in replacement_lines:
                handle.write(line)

        yield hmmpress(hmm_path[1])

        yield hmm_collection.check(hmm_check_transaction)

        hmm_check_result["not_in_file"] = [10]

        assert hmm_check_transaction.fulfill_called == (True, hmm_check_result)


class TestClean:

    @pytest.mark.gen_test
    def test_fixes(self, mock_transaction, hmm_collection, hmm_check_result, hmm_documents):
        """
        Make sure that HMM documents not in the file are removed.

        """
        @coroutine
        def dummy(*args):
            hmm_check_result["not_in_file"] = [2]
            return hmm_check_result

        setattr(hmm_collection, "_check", dummy)

        yield hmm_collection.db.insert_many(hmm_documents)

        count = yield hmm_collection.db.count({"cluster": 2})

        assert count == 1

        transaction = mock_transaction({
            "interface": "hmm",
            "method": "clean"
        }, permissions=["modify_hmm"])

        yield hmm_collection.clean(transaction)

        count = yield hmm_collection.db.count({"cluster": 2})

        assert count == 0

        assert transaction.fulfill_called[0] is True

    @pytest.mark.gen_test
    def test_no_problems(self, mock_transaction, hmm_collection, hmm_check_result):
        """
        Make sure the method fails when there are no HMM documents that are not in the file.

        """
        @coroutine
        def dummy(*args):
            return hmm_check_result

        setattr(hmm_collection, "_check", dummy)

        transaction = mock_transaction({
            "interface": "hmm",
            "method": "clean"
        }, permissions=["modify_hmm"])

        yield hmm_collection.clean(transaction)

        assert transaction.fulfill_called == (False, dict(message="No problems found", warning=True))


class TestSetField:

    @pytest.mark.gen_test
    def test_valid(self, mock_transaction, hmm_collection, hmm_documents):
        """
        Ensure that the method properly modifies the label field of an HMM document.

        """
        hmm_documents[0]["label"] = "before"

        yield hmm_collection.db.insert_many(hmm_documents)

        doc = yield hmm_collection.db.find_one({"cluster": 2})

        assert doc["label"] == "before"

        transaction = mock_transaction({
            "interface": "hmm",
            "method": "set_field",
            "data": {
                "_id": doc["_id"],
                "field": "label",
                "value": "after"
            }
        }, permissions=["modify_hmm"])

        yield hmm_collection.set_field(transaction)

        doc = yield hmm_collection.db.find_one({"cluster": 2})

        assert doc["label"] == "after"

    @pytest.mark.gen_test
    def test_not_allowed(self, mock_transaction, hmm_collection, hmm_documents):
        """
        Ensure that an error is dispatched when the provided ``field`` may not be set.

        """
        hmm_documents[0]["definition"] = "before"

        yield hmm_collection.db.insert_many(hmm_documents)

        doc = yield hmm_collection.db.find_one({"cluster": 2})

        assert doc["definition"] == "before"

        transaction = mock_transaction({
            "interface": "hmm",
            "method": "set_field",
            "data": {
                "_id": doc["_id"],
                "field": "definition",
                "value": "after"
            }
        }, permissions=["modify_hmm"])

        yield hmm_collection.set_field(transaction)

        doc = yield hmm_collection.db.find_one({"cluster": 2})

        assert doc["definition"] == "before"

        assert transaction.fulfill_called == (False, dict(message="Not allowed to set this field.", warning=True))


class TestHMMStat:

    @pytest.mark.gen_test
    def test_valid(self, hmm_path, hmm_stat_result):
        """
        Test that the correct values are return when hmmstat is run on the test file

        """
        output = yield hmmstat(hmm_path[1])
        assert output == hmm_stat_result

    @pytest.mark.gen_test
    def test_bad_file(self, bad_hmm_path):
        """
        Make sure hmmstat call fails for a damaged hmm file.

        """
        with pytest.raises(subprocess.CalledProcessError) as err:
            yield hmmstat(bad_hmm_path)

        assert "returned non-zero" in str(err)

    @pytest.mark.gen_test
    def test_missing_file(self):
        """
        Make sure hmmstat fails when the provided path does not exist

        """
        with pytest.raises(FileNotFoundError) as err:
            yield hmmstat("/home/watson/crick.hmm")

        assert "HMM file does not exist" in str(err)


class TestVFamToJSON:

    def test_valid(self, annotation_path, expected_annotations):
        """
        Test that the collection of vFam text files is correctly translated to JSON.

        """
        result = vfam_text_to_json(annotation_path)

        to_check = [{key: r[key] for key in r if key not in ["entries", "genera", "families"]} for r in result]

        to_check = sorted(to_check, key=operator.itemgetter("cluster"))
        expected_annotations = sorted(to_check, key=operator.itemgetter("cluster"))

        assert all(x == y for x, y in zip(to_check, expected_annotations))

        assert not os.path.isfile("./annotations.json.gz")

    def test_write_file(self, annotation_path, expected_annotations, tmpdir):
        """
        Test that the JSON data is written to the output path when it is provided.

        """
        path = os.path.join(str(tmpdir), "annotations.json.gz")

        vfam_text_to_json(annotation_path, path)

        assert os.path.isfile(path)

        with gzip.open(path, "rt") as json_file:
            output = json.load(json_file)

        to_check = [{key: r[key] for key in r if key not in ["entries", "genera", "families"]} for r in output]

        to_check = sorted(to_check, key=operator.itemgetter("cluster"))
        expected_annotations = sorted(to_check, key=operator.itemgetter("cluster"))

        assert all(x == y for x, y in zip(to_check, expected_annotations))
