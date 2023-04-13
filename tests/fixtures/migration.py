from pathlib import Path

import pytest


@pytest.fixture
def revisions_path(mocker, tmpdir) -> Path:
    path = Path(tmpdir) / "assets/revisions"
    mocker.patch("virtool.migration.create.get_revisions_path", return_value=path)

    return path
