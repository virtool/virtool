import pytest

from virtool.fake.wrapper import FakerWrapper

@pytest.fixture
def app(dbi, pg, tmpdir):
    return {
        "db": dbi,
        "fake": FakerWrapper(),
        "pg": pg,
        "settings": {
            "default_source_types": [
                "isolate",
                "strain"
            ],
            "data_path": str(tmpdir)
        }
    }