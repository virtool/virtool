pytest_plugins = (
    "tests.fixtures.authorization",
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
    "tests.fixtures.logging",
    "tests.fixtures.migration",
    "tests.fixtures.otus",
    "tests.fixtures.pg",
    "tests.fixtures.redis",
    "tests.fixtures.references",
    "tests.fixtures.response",
    "tests.fixtures.samples",
    "tests.fixtures.settings",
    "tests.fixtures.subtractions",
    "tests.fixtures.tasks",
    "tests.fixtures.snapshot_date",
)


def pytest_addoption(parser):
    parser.addoption(
        "--db-connection-string",
        action="store",
        default="mongodb://root:virtool@localhost:9001",
    )

    parser.addoption(
        "--redis-connection-string",
        action="store",
        default="redis://root:virtool@localhost:9003",
    )

    parser.addoption(
        "--postgres-connection-string",
        action="store",
        default="postgresql+asyncpg://virtool:virtool@localhost:9002",
    )

    parser.addoption(
        "--openfga-host",
        action="store",
        default="localhost:9004",
    )

    parser.getgroup("syrupy").addoption(
        "--su",
        action="store_true",
        default=False,
        dest="update_snapshots",
        help="Update snapshots (alias)",
    )
