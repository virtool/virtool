import pytest
import virtool.gen


@pytest.fixture
def iresine():
    return {
        "last_indexed_version": 0,
        "abbreviation": "IrVd",
        "modified": False,
        "_id": "008lgo",
        "_version": 0,
        "name": "Iresine viroid",
        "isolates": [
            {
                "source_name": "",
                "isolate_id": "6kplarn7",
                "source_type": "unknown",
                "default": True
            }
        ]
    }


@pytest.fixture
def iresine_sequence():
    return {
        "annotated": True,
        "sequence": "CGTGGTT",
        "_id": "NC_003613",
        "host": "Iresine herbstii",
        "definition": "Iresine viroid complete sequence",
        "length": 370,
        "isolate_id": "6kplarn7"
    }


class TestFindImportConflicts:

    @pytest.mark.gen_test
    def test_empty_collection(self, viruses_collection, virus_list):
        """
        Test that no conflicts are found when the sequence collection is empty.

        """
        result = yield viruses_collection.find_import_conflicts(virus_list, False)

        assert result is None

    @pytest.mark.gen_test
    def test_no_conflicts(self, viruses_collection, virus_list, iresine, iresine_sequence):
        """
        Test that no conflicts are found when the sequence collection is populated, but there really are no conflicts.

        """
        yield viruses_collection.db.insert(iresine)
        yield viruses_collection.sequences_collection.insert(iresine_sequence)

        result = yield viruses_collection.find_import_conflicts(virus_list, False)

        assert result is None

    @pytest.mark.gen_test
    def test_existing_sequence_id_no_replace(self, viruses_collection, virus_list, iresine, iresine_sequence):
        """
        Test that a conflict is found when ``replace`` is ``False`` and an imported sequence id already exists in the
        database.

        """
        yield viruses_collection.db.insert(iresine)
        yield viruses_collection.sequences_collection.insert(iresine_sequence)

        # Replace CMV's first sequence id with the one from ``iresine_sequence``. This creates a situation in which we
        # are attempting to import a sequence id (NC_003613) that already exists in another virus (IrVd).
        virus_list[0]["isolates"][0]["sequences"][0]["_id"] = "NC_003613"

        result = yield viruses_collection.find_import_conflicts(virus_list, False)

        assert result == [('008lgo', 'Iresine viroid', 'NC_003613')]

    @pytest.mark.gen_test
    def test_existing_sequence_id_replace(self, viruses_collection, virus_list, iresine, iresine_sequence):
        """
        Test that a conflict is found when ``replace`` is ``True`` and and imported sequence id already exists in a
        different virus than the one being replaced.

        """
        yield viruses_collection.db.insert(iresine)
        yield viruses_collection.sequences_collection.insert(iresine_sequence)

        # Replace CMV's first sequence id with the one from ``iresine_sequence``. This creates a situation in which we
        # are attempting to import a sequence id (NC_003613) that already exists in another virus (IrVd).
        virus_list[0]["isolates"][0]["sequences"][0]["_id"] = "NC_003613"

        result = yield viruses_collection.find_import_conflicts(virus_list, True)

        assert result == [('008lgo', 'Iresine viroid', 'NC_003613')]

    @pytest.mark.gen_test
    def test_existing_sequence_id_same_virus_replace(self, viruses_collection, virus_list, iresine, iresine_sequence):
        """
        Test that no conflict is found when ``replace`` is ``True`` and and imported sequence id already exists in the
        same virus as the one being imported.

        """
        iresine["username"] = "test"

        yield viruses_collection.insert(iresine)
        yield viruses_collection.sequences_collection.insert(iresine_sequence)

        iresine["isolates"][0]["sequences"] = [iresine_sequence]

        virus_list.append(iresine)

        result = yield viruses_collection.find_import_conflicts(virus_list, True)

        assert result is None


class TestImportFile:

    @pytest.mark.gen_test
    def test_empty_collection(self, monkeypatch, mock_pymongo, import_transaction, viruses_collection, import_report,
                              import_json):
        """
        Ensure that the json_data fixture for monkey patching the read_import_file function work properly.

        """
        @virtool.gen.synchronous
        def return_json(*args):
            return import_json

        monkeypatch.setattr("virtool.virusutils.read_import_file", return_json)

        transaction = import_transaction()

        yield viruses_collection.import_file(transaction)

        # Check that history.Collection.add was called three times.
        assert viruses_collection.collections["history"].stubs["add_for_import"].call_count == 5

        # Check the the correct numbers of documents were inserted.
        assert mock_pymongo.viruses.count() == 5
        assert mock_pymongo.sequences.count() == 11

        # Check that the final call to transaction.update matches what we expect.
        import_report["added"] = 5
        assert transaction.update_called == (True, import_report)

    @pytest.mark.gen_test
    @pytest.mark.parametrize("duplicates, errors", [(True, True), (True, None), (None, True), (None, None)])
    def test_verification(self, monkeypatch, mock_pymongo, import_transaction, viruses_collection, import_json,
                          duplicates, errors):
        """
        Make sure verification errors terminate the import process and are dispatched properly. Also ensure that an
        absence of verification errors does not falsely terminate the import process.

        """
        @virtool.gen.synchronous
        def return_json(*args):
            return import_json

        @virtool.gen.coroutine
        def verify_virus_list(*args):
            return duplicates, errors

        monkeypatch.setattr("virtool.virusutils.read_import_file", return_json)
        monkeypatch.setattr("virtool.virusutils.verify_virus_list", verify_virus_list)

        transaction = import_transaction()

        yield viruses_collection.import_file(transaction)

        success, data = transaction.fulfill_called

        # Check that no documents were inserted.
        count = mock_pymongo.viruses.count()

        if duplicates is None and errors is None:
            assert count == 5
            assert success
        else:
            assert count == 0
            assert not success
            assert data["message"] == "Invalid import file"
            assert data["duplicates"] is duplicates
            assert data["errors"] is errors

    @pytest.mark.gen_test
    @pytest.mark.parametrize("conflicts", [["sequence"], None])
    def test_conflicts(self, monkeypatch, mock_pymongo, import_transaction, viruses_collection, import_json, conflicts):
        """
        Make sure sequence id conflicts terminate the import process and are dispatched properly. Also ensure that an
        the import process is not spuriously terminated in the absence of conflicts.

        """
        @virtool.gen.synchronous
        def return_json(*args):
            return import_json

        @virtool.gen.coroutine
        def find_import_conflicts(*args):
            return conflicts

        monkeypatch.setattr("virtool.virusutils.read_import_file", return_json)
        monkeypatch.setattr("virtool.viruses.Collection.find_import_conflicts", find_import_conflicts)

        transaction = import_transaction()

        yield viruses_collection.import_file(transaction)

        success, data = transaction.fulfill_called

        # Check that no documents were inserted.
        count = mock_pymongo.viruses.count()

        if conflicts is None:
            assert count == 5
            assert success
        else:
            assert count == 0
            assert not success
            assert data["message"] == "Conflicting sequence ids"
            assert data["conflicts"] == ["sequence"]

    @pytest.mark.gen_test
    def test_existing_abbreviation(self, monkeypatch, virus_document, import_transaction, viruses_collection,
                                   mock_pymongo, import_json):
        """
        Make sure that the abbreviation for an existing virus document is retained when it is also used in an imported
        virus. Also check that the abbreviation is stripped from the imported virus, thus ensuring abbreviations remain
        unique.

        """
        @virtool.gen.synchronous
        def return_json(*args):
            imported = import_json[0:3]
            imported[0]["abbreviation"] = "CMV"
            return imported

        monkeypatch.setattr("virtool.virusutils.read_import_file", return_json)

        virus_document["username"] = "test"

        yield viruses_collection.insert(virus_document)

        transaction = import_transaction()

        yield viruses_collection.import_file(transaction)

        warning = "Abbreviation CMV already existed for virus Cucumber mosaic virus and was not assigned to new virus" \
                  " Iresine viroid."

        assert transaction.fulfill_called[1]["warnings"][0] == warning

        # Make sure the abbreviation is retained on the pre-existing document.
        assert mock_pymongo.viruses.count({"name": "Cucumber mosaic virus", "abbreviation": "CMV"}) == 1

        # Make sure there is only one occurrence of the abbreviation.
        assert mock_pymongo.viruses.count({"abbreviation": "CMV"}) == 1

    @pytest.mark.gen_test
    def test_replacement(self, monkeypatch, virus_document, merged_virus, import_transaction, viruses_collection,
                         mock_pymongo, import_json):
        """
        When a virus exists in the database and the import file and the ``replace`` options is set, make sure that
        existing viruses are removed and the new virus is inserted. Check that history was updated to reflect the
        changes.

        """
        virus_document["username"] = "test"

        @virtool.gen.synchronous
        def return_json(*args):
            imported = import_json[0:3]
            imported.append(merged_virus)
            return imported

        monkeypatch.setattr("virtool.virusutils.read_import_file", return_json)

        virus_document["_version"] = 10

        yield viruses_collection.insert(virus_document)

        assert 1 == mock_pymongo.viruses.count({
            "_id": virus_document["_id"],
            "_version": 10,
            "name": "Cucumber mosaic virus"
        })

        transaction = import_transaction({"replace": True})

        yield viruses_collection.import_file(transaction)

        assert mock_pymongo.viruses.count({"_version": 0, "name": "Cucumber mosaic virus"}) == 1

        print(list(mock_pymongo.viruses.find({}, ["name"])))

        assert mock_pymongo.viruses.count() == 4

        assert mock_pymongo.sequences.count() == 9

        # There should be 4 history additions for inserting new viruses and 1 addition for removing the existing CMV.
        calls = [c[1] for c in viruses_collection.collections["history"].stubs["add_for_import"].mock_calls]

        assert len([call for call in calls if call[0] == "insert"]) == 4
        assert len([call for call in calls if call[0] == "remove"]) == 1

        assert transaction.fulfill_called == (
            True,
            {"added": 3, "replaced": 1, "skipped": 0, "warnings": [], "progress": 1}
        )

    @pytest.mark.gen_test
    def test_no_replacement(self, monkeypatch, virus_document, merged_virus, import_transaction, viruses_collection,
                            mock_pymongo, import_json):
        """
        When a virus exists in the database and the import file and the ``replace`` options is not set, make sure that
        existing viruses are retained and the new virus is discarded. Check that no virus was removed.

        """
        virus_document["username"] = "test"

        @virtool.gen.synchronous
        def return_json(*args):
            imported = import_json[0:3]
            imported.append(merged_virus)
            return imported

        monkeypatch.setattr("virtool.virusutils.read_import_file", return_json)

        virus_document["_version"] = 10

        yield viruses_collection.insert(virus_document)

        assert 1 == mock_pymongo.viruses.count({
            "_id": virus_document["_id"],
            "_version": 10,
            "name": "Cucumber mosaic virus"
        })

        transaction = import_transaction({"replace": False})

        yield viruses_collection.import_file(transaction)

        assert 1 == mock_pymongo.viruses.count({
            "_id": virus_document["_id"],
            "_version": 10,
            "name": "Cucumber mosaic virus"
        })

        assert mock_pymongo.viruses.count() == 4

        # Seven instead of nine because the initially inserted virus was not added with any sequences.
        assert mock_pymongo.sequences.count() == 7

        # There should be 4 history additions for inserting new viruses and 1 addition for removing the existing CMV.
        calls = [c[1] for c in viruses_collection.collections["history"].stubs["add_for_import"].mock_calls]

        assert len([call for call in calls if call[0] == "insert"]) == 3
        assert len([call for call in calls if call[0] == "remove"]) == 0

        assert transaction.fulfill_called == (
            True,
            {"added": 3, "replaced": 0, "skipped": 1, "warnings": [], "progress": 1}
        )
