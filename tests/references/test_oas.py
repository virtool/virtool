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
    "update_dict",
    [
        {},
        {"data_type": "bad type"},
        {"remote_from": "test"},
        {"import_from": "test", "clone_from": "test"},
        {
            "import_from": "test",
            "clone_from": "test",
            "remote_from": "virtool/ref-plant-viruses",
        },
    ],
)
def test_schema(update_dict, mock_create_reference_schema):
    CreateReferenceSchema(**mock_create_reference_schema)

    if update_dict:
        with pytest.raises(ValidationError):
            mock_create_reference_schema.update(update_dict)
            CreateReferenceSchema(**mock_create_reference_schema)


@pytest.mark.parametrize("value", ["import_from", "clone_from", "remote_from"])
def test_values(value, mock_create_reference_schema):
    mock_create_reference_schema.update({value: "test"})

    if value == "remote_from":
        mock_create_reference_schema.update({value: "virtool/ref-plant-viruses"})

    CreateReferenceSchema(**mock_create_reference_schema)


@pytest.mark.parametrize("value", ["release_id", "import_from", "clone_from", "remote_from"])
def test_null(value, mock_create_reference_schema):
    mock_create_reference_schema.update({value: None})

    with pytest.raises(ValidationError):
        CreateReferenceSchema(**mock_create_reference_schema)
