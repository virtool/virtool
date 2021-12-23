from virtool.validators import (
    is_valid_email,
    is_permission_dict,
    has_unique_segment_names,
    is_valid_hex_color,
)


async def test_is_permission_dict(mocker):
    stub = mocker.stub()
    is_permission_dict(
        "permissions",
        {
            "cancel_job": True,
            "create_ref": True,
            "create_sample": True,
            "modify_hmm": True,
            "modify_subtraction": True,
            "remove_file": True,
            "remove_job": True,
            "upload_file": True,
            "foo": True,
        },
        stub,
    )
    stub.assert_called_with("permissions", "keys must be valid permissions")


async def test_has_unique_segment_names(mocker):
    stub = mocker.stub()
    has_unique_segment_names("collection", [{"name": "foo"}, {"name": "foo"}], stub)
    stub.assert_called_with("collection", "list contains duplicate names")


async def test_is_valid_hex_color(mocker):
    stub = mocker.stub()
    is_valid_hex_color("color", "abc123", stub)
    stub.assert_called_with("color", "This is not a valid Hexadecimal color")


async def test_email(mocker):
    stub = mocker.stub()
    is_valid_email("email", "-foo-bar-baz.!.@.gm-ail.com", stub)
    stub.assert_called_with("email", "Not a valid email")
