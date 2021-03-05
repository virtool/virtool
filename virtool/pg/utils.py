from typing import Type, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession


async def delete_row(pg: AsyncEngine, id_: int, table: Type[any]):
    """
    Deletes a row in the `table` SQL table by its row `id_`.

    :param pg: PostgreSQL AsyncEngine object
    :param id_: Row `id` to delete from the given SQL table
    """
    async with AsyncSession(pg) as session:
        row = (await session.execute(select(table).where(table.id == id_))).scalar()

        if not row:
            return None

        await session.delete(row)

        await session.commit()


async def get_row(pg: AsyncEngine, id_: int, table: Type[any]) -> Optional[Type[any]]:
    """
    Get a row from the `table` SQL table by its `id`.

    :param pg: PostgreSQL AsyncEngine object
    :param id_: Row `id` to get
    :return: Row from the given SQL table
    """
    async with AsyncSession(pg) as session:
        row = (await session.execute(select(table).filter_by(id=id_))).scalar()

        if not row:
            return None

    return row
