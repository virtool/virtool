import asyncio

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.indexes.db
from virtool.fake.next import DataFaker
from virtool.history.sql import SQLLegacyHistory
from virtool.indexes.db import (
    attach_files,
    get_current_id,
    get_next_version,
    iter_patched_otus,
    update_last_indexed_versions,
    upsert_index_file,
)
from virtool.indexes.models import Index
from virtool.indexes.sql import SQLIndex, SQLIndexFile
from virtool.otus.sql import SQLOTU
from virtool.utils import timestamp


async def _seed_index(pg: AsyncEngine, fake: DataFaker, legacy_id: str) -> int:
    """Seed a single ``indexes`` row keyed by ``legacy_id`` and return its integer id.

    ``index_files`` rows carry a non-null integer FK to ``indexes``, so the file
    helpers below need a real parent index to point at.
    """
    user = await fake.users.create()
    reference = await fake.references.create(user=user)
    job = await fake.jobs.create(user=user)

    async with AsyncSession(pg) as session:
        index = SQLIndex(
            legacy_id=legacy_id,
            version=0,
            created_at=timestamp(),
            manifest={},
            ready=False,
            storage_key=legacy_id,
            reference_id=reference.id,
            user_id=user.id,
            job_id=job.id,
            task_id=None,
        )
        session.add(index)
        await session.flush()
        index_pk = index.id
        await session.commit()

    return index_pk


async def test_create(
    pg: AsyncEngine,
    fake,
    static_time,
):
    """A new index is created Postgres-natively: the id is minted by the sequence,
    ``legacy_id`` is null, and ``storage_key`` is a freshly minted UUID rather than a
    Mongo slug.
    """
    user = await fake.users.create()
    reference = await fake.references.create(user=user, id_="foo")
    task = await fake.tasks.create()

    async with AsyncSession(pg) as session:
        created = await virtool.indexes.db.create(
            session,
            "foo",
            user.id,
            0,
            "manifest",
            task_id=task.id,
        )

        assert created.id is not None
        assert created.legacy_id is None
        assert len(created.storage_key) == 32
        assert created.version == 0
        assert created.ready is False
        assert created.manifest == "manifest"
        assert created.created_at == static_time.datetime
        assert created.reference_id == reference.id
        assert created.user_id == user.id
        assert created.job_id is None
        assert created.task_id == task.id

        created_id = created.id
        created_storage_key = created.storage_key

        await session.commit()

    async with AsyncSession(pg) as session:
        row = (
            await session.execute(select(SQLIndex).where(SQLIndex.id == created_id))
        ).scalar_one()

    assert row.legacy_id is None
    assert row.storage_key == created_storage_key


async def test_create_assigns_index_in_postgres(
    pg: AsyncEngine,
    fake,
    static_time,
):
    """Building an index assigns previously-unbuilt changes for the reference to the
    new index in ``legacy_history``, leaving other references and already-built
    changes untouched.
    """
    user = await fake.users.create()
    built_ref = await fake.references.create(user=user, id_="built_ref")
    other_ref = await fake.references.create(user=user, id_="other_ref")
    task = await fake.tasks.create()

    prior_index = await fake.indexes.create(built_ref, user, version=0, ready=True)

    async with AsyncSession(pg) as session:
        prior_index_pk = await session.scalar(
            select(SQLIndex.id).where(SQLIndex.legacy_id == prior_index.id),
        )

    def legacy_row(
        legacy_id: str,
        reference_id: int,
        index: str | None,
        index_pk: int | None,
    ) -> SQLLegacyHistory:
        return SQLLegacyHistory(
            legacy_id=legacy_id,
            created_at=static_time.datetime,
            description="",
            method_name="create_otu",
            user_id=user.id,
            otu=legacy_id,
            otu_name=legacy_id,
            otu_version="0",
            reference_id=reference_id,
            index=index,
            index_id=index_pk,
            index_version="0" if index else None,
        )

    async with AsyncSession(pg) as session:
        session.add_all(
            [
                legacy_row("ref_unbuilt", built_ref.id, None, None),
                legacy_row(
                    "ref_already_built", built_ref.id, prior_index.id, prior_index_pk
                ),
                legacy_row("other_ref_unbuilt", other_ref.id, None, None),
            ],
        )
        await session.commit()

    async with AsyncSession(pg) as session:
        new_index = await virtool.indexes.db.create(
            session,
            "built_ref",
            user.id,
            1,
            "manifest",
            task_id=task.id,
        )
        new_index_pk = new_index.id
        await session.commit()

    async with AsyncSession(pg) as session:
        rows = {
            row.legacy_id: (row.index_id, row.index_version)
            for row in (await session.execute(select(SQLLegacyHistory))).scalars()
        }

    assert rows["ref_unbuilt"] == (new_index_pk, "1")
    assert rows["ref_already_built"] == (prior_index_pk, "0")
    assert rows["other_ref_unbuilt"] == (None, None)


async def test_create_rolls_back_on_failure(
    mocker: MockerFixture,
    pg: AsyncEngine,
    fake,
    static_time,
):
    """A failure during the index build rolls back the Postgres index insert and the
    history assignment, leaving no index row and the change still unbuilt.
    """
    user = await fake.users.create()

    built_ref = await fake.references.create(user=user, id_="built_ref")
    task = await fake.tasks.create()

    async with AsyncSession(pg) as session:
        session.add(
            SQLLegacyHistory(
                legacy_id="ref_unbuilt",
                created_at=static_time.datetime,
                description="",
                method_name="create_otu",
                user_id=user.id,
                otu="ref_unbuilt",
                otu_name="ref_unbuilt",
                otu_version="0",
                reference_id=built_ref.id,
                index=None,
                index_version=None,
            ),
        )
        await session.commit()

    mocker.patch(
        "virtool.indexes.db.update",
        side_effect=RuntimeError("postgres write failed"),
    )

    with pytest.raises(RuntimeError, match="postgres write failed"):
        async with AsyncSession(pg) as session:
            await virtool.indexes.db.create(
                session,
                "built_ref",
                user.id,
                1,
                "manifest",
                task_id=task.id,
            )
            await session.commit()

    async with AsyncSession(pg) as session:
        row = (
            await session.execute(
                select(SQLLegacyHistory).where(
                    SQLLegacyHistory.legacy_id == "ref_unbuilt",
                ),
            )
        ).scalar_one()

        index_row = (await session.execute(select(SQLIndex))).scalar_one_or_none()

    assert row.index_id is None
    assert row.index_version is None
    assert index_row is None


async def _seed_index_series(
    fake: DataFaker,
    *,
    ready: bool,
) -> list[Index]:
    """Seed four successive indexes for the ``indexed_ref`` reference."""
    user = await fake.users.create()
    reference = await fake.references.create(user=user, id_="indexed_ref")

    return [
        await fake.indexes.create(reference, user, version=version, ready=ready)
        for version in range(4)
    ]


class TestGetCurrentId:
    async def test_returns_highest_version(self, fake: DataFaker, pg: AsyncEngine):
        """The most recently built index for the reference is the current one."""
        indexes = await _seed_index_series(fake, ready=True)

        assert await get_current_id(pg, "indexed_ref") == indexes[3].id

    async def test_no_ready_index(self, fake: DataFaker, pg: AsyncEngine):
        """A reference whose indexes are all unbuilt has no current index."""
        await _seed_index_series(fake, ready=False)

        assert await get_current_id(pg, "indexed_ref") is None

    async def test_unknown_reference(self, fake: DataFaker, pg: AsyncEngine):
        """Indexes belonging to another reference are not matched."""
        await _seed_index_series(fake, ready=True)

        assert await get_current_id(pg, "other_ref") is None


class TestGetNextVersion:
    async def test_follows_highest_version(self, fake: DataFaker, pg: AsyncEngine):
        """The next version is one past the highest existing version."""
        await _seed_index_series(fake, ready=True)

        async with AsyncSession(pg) as session:
            assert await get_next_version(session, "indexed_ref") == 4

    async def test_no_indexes(self, fake: DataFaker, pg: AsyncEngine):
        """A reference with no indexes at all starts at version 0."""
        user = await fake.users.create()
        await fake.references.create(user=user, id_="indexed_ref")

        async with AsyncSession(pg) as session:
            assert await get_next_version(session, "indexed_ref") == 0

    async def test_unknown_reference(self, fake: DataFaker, pg: AsyncEngine):
        """Indexes belonging to another reference are not counted."""
        await _seed_index_series(fake, ready=True)

        async with AsyncSession(pg) as session:
            assert await get_next_version(session, "other_ref") == 0

    async def test_version_not_reused_after_delete(
        self, fake: DataFaker, pg: AsyncEngine
    ):
        """Deleting a lower-versioned index does not free its number for reuse.

        ``MAX(version) + 1`` is monotonic, so a build assigned version ``N`` keeps
        ``N`` reserved even after a lower index is deleted. Ready-count allocation
        would drop to ``1`` here and collide with the surviving version-1 index.
        """
        indexes = await _seed_index_series(fake, ready=True)

        async with AsyncSession(pg) as session:
            await session.execute(
                delete(SQLIndex).where(SQLIndex.legacy_id == indexes[0].id),
            )
            await session.commit()

        async with AsyncSession(pg) as session:
            assert await get_next_version(session, "indexed_ref") == 4


async def test_iter_patched_otus_starts_when_consumed(
    mocker: MockerFixture,
):
    async def patch_to_version(_pg, otu_id, version):
        return None, {"_id": otu_id, "version": version}

    m = mocker.patch(
        "virtool.history.db.patch_to_version",
        side_effect=patch_to_version,
    )

    pg = mocker.Mock()
    stream = iter_patched_otus(pg, {"foo": 2, "bar": 10})

    assert m.call_count == 0

    assert await anext(stream) == {"_id": "foo", "version": 2}
    assert m.call_args_list[0] == mocker.call(pg, "foo", 2)

    assert await anext(stream) == {"_id": "bar", "version": 10}
    assert m.call_args_list[-1] == mocker.call(pg, "bar", 10)

    with pytest.raises(StopAsyncIteration):
        await anext(stream)

    assert m.call_count == 2


async def test_iter_patched_otus_preserves_order_when_patches_finish_out_of_order(
    mocker: MockerFixture,
):
    gates = {
        "slow": asyncio.Event(),
        "fast": asyncio.Event(),
    }
    all_started = asyncio.Event()
    started = []

    async def patch_to_version(_pg, otu_id, version):
        started.append(otu_id)

        if len(started) == 2:
            all_started.set()

        await gates[otu_id].wait()

        return None, {"_id": otu_id, "version": version}

    mocker.patch(
        "virtool.history.db.patch_to_version",
        side_effect=patch_to_version,
    )

    stream = iter_patched_otus(
        mocker.Mock(),
        {"slow": 1, "fast": 2},
    )

    first = asyncio.create_task(anext(stream))

    await asyncio.wait_for(all_started.wait(), timeout=1)

    gates["fast"].set()
    await asyncio.sleep(0)

    assert first.done() is False

    gates["slow"].set()

    assert await first == {"_id": "slow", "version": 1}
    assert await anext(stream) == {"_id": "fast", "version": 2}

    with pytest.raises(StopAsyncIteration):
        await anext(stream)


async def test_iter_patched_otus_limits_concurrent_patches(
    mocker: MockerFixture,
):
    concurrency = 3
    manifest = {f"otu_{i}": i for i in range(concurrency + 1)}
    gates = {otu_id: asyncio.Event() for otu_id in manifest}
    initial_patches_started = asyncio.Event()
    next_patch_started = asyncio.Event()
    started = []

    async def patch_to_version(_pg, otu_id, version):
        started.append(otu_id)

        if len(started) == concurrency:
            initial_patches_started.set()

        if len(started) == concurrency + 1:
            next_patch_started.set()

        await gates[otu_id].wait()

        return None, {"_id": otu_id, "version": version}

    mocker.patch(
        "virtool.history.db.patch_to_version",
        side_effect=patch_to_version,
    )

    stream = iter_patched_otus(
        mocker.Mock(),
        manifest,
        concurrency=concurrency,
    )

    first = asyncio.create_task(anext(stream))

    await asyncio.wait_for(initial_patches_started.wait(), timeout=1)

    assert started == [f"otu_{i}" for i in range(concurrency)]

    gates[f"otu_{concurrency - 1}"].set()
    await asyncio.wait_for(next_patch_started.wait(), timeout=1)

    assert started == [f"otu_{i}" for i in range(concurrency + 1)]

    gates["otu_0"].set()

    assert await first == {"_id": "otu_0", "version": 0}

    await stream.aclose()


async def test_iter_patched_otus_limits_scheduled_lookahead(
    mocker: MockerFixture,
):
    concurrency = 2
    window_size = 5
    manifest = {f"otu_{i}": i for i in range(window_size + 1)}
    gates = {otu_id: asyncio.Event() for otu_id in manifest}
    initial_patches_started = asyncio.Event()
    window_started = asyncio.Event()
    beyond_window_started = asyncio.Event()
    started = []

    async def patch_to_version(_pg, otu_id, version):
        started.append(otu_id)

        if len(started) == concurrency:
            initial_patches_started.set()

        if len(started) == window_size:
            window_started.set()

        if len(started) == window_size + 1:
            beyond_window_started.set()

        await gates[otu_id].wait()

        return None, {"_id": otu_id, "version": version}

    mocker.patch(
        "virtool.history.db.patch_to_version",
        side_effect=patch_to_version,
    )

    stream = iter_patched_otus(
        mocker.Mock(),
        manifest,
        concurrency=concurrency,
        window_size=window_size,
    )

    first = asyncio.create_task(anext(stream))

    await asyncio.wait_for(initial_patches_started.wait(), timeout=1)

    assert started == [f"otu_{i}" for i in range(concurrency)]

    async def release_started_otus_until(target_count: int) -> None:
        next_to_release = 1

        while len(started) < target_count:
            for i in range(next_to_release, len(started)):
                gates[f"otu_{i}"].set()

            next_to_release = len(started)
            await asyncio.sleep(0)

    await asyncio.wait_for(release_started_otus_until(window_size), timeout=1)
    await asyncio.wait_for(window_started.wait(), timeout=1)

    for _ in range(3):
        await asyncio.sleep(0)

    assert started == [f"otu_{i}" for i in range(window_size)]
    assert beyond_window_started.is_set() is False

    gates["otu_0"].set()

    assert await first == {"_id": "otu_0", "version": 0}

    second = asyncio.create_task(anext(stream))

    await asyncio.wait_for(beyond_window_started.wait(), timeout=1)

    assert await second == {"_id": "otu_1", "version": 1}

    await stream.aclose()


async def test_upsert_index_file_creates_row(fake: DataFaker, pg: AsyncEngine):
    index_pk = await _seed_index(pg, fake, "foo")

    async with AsyncSession(pg) as session:
        assert (
            await session.execute(
                select(SQLIndexFile).filter_by(
                    index="foo",
                    name="reference.json.gz",
                ),
            )
        ).scalar_one_or_none() is None

    async with AsyncSession(pg) as session:
        assert await upsert_index_file(
            session,
            "foo",
            "json",
            "reference.json.gz",
            9000,
        ) == {
            "id": 1,
            "index": "foo",
            "name": "reference.json.gz",
            "size": 9000,
            "type": "json",
        }
        await session.commit()

    async with AsyncSession(pg) as session:
        row = (
            await session.execute(
                select(SQLIndexFile).filter_by(
                    index="foo",
                    name="reference.json.gz",
                ),
            )
        ).scalar_one()

    assert row.to_dict() == {
        "id": 1,
        "index": "foo",
        "index_id": index_pk,
        "name": "reference.json.gz",
        "size": 9000,
        "type": "json",
    }


async def test_upsert_index_file_updates_existing_row(fake: DataFaker, pg: AsyncEngine):
    index_pk = await _seed_index(pg, fake, "foo")

    async with AsyncSession(pg) as session:
        session.add(
            SQLIndexFile(
                index="foo",
                index_id=index_pk,
                name="reference.json.gz",
                size=1,
                type="json",
            ),
        )
        await session.commit()

    async with AsyncSession(pg) as session:
        assert await upsert_index_file(
            session,
            "foo",
            "json",
            "reference.json.gz",
            9000,
        ) == {
            "id": 1,
            "index": "foo",
            "name": "reference.json.gz",
            "size": 9000,
            "type": "json",
        }
        await session.commit()

    async with AsyncSession(pg) as session:
        rows = (
            (
                await session.execute(
                    select(SQLIndexFile).filter_by(index="foo"),
                )
            )
            .scalars()
            .all()
        )

    assert len(rows) == 1


class TestUpdateLastIndexedVersions:
    async def test_stamps_postgres(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """The stamp lands on the promoted column and its ``data`` counterpart.

        Postgres holds the value twice -- in the promoted column and in the ``data``
        JSONB the document is recovered from -- and the stamp must land in both.
        """
        user = await fake.users.create()
        reference = await fake.references.create(user=user)
        otu = await fake.otus.create(reference.id, user)

        async with AsyncSession(pg) as session:
            await update_last_indexed_versions(reference.id, session)
            await session.commit()

            row = await session.scalar(
                select(SQLOTU)
                .where(SQLOTU.id == otu.id)
                .execution_options(
                    populate_existing=True,
                ),
            )

        assert row.last_indexed_version == row.version
        assert row.data["last_indexed_version"] == row.version

    async def test_stamps_every_chunk(
        self,
        fake: DataFaker,
        mocker: MockerFixture,
        pg: AsyncEngine,
    ):
        """Every OTU is stamped when the id list spans more than one chunk.

        The ids are chunked because asyncpg binds one parameter per id. A reference
        whose OTUs all sit in one version bucket -- a fresh import, where every OTU is
        version 0 -- would otherwise blow the parameter limit.

        The OTUs are created empty so they all stay at version 0 and so group into a
        single bucket. An OTU with isolates lands on a version of its own, which would
        leave every bucket holding one id and never exercise a chunk boundary.
        """
        mocker.patch("virtool.indexes.db.OTU_ID_CHUNK_SIZE", 2)

        user = await fake.users.create()
        reference = await fake.references.create(user=user)

        otus = [await fake.otus.create_empty(reference.id, user) for _ in range(5)]

        async with AsyncSession(pg) as session:
            await update_last_indexed_versions(reference.id, session)
            await session.commit()

        async with AsyncSession(pg) as session:
            rows = {
                row.id: row
                for row in (
                    await session.execute(
                        select(SQLOTU).where(
                            SQLOTU.id.in_([otu.id for otu in otus]),
                        ),
                    )
                ).scalars()
            }

        assert len(rows) == 5

        for otu in otus:
            assert rows[otu.id].last_indexed_version == rows[otu.id].version
            assert rows[otu.id].data["last_indexed_version"] == rows[otu.id].version


async def test_attach_files(snapshot, fake: DataFaker, pg: AsyncEngine):
    index_pk = await _seed_index(pg, fake, "foo")

    index_1 = SQLIndexFile(
        id=1,
        name="reference.fa.gz",
        index="foo",
        index_id=index_pk,
        type="fasta",
        size=1234567,
    )
    index_2 = SQLIndexFile(
        id=2,
        name="reference.json.gz",
        index="foo",
        index_id=index_pk,
        type="json",
        size=1234567,
    )

    async with AsyncSession(pg) as session:
        session.add_all([index_1, index_2])
        await session.commit()

    document = {"_id": "foo", "reference": {"id": "bar"}}

    assert (
        await attach_files(pg, "https://virtool.example.com/api", document) == snapshot
    )
