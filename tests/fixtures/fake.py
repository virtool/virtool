import pytest

from virtool.fake.wrapper import FakerWrapper


@pytest.fixture
def app(dbi, pg, tmp_path, config, settings):
    return {
        "db": dbi,
        "fake": FakerWrapper(),
        "pg": pg,
        "settings": settings,
        "config": config
        }
