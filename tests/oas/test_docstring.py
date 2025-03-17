"""Test docstring parsing for OAS generation."""

# Disable D401 and D404 to test parsing of malformed docstrings.
# ruff: noqa: D401,D404

import pytest
from virtool_core.models.user import User

from virtool.api.introspect import Docstring
from virtool.api.status import R200, r404
from virtool.oas.error import DocstringParsingError


class Parseable:
    """An example class that can be successfully parsed by `Docstring.from_string`."""

    def parse_this(self, a: int, b: str) -> R200[User] | r404:
        """Parse a description.

        Created solely to test endpoint handler docstring parsing.

        This line demonstrates that the description can span multiple lines and include
        new lines.

        Status Codes:
            200: Successful operation
            404: Not found

        """


class ParseableTooLongTitle(Parseable):
    """An example class to test that `Docstring.from_string` raises an exception when
    a method title spans multiple lines.
    """

    def parse_too_long_title(self):
        """This title is too long to be parsed. Titles cannot span multiple lines like
        this one does.
        """


class ParseableNotAllowedStatusCode(Parseable):
    """An example class to test that `Docstring.from_string` raises an exception when
    a method status code blocked contains a status code that is not allowed.
    """

    def parse_not_allowed_status_code(self):
        """This title is okay.

        But in the status code block is a status code that is not explicitly allowed.

        Status Codes:
            200: Successful operation
            410: Not allowed
        """


class TestDocstring:
    """Tests for the `Docstring` class, and it's `from_string` classmethod."""

    def test_ok(self):
        """Test that the docstring is parsed correctly."""
        docstring = Docstring.from_string(Parseable.parse_this.__doc__)

        assert docstring.title == "Parse a description."
        assert docstring.description == (
            "Created solely to test endpoint handler docstring parsing.\n\n"
            "This line demonstrates that the description can span multiple lines "
            "and include\nnew lines."
        )
        assert docstring.status_codes == {200: "Successful operation", 404: "Not found"}

    def test_title_too_long(self):
        """Test that a ValueError is raised when the description is too long."""
        with pytest.raises(
            DocstringParsingError,
            match="The title must defined only on the first line.",
        ):
            Docstring.from_string(ParseableTooLongTitle.parse_too_long_title.__doc__)

    def test_not_allowed_status_code(self):
        """Test that a ValueError is raised when a status code is not allowed."""
        with pytest.raises(
            DocstringParsingError,
            match="Status code 410 is not allowed.",
        ):
            Docstring.from_string(
                ParseableNotAllowedStatusCode.parse_not_allowed_status_code.__doc__,
            )
