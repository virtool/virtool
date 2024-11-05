from pathlib import Path

from virtool.version import determine_server_version


class TestFindServerVersion:
    """Test the function that determines the server version."""

    def test_ok(self, pwd: Path):
        """Test that the function returns the correct version when the VERSION file
        exists.
        """
        pwd.joinpath("VERSION").write_text("1.0.12")
        assert determine_server_version() == "1.0.12"

    def test_no_version_file(self, pwd: Path):
        """Test that the function returns "Unknown" when the VERSION file does not
        exist.
        """
        assert (pwd / "VERSION").exists() is False
        assert determine_server_version() == "Unknown"
