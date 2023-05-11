import re
from pathlib import Path

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

        with open(revision_path, "r") as f:
            text = f.read()
            name = f"Test {transformed_name[-1].upper()}"

            assert f'"""\n{name}' in text
            assert f"Revision ID: {revision_id}" in text
            assert f'revision_id = "{revision_id}"' in text
            assert f'name = "{name}"' in text
            assert "async def upgrade(ctx: RevisionContext):" in text
