import pytest
from pydantic import ValidationError

from virtool.references.oas import CreateReferenceRequest


@pytest.fixture
def mock_create_reference_schema():
    return {
        "name": "Test Viruses",
        "description": "A bunch of viruses used for testing",
        "data_type": "genome",
        "organism": "virus",
    }


@pytest.mark.parametrize(
    "update_dict",
    [
        {},
        {"data_type": "bad type"},
        {"import_from": 1, "clone_from": "test"},
    ],
)
def test_schema(update_dict, mock_create_reference_schema):
    CreateReferenceRequest(**mock_create_reference_schema)

    if update_dict:
        with pytest.raises(ValidationError):
            mock_create_reference_schema.update(update_dict)
            CreateReferenceRequest(**mock_create_reference_schema)


@pytest.mark.parametrize("value", ["import_from", "clone_from"])
def test_values(value, mock_create_reference_schema):
    if value == "import_from":
        mock_create_reference_schema.update({value: 1})
    else:
        mock_create_reference_schema.update({value: "test"})

    CreateReferenceRequest(**mock_create_reference_schema)


@pytest.mark.parametrize("value", ["import_from", "clone_from"])
def test_null(value, mock_create_reference_schema):
    mock_create_reference_schema.update({value: None})

    with pytest.raises(ValidationError):
        CreateReferenceRequest(**mock_create_reference_schema)
