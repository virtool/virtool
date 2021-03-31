from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import create_async_engine

import virtool.api.json


async def create_test_database(connection_string: str, name: str):
    """
    Create a testing database with the passed name.

    Used for creating disposable databases during test runs and when the ``--fake`` option is in
    use on the backend.

    :param connection_string: the base connection string
    :type name: the database name

    """
    engine = create_async_engine(
        f"{connection_string}",
        isolation_level="AUTOCOMMIT",
        json_serializer=virtool.api.json.dumps
    )

    async with engine.connect() as conn:
        try:
            await conn.execute(text(f"CREATE DATABASE {name}"))
        except ProgrammingError as exc:
            if "DuplicateDatabaseError" not in str(exc):
                raise

    await engine.dispose()
