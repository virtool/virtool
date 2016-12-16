import pytest

'''
class TestGetDocumentId:

    @pytest.mark.gen_test
    def test_basic(self, temp_mongo, alphanumeric):

        new_id = yield virtool.utils.get_new_document_id(temp_mongo.files)

        assert len(new_id) == 8
        assert all(l in alphanumeric for l in new_id)

    @pytest.mark.gen_test
    def test_excluded(self, temp_mongo, randomizer):

        result = yield temp_mongo.files.find().distinct("_id")

        assert len(result) == 0

        for i in range(0, 5):
            new_id = yield virtool.utils.get_new_document_id(
                temp_mongo.files,
                excluded=["skk342"],
                randomizer=randomizer
            )

            assert new_id != "skk342"

    @pytest.mark.gen_test
    def test_existing_id(self, temp_mongo, mock_mongo, randomizer):

        result = yield temp_mongo.files.find().distinct("_id")

        assert len(result) == 0

        # Insert a document with the _id "skl1qq". This should not be returned as a valid new id.
        document = {
            "_id": "skl1qq",
            "name": "skl1qq"
        }

        mock_mongo.files.insert(document)

        result = yield temp_mongo.files.find_one()

        assert result == document

        for i in range(0, 5):
            new_id = yield virtool.utils.get_new_document_id(
                temp_mongo.files,
                randomizer=randomizer
            )

            assert new_id != "skl1qq"
'''