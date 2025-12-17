"""Configure pytest.

TODO: Remove import of virtool.spaces.sql once feature is fully removed.
"""

import pytest
from pytest_mock import MockerFixture

import virtool.jobs.pg
import virtool.spaces.sql  # noqa: F401
from virtool.users.utils import hash_password

pytest_plugins = (
    "tests.fixtures.client",
    "tests.fixtures.config",
    "tests.fixtures.core",
    "tests.fixtures.data",
    "tests.fixtures.mongo",
    "tests.fixtures.documents",
    "tests.fixtures.fake",
    "tests.fixtures.groups",
    "tests.fixtures.history",
    "tests.fixtures.indexes",
    "tests.fixtures.jobs",
    "tests.fixtures.migration",
    "tests.fixtures.otus",
    "tests.fixtures.pg",
    "tests.fixtures.redis",
    "tests.fixtures.references",
    "tests.fixtures.response",
    "tests.fixtures.samples",
    "tests.fixtures.settings",
    "tests.fixtures.subtractions",
    "tests.fixtures.snapshot_date",
    "tests.fixtures.workflow",
    "tests.fixtures.workflow_api",
)


def pytest_addoption(parser) -> None:
    parser.getgroup("syrupy").addoption(
        "--su",
        action="store_true",
        default=False,
        dest="update_snapshots",
        help="Update snapshots (alias)",
    )


@pytest.fixture(scope="session")
def _hash_password_speedup_memo() -> dict[tuple[bytes, bytes], bytes]:
    """A dictionary of memoized hash_password calls."""
    return {}


@pytest.fixture(autouse=True)
def _hash_password_speedup(
    _hash_password_speedup_memo: dict[str, bytes],
    mocker: MockerFixture,
):
    """Speed up ``hash_password`` calls by memoizing them."""

    def m_hash_password(password: str):
        if password in _hash_password_speedup_memo:
            return _hash_password_speedup_memo[password]

        hashed = hash_password(password)

        _hash_password_speedup_memo[password] = hashed

        return hashed

    mocker.patch("virtool.users.utils.hash_password", m_hash_password)
