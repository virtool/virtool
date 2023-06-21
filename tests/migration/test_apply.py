import datetime
import shutil
from dataclasses import asdict
from logging import INFO
from pathlib import Path
from pprint import pprint

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy.matchers import path_type

from virtool.config.cls import MigrationConfig
from virtool.migration.pg import list_applied_revisions
from virtool.migration.apply import apply


@pytest.fixture
def example_revisions_path(revisions_path: Path):
    shutil.copytree(Path(__file__).parent / "revisions", revisions_path)


async def test_apply_revisions(
    example_revisions_path: Path,
    migration_config: MigrationConfig,
    migration_pg: AsyncEngine,
    snapshot,
):
    await apply(migration_config)

    assert [asdict(r) for r in await list_applied_revisions(migration_pg)] == snapshot(
        matcher=path_type(
            {
                ".*applied_at": (datetime.datetime,),
                ".*created_at": (datetime.datetime,),
            },
            regex=True,
        )
    )
