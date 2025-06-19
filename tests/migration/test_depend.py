from datetime import datetime

from virtool.migration.cls import GenericRevision, RevisionSource
from virtool.migration.depend import depend


async def fake_upgrade(_):
    """Fake upgrade function for testing."""


class TestDepend:
    def test_ok(self, mocker, capsys):
        """Test with valid revision ID."""
        initial_content = 'REQUIRED_VIRTOOL_REVISION = "old_revision"\n'

        mock_revisions = [
            GenericRevision(
                alembic_downgrade=None,
                created_at=datetime(2021, 1, 1),
                id="test_revision",
                name="Test Revision",
                source=RevisionSource.VIRTOOL,
                upgrade=fake_upgrade,
                virtool_downgrade=None,
            ),
            GenericRevision(
                alembic_downgrade=None,
                created_at=datetime(2021, 1, 2),
                id="another_revision",
                name="Another Revision",
                source=RevisionSource.VIRTOOL,
                upgrade=fake_upgrade,
                virtool_downgrade=None,
            ),
        ]

        m = mocker.mock_open(read_data=initial_content)

        mocker.patch(
            "virtool.migration.depend.load_all_revisions", return_value=mock_revisions
        )
        mocker.patch("builtins.open", m)

        depend("test_revision")

        # Check that the file was written with the correct content
        written_content = "".join(call.args[0] for call in m().write.call_args_list)
        assert 'REQUIRED_VIRTOOL_REVISION = "test_revision"' in written_content

        captured = capsys.readouterr()
        assert captured.err == ""

    def test_latest_revision(self, mocker, capsys):
        """Test with 'latest' revision."""
        initial_content = 'REQUIRED_VIRTOOL_REVISION = "old_revision"\n'

        mock_revisions = [
            GenericRevision(
                alembic_downgrade=None,
                created_at=datetime(2021, 1, 1),
                id="first_revision",
                name="First Revision",
                source=RevisionSource.VIRTOOL,
                upgrade=fake_upgrade,
                virtool_downgrade=None,
            ),
            GenericRevision(
                alembic_downgrade=None,
                created_at=datetime(2021, 1, 2),
                id="latest_revision",
                name="Latest Revision",
                source=RevisionSource.VIRTOOL,
                upgrade=fake_upgrade,
                virtool_downgrade=None,
            ),
        ]

        m = mocker.mock_open(read_data=initial_content)

        mocker.patch(
            "virtool.migration.depend.load_all_revisions", return_value=mock_revisions
        )
        mocker.patch("builtins.open", m)

        depend("latest")

        # Check that the file was written with the correct content
        written_content = "".join(call.args[0] for call in m().write.call_args_list)
        assert 'REQUIRED_VIRTOOL_REVISION = "latest_revision"' in written_content

        captured = capsys.readouterr()
        assert captured.err == ""

    def test_nonexistent_revision(self, mocker, capsys):
        """Test that function errors when revision does not exist."""
        mock_revisions = [
            GenericRevision(
                alembic_downgrade=None,
                created_at=datetime(2021, 1, 1),
                id="existing_revision",
                name="Existing Revision",
                source=RevisionSource.VIRTOOL,
                upgrade=fake_upgrade,
                virtool_downgrade=None,
            ),
        ]

        mocker.patch(
            "virtool.migration.depend.load_all_revisions", return_value=mock_revisions
        )

        depend("nonexistent_revision")

        captured = capsys.readouterr()
        assert "Revision nonexistent_revision does not exist." in captured.err

    def test_file_not_found_error(self, mocker, capsys):
        """Test that function errors when required.py is not found."""
        mock_revisions = [
            GenericRevision(
                alembic_downgrade=None,
                created_at=datetime(2021, 1, 1),
                id="test_revision",
                name="Test Revision",
                source=RevisionSource.VIRTOOL,
                upgrade=fake_upgrade,
                virtool_downgrade=None,
            ),
        ]

        mocker.patch(
            "virtool.migration.depend.load_all_revisions", return_value=mock_revisions
        )
        mocker.patch("builtins.open", side_effect=FileNotFoundError)

        depend("test_revision")

        captured = capsys.readouterr()
        assert "Error: required.py file not found." in captured.err

    def test_permission_error(self, mocker, capsys):
        """Test that function handles permission errors when writing to required.py."""
        mock_revisions = [
            GenericRevision(
                alembic_downgrade=None,
                created_at=datetime(2021, 1, 1),
                id="test_revision",
                name="Test Revision",
                source=RevisionSource.VIRTOOL,
                upgrade=fake_upgrade,
                virtool_downgrade=None,
            ),
        ]

        mocker.patch(
            "virtool.migration.depend.load_all_revisions", return_value=mock_revisions
        )
        mocker.patch("builtins.open", side_effect=PermissionError)

        depend("test_revision")

        captured = capsys.readouterr()
        assert "Error: Insufficient permissions to modify required.py." in captured.err

    def test_preserves_other_lines(self, mocker):
        """Test that other lines in required.py are preserved."""
        original_content = (
            '"""Required migration constants."""\n'
            "\n"
            'REQUIRED_VIRTOOL_REVISION = "old_revision"\n'
            '"""The revision that Virtool requires to be applied before it can run.\n'
            "\n"
            "This constant can be updated automatically using `virtool migrate depend`.\n"
            '"""\n'
            "\n"
            'OTHER_CONSTANT = "some_value"\n'
        )

        mock_revisions = [
            GenericRevision(
                alembic_downgrade=None,
                created_at=datetime(2021, 1, 1),
                id="new_revision",
                name="New Revision",
                source=RevisionSource.VIRTOOL,
                upgrade=fake_upgrade,
                virtool_downgrade=None,
            ),
        ]

        m = mocker.mock_open(read_data=original_content)

        mocker.patch(
            "virtool.migration.depend.load_all_revisions", return_value=mock_revisions
        )
        mocker.patch("builtins.open", m)

        depend("new_revision")

        # Check that the file was written with the correct content
        written_content = "".join(call.args[0] for call in m().write.call_args_list)
        assert 'REQUIRED_VIRTOOL_REVISION = "new_revision"' in written_content
        assert 'OTHER_CONSTANT = "some_value"' in written_content
        assert '"""Required migration constants."""' in written_content
        assert "This constant can be updated automatically" in written_content

    def test_empty_revisions_list(self, mocker, capsys):
        """Test that errors is displayed for empty revisions list."""
        mocker.patch("virtool.migration.depend.load_all_revisions", return_value=[])

        depend("any_revision")

        captured = capsys.readouterr()
        assert "Revision any_revision does not exist." in captured.err

    def test_alembic_and_virtool_revisions(self, mocker):
        """Test that things work with mixed Alembic and Virtool revisions."""
        initial_content = 'REQUIRED_VIRTOOL_REVISION = "old_revision"\n'

        mock_revisions = [
            GenericRevision(
                alembic_downgrade=None,
                created_at=datetime(2021, 1, 1),
                id="alembic_rev",
                name="Alembic Revision",
                source=RevisionSource.ALEMBIC,
                upgrade=fake_upgrade,
                virtool_downgrade=None,
            ),
            GenericRevision(
                alembic_downgrade=None,
                created_at=datetime(2021, 1, 2),
                id="virtool_rev",
                name="Virtool Revision",
                source=RevisionSource.VIRTOOL,
                upgrade=fake_upgrade,
                virtool_downgrade=None,
            ),
        ]

        m = mocker.mock_open(read_data=initial_content)

        mocker.patch(
            "virtool.migration.depend.load_all_revisions", return_value=mock_revisions
        )
        mocker.patch("builtins.open", m)

        depend("alembic_rev")

        # Check that the file was written with the correct content
        written_content = "".join(call.args[0] for call in m().write.call_args_list)
        assert 'REQUIRED_VIRTOOL_REVISION = "alembic_rev"' in written_content
