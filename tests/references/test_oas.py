import pytest
from pydantic import ValidationError

from virtool.references.oas import CreateReferenceSchema


@pytest.fixture
def mock_create_reference_schema():
    return {
        "name": "Test Viruses",
        "description": "A bunch of viruses used for testing",
        "data_type": "barcode",
        "organism": "virus",
    }


@pytest.mark.parametrize(
    "error", [None, "data_type", "remote_from", "two_values", "all_values"]
)
def test_schema(error, mock_create_reference_schema):
    CreateReferenceSchema(**mock_create_reference_schema)

    if error == "data_type":
        with pytest.raises(ValidationError):
            mock_create_reference_schema.update({"data_type": "bad type"})
            CreateReferenceSchema(**mock_create_reference_schema)

    elif error == "remote_from":
        with pytest.raises(ValidationError):
            mock_create_reference_schema.update({"remote_from": "test"})
            CreateReferenceSchema(**mock_create_reference_schema)

    elif error == "two_values":
        with pytest.raises(ValidationError):
            mock_create_reference_schema.update(
                {"import_from": "test", "clone_from": "test"}
            )
            CreateReferenceSchema(**mock_create_reference_schema)

    elif error == "all_values":
        with pytest.raises(ValidationError):
            mock_create_reference_schema.update(
                {
                    "import_from": "test",
                    "clone_from": "test",
                    "remote_from": "virtool/ref-plant-viruses",
                }
            )
            CreateReferenceSchema(**mock_create_reference_schema)


@pytest.mark.parametrize("value", ["import_from", "clone_from", "remote_from"])
def test_values(value, mock_create_reference_schema):
    mock_create_reference_schema.update({value: "test"})

    if value == "remote_from":
        mock_create_reference_schema.update({value: "virtool/ref-plant-viruses"})

    CreateReferenceSchema(**mock_create_reference_schema)

