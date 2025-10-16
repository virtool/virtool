from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

from virtool.data.transforms import apply_transforms
from virtool.ml.pg import SQLMLModel, SQLMLModelRelease
from virtool.ml.transforms import AttachMLTransform


class TestAttachMLTransform:
    async def test_single(
        self, pg: AsyncEngine, snapshot: SnapshotAssertion, static_time
    ):
        """Test that the transform works with a single document."""
        async with AsyncSession(pg) as session:
            ml_model_1 = SQLMLModel(
                created_at=static_time.datetime,
                name="Test 1",
                description="test",
            )

            session.add(ml_model_1)

            await session.flush()

            session.add_all(
                [
                    SQLMLModelRelease(
                        created_at=static_time.datetime,
                        download_url="test",
                        github_url="test",
                        model_id=ml_model_1.id,
                        name="0.1.0",
                        published_at=static_time.datetime,
                        ready=True,
                        size=1,
                    ),
                    SQLMLModelRelease(
                        created_at=static_time.datetime,
                        download_url="test",
                        github_url="test",
                        model_id=ml_model_1.id,
                        name="0.1.1",
                        published_at=static_time.datetime,
                        ready=True,
                        size=1,
                    ),
                ]
            )

            await session.commit()

        assert await apply_transforms(
            {"id": 1, "ml": 2}, [AttachMLTransform(pg)], pg
        ) == snapshot(name="not_none")

        assert await apply_transforms(
            {"id": 1, "ml": None}, [AttachMLTransform(pg)], pg
        ) == snapshot(name="none")

    async def test_multi(
        self, pg: AsyncEngine, snapshot: SnapshotAssertion, static_time
    ):
        async with AsyncSession(pg) as session:
            ml_model_1 = SQLMLModel(
                created_at=static_time.datetime,
                name="Test 1",
                description="test",
            )

            ml_model_2 = SQLMLModel(
                created_at=static_time.datetime,
                name="Test 2",
                description="test",
            )

            session.add_all([ml_model_1, ml_model_2])

            await session.flush()

            session.add_all(
                [
                    SQLMLModelRelease(
                        created_at=static_time.datetime,
                        download_url="test",
                        github_url="test",
                        model_id=ml_model_1.id,
                        name="0.1.0",
                        published_at=static_time.datetime,
                        ready=True,
                        size=1,
                    ),
                    SQLMLModelRelease(
                        created_at=static_time.datetime,
                        download_url="test",
                        github_url="test",
                        model_id=ml_model_1.id,
                        name="0.1.1",
                        published_at=static_time.datetime,
                        ready=True,
                        size=1,
                    ),
                    SQLMLModelRelease(
                        created_at=static_time.datetime,
                        download_url="test",
                        github_url="test",
                        model_id=ml_model_2.id,
                        name="1.2.1",
                        published_at=static_time.datetime,
                        ready=True,
                        size=1,
                    ),
                ]
            )

            await session.commit()

        documents = [
            {"id": 1, "ml": 1},
            {"id": 2, "ml": None},
            {"id": 3, "ml": 3},
        ]

        assert (
            await apply_transforms(documents, [AttachMLTransform(pg)], pg) == snapshot
        )
