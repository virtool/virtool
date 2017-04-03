import pytest
import virtool.history


class TestGetDefaultIsolate:

    def test_has_default(self, virus_document):
        default_isolate = virtool.history.get_default_isolate(virus_document)

        assert default_isolate == {"isolate_id": "dqz9u58g", "source_type": "strain", "source_name": "Fny"}

    def test_has_no_default(self, virus_document):
        virus_document["isolates"][0]["default"] = False

        with pytest.raises(ValueError) as err:
            virtool.history.get_default_isolate(virus_document)

        assert "Could not find default isolate in virus document" in str(err)

    def test_has_multiple_defaults(self, virus_document):
        virus_document["isolates"][1]["default"] = True

        with pytest.raises(ValueError) as err:
            virtool.history.get_default_isolate(virus_document)

        assert "Virus has 2 default isolates. Expected exactly 1" in str(err)
