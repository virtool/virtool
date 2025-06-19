import re
from pathlib import Path

import arrow
from pytest_mock import MockerFixture

from virtool.migration.cls import GenericRevision, RevisionSource
from virtool.migration.create import create_revision


def test_create_revision(revisions_path: Path):
    revision_ids = [
        create_revision("Test A"),
        create_revision("Test B"),
        create_revision("Test C"),
    ]

    for revision_path in revisions_path.iterdir():
        if "__pycache__" in str(revision_path):
            continue

        match = re.match(r"rev_([a-z\d]{12})_(test_[abc])\.py", str(revision_path.name))

        assert match

        revision_id = match.group(1)
        transformed_name = match.group(2)

        assert revision_id in revision_ids

        with open(revision_path) as f:
            text = f.read()
            name = f"Test {transformed_name[-1].upper()}"

            assert f'"""\n{name}' in text
            assert f"Revision ID: {revision_id}" in text
            assert f'revision_id = "{revision_id}"' in text
            assert f'name = "{name}"' in text
            assert "async def upgrade(ctx: MigrationContext):" in text


def test_create_revision_none_values(revisions_path: Path, mocker: MockerFixture):
    """Test that None values are written as None, not as "None" strings.

    Creates a mock revision that is an Alembic revision.
    This means virtool_down_revision should be None.
    """
    mock_alembic_revision = GenericRevision(
        id="mock_alembic_id",
        name="Mock Alembic Revision",
        source=RevisionSource.ALEMBIC,
        created_at=arrow.utcnow().naive,
        alembic_downgrade=None,
        virtool_downgrade=None,
        upgrade=None,
    )

    mocker.patch(
        "virtool.migration.create.load_all_revisions",
        return_value=[mock_alembic_revision],
    )

    create_revision("test none values")

    # Find the created revision file
    revision_files = [f for f in revisions_path.iterdir() if f.name.startswith("rev_")]
    assert len(revision_files) == 1

    revision_file = revision_files[0]

    with open(revision_file) as f:
        content = f.read()

    # When most recent is Alembic: alembic_down_revision gets the ID, virtool_down_revision is None
    assert f'alembic_down_revision = "{mock_alembic_revision.id}"' in content
    assert "virtool_down_revision = None" in content

    # Ensure no "None" strings are present where None should be
    assert 'virtool_down_revision = "None"' not in content


def test_create_revision_virtool_none_values(revisions_path: Path, mocker):
    """Test that None values are written as None when most recent revision is Virtool."""
    mock_virtool_revision = GenericRevision(
        id="mock_virtool_id",
        name="Mock Virtool Revision",
        source=RevisionSource.VIRTOOL,
        created_at=arrow.utcnow().naive,
        alembic_downgrade=None,
        virtool_downgrade=None,
        upgrade=None,
    )

    mocker.patch(
        "virtool.migration.create.load_all_revisions",
        return_value=[mock_virtool_revision],
    )

    create_revision("test virtool none values")

    # Find the created revision file
    revision_files_ = [f for f in revisions_path.iterdir() if f.name.startswith("rev_")]
    assert len(revision_files_) == 1

    with open(revision_files_[0]) as f:
        content = f.read()

    # When most recent is Virtool: virtool_down_revision gets the ID, alembic_down_revision is None
    assert "alembic_down_revision = None" in content
    assert f'virtool_down_revision = "{mock_virtool_revision.id}"' in content

    # Ensure no "None" strings are present where None should be
    assert 'alembic_down_revision = "None"' not in content
