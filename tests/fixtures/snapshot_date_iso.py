import pytest
from syrupy.filters import props


@pytest.fixture
def snapshot_custom(snapshot):
    custom = snapshot.with_defaults(exclude=props("created_at", "updated_at"))
    return custom
