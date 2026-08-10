import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

import virtool.analyses.files
import virtool.analyses.utils
from tests.fixtures.analysis import seed_index
from virtool.analyses.sql import SQLAnalysis
from virtool.users.pg import SQLUser


@pytest.mark.parametrize("exists", [True, False])
async def test_attach_analysis_files(
    exists: bool,
    pg: AsyncEngine,
    snapshot: SnapshotAssertion,
    static_time,
):
    async with AsyncSession(pg) as session:
        session.add(
            SQLUser(
                id=1,
                handle="leeashley",
                last_password_change=static_time.datetime,
                password=b"hashed",
                settings={},
            ),
        )
        await session.flush()

        analysis = SQLAnalysis(
            legacy_id="foobar",
            created_at=static_time.datetime,
            updated_at=static_time.datetime,
            workflow="nuvs",
            ready=True,
            results=None,
            sample="sample",
            reference="reference",
            index="index",
            index_id=await seed_index(session, 1),
            user_id=1,
        )

        session.add(analysis)
        await session.flush()

        analysis_id = analysis.id

        await session.commit()

    if exists:
        await virtool.analyses.files.create_analysis_file(
            pg,
            analysis_id,
            "fasta",
            "reference-fa",
        )

    document = {"_id": analysis_id, "ready": True}

    assert (
        await virtool.analyses.utils.attach_analysis_files(pg, analysis_id, document)
        == snapshot
    )
