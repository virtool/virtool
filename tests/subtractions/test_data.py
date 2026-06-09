import pytest
from multidict import MultiDict, MultiDictProxy
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.errors import ResourceNotFoundError
from virtool.data.events import (
    Operation,
    dangerously_clear_events,
    dangerously_get_event,
)
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.jobs.models import Job, Workflow
from virtool.mongo.core import Mongo
from virtool.subtractions.oas import (
    CreateSubtractionRequest,
    FinalizeSubtractionRequest,
    NucleotideComposition,
    UpdateSubtractionRequest,
)
from virtool.subtractions.pg import SQLSubtraction
from virtool.uploads.sql import SQLUpload, UploadType


def _empty_query() -> MultiDictProxy:
    return MultiDictProxy(MultiDict())


async def _modern_id(pg: AsyncEngine, legacy_id: str) -> int:
    """Look up the integer Postgres id for a subtraction's legacy string id."""
    async with AsyncSession(pg) as session:
        return await session.scalar(
            select(SQLSubtraction.id).where(SQLSubtraction.legacy_id == legacy_id),
        )


class TestCreate:
    async def test_links_job_to_subtraction(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """The create job and its subtraction commit together, linked by job_id.

        The job carries no stored ``subtraction_id``; the relationship is derived
        from ``subtractions.job_id``, so ``jobs.get`` resolves the argument back
        to the subtraction's integer id.
        """
        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )

        subtraction = await data_layer.subtractions.create(
            CreateSubtractionRequest(name="Arabidopsis", upload_id=upload.id),
            user.id,
            0,
        )

        async with AsyncSession(pg) as session:
            row = (
                await session.execute(
                    select(SQLSubtraction.id, SQLSubtraction.job_id).where(
                        SQLSubtraction.legacy_id == subtraction.id,
                    ),
                )
            ).one()

        subtraction_pg_id, job_id = row
        assert job_id is not None

        job = await data_layer.jobs.get(job_id)
        assert job.workflow == Workflow.CREATE_SUBTRACTION
        assert job.args == {"subtraction_id": subtraction_pg_id}

    async def test_emits_job_create_event(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        """Creating a subtraction emits a jobs-domain create event for its job.

        The event must fire after the job is committed, carrying the full job so
        the websocket server can refetch and push it.
        """
        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )

        dangerously_clear_events()

        await data_layer.subtractions.create(
            CreateSubtractionRequest(name="Arabidopsis", upload_id=upload.id),
            user.id,
            0,
        )

        event = await dangerously_get_event()

        assert event.domain == "jobs"
        assert event.operation == Operation.CREATE
        assert isinstance(event.data, Job)
        assert event.data.workflow == Workflow.CREATE_SUBTRACTION


class TestFind:
    """Reads served from Postgres by ``SubtractionsData.find``."""

    async def test_search_matches_name_and_nickname(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        """The case-insensitive ``find`` term matches both name and nickname."""
        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )

        arabidopsis = await fake.subtractions.create(user=user, upload=upload)
        await data_layer.subtractions.update(
            arabidopsis.id,
            UpdateSubtractionRequest(name="Arabidopsis thaliana", nickname="cress"),
        )

        malus = await fake.subtractions.create(user=user, upload=upload)
        await data_layer.subtractions.update(
            malus.id,
            UpdateSubtractionRequest(name="Malus domestica", nickname="apple"),
        )

        by_name = await data_layer.subtractions.find(
            "MALUS", False, False, _empty_query()
        )
        assert [d.id for d in by_name.documents] == [malus.id]
        assert by_name.found_count == 1
        assert by_name.total_count == 2

        by_nickname = await data_layer.subtractions.find(
            "cress", False, False, _empty_query()
        )
        assert [d.id for d in by_nickname.documents] == [arabidopsis.id]

    async def test_lists_subtraction_with_removed_upload(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """A subtraction whose source upload is removed still lists with a file.

        Regression for VIR-2478: the read path must not raise when the linked
        upload is flagged ``removed``, which is how reconstructed uploads for
        deleted sources are stored.
        """
        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )
        subtraction = await fake.subtractions.create(user=user, upload=upload)

        async with AsyncSession(pg) as session:
            await session.execute(
                update(SQLUpload).where(SQLUpload.id == upload.id).values(removed=True),
            )
            await session.commit()

        result = await data_layer.subtractions.find(None, False, False, _empty_query())

        assert [d.id for d in result.documents] == [subtraction.id]
        assert result.documents[0].file.id == upload.id

    async def test_ready_filter(self, data_layer: DataLayer, fake: DataFaker):
        """``ready=True`` returns only finalized subtractions but counts both."""
        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )

        ready = await fake.subtractions.create(user=user, upload=upload, finalized=True)
        await fake.subtractions.create(user=user, upload=upload, finalized=False)

        result = await data_layer.subtractions.find(None, False, True, _empty_query())

        assert [d.id for d in result.documents] == [ready.id]
        assert result.found_count == 1
        assert result.ready_count == 1
        assert result.total_count == 2

    async def test_deleted_excluded(self, data_layer: DataLayer, fake: DataFaker):
        """Soft-deleted subtractions never appear in find results or counts."""
        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )

        kept = await fake.subtractions.create(user=user, upload=upload)
        removed = await fake.subtractions.create(user=user, upload=upload)
        await data_layer.subtractions.delete(removed.id)

        result = await data_layer.subtractions.find(None, False, False, _empty_query())

        assert [d.id for d in result.documents] == [kept.id]
        assert result.total_count == 1

    async def test_short(self, data_layer: DataLayer, fake: DataFaker):
        """Short mode returns a flat list of id/name/ready dicts."""
        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )

        subtraction = await fake.subtractions.create(user=user, upload=upload)

        result = await data_layer.subtractions.find(None, True, False, _empty_query())

        assert result == [{"id": subtraction.id, "name": "foo", "ready": True}]

    async def test_search_escapes_sql_wildcards(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        """Search treats ``%``, ``_``, and ``\\`` as literals, not LIKE wildcards."""
        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )

        async def named(name: str) -> str:
            subtraction = await fake.subtractions.create(user=user, upload=upload)
            await data_layer.subtractions.update(
                subtraction.id,
                UpdateSubtractionRequest(name=name, nickname=""),
            )
            return subtraction.id

        literal_percent = await named("foo%bar")
        await named("fooXbar")
        literal_underscore = await named("baz_qux")
        await named("bazYqux")
        literal_backslash = await named("qux\\end")
        await named("quxend")

        percent = await data_layer.subtractions.find(
            "foo%bar", False, False, _empty_query()
        )
        assert [d.id for d in percent.documents] == [literal_percent]

        underscore = await data_layer.subtractions.find(
            "baz_qux", False, False, _empty_query()
        )
        assert [d.id for d in underscore.documents] == [literal_underscore]

        backslash = await data_layer.subtractions.find(
            "qux\\end", False, False, _empty_query()
        )
        assert [d.id for d in backslash.documents] == [literal_backslash]

    async def test_ready_filter_with_search_term(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        """``ready=True`` and a search term compose; counts reflect each filter."""
        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )

        ready_match = await fake.subtractions.create(
            user=user, upload=upload, finalized=True
        )
        await data_layer.subtractions.update(
            ready_match.id,
            UpdateSubtractionRequest(name="Arabidopsis thaliana", nickname=""),
        )

        await fake.subtractions.create(user=user, upload=upload, finalized=True)

        not_ready_match = await fake.subtractions.create(
            user=user, upload=upload, finalized=False
        )
        await data_layer.subtractions.update(
            not_ready_match.id,
            UpdateSubtractionRequest(name="Arabidopsis other", nickname=""),
        )

        await fake.subtractions.create(user=user, upload=upload, finalized=False)

        result = await data_layer.subtractions.find(
            "arabidopsis", False, True, _empty_query()
        )

        assert [d.id for d in result.documents] == [ready_match.id]
        assert result.found_count == 1
        assert result.ready_count == 2
        assert result.total_count == 4


async def test_finalize(
    fake: DataFaker,
    mongo: Mongo,
    pg: AsyncEngine,
    snapshot_recent,
):
    """A finalized subtraction is dual-written to both Mongo and Postgres."""
    user = await fake.users.create()
    upload = await fake.uploads.create(
        user=user,
        upload_type=UploadType.subtraction,
        name="malus.fa.gz",
    )
    subtraction = await fake.subtractions.create(user=user, upload=upload)

    assert subtraction == snapshot_recent(name="obj")
    assert await mongo.subtraction.find_one() == snapshot_recent(name="mongo")

    async with AsyncSession(pg) as session:
        row = (await session.execute(select(SQLSubtraction))).scalar_one()

    assert row.to_dict() == snapshot_recent(name="pg")
    assert row.legacy_id == subtraction.id


class TestAddressByModernId:
    """Single-subtraction lookups resolve a modern integer id as well as the legacy
    string id. The response ``id`` field still emits the legacy string.
    """

    async def test_get(self, data_layer: DataLayer, fake: DataFaker, pg: AsyncEngine):
        """``get`` accepts the modern integer id and returns the legacy-shaped model."""
        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )
        subtraction = await fake.subtractions.create(user=user, upload=upload)

        by_modern = await data_layer.subtractions.get(
            await _modern_id(pg, subtraction.id)
        )

        assert by_modern == subtraction
        assert by_modern.id == subtraction.id

    async def test_update(
        self, data_layer: DataLayer, fake: DataFaker, mongo: Mongo, pg: AsyncEngine
    ):
        """``update`` by the modern id writes through to Mongo and Postgres."""
        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )
        subtraction = await fake.subtractions.create(user=user, upload=upload)

        updated = await data_layer.subtractions.update(
            await _modern_id(pg, subtraction.id),
            UpdateSubtractionRequest(name="Malus domestica", nickname="apple"),
        )

        assert updated.id == subtraction.id
        assert updated.name == "Malus domestica"

        mongo_document = await mongo.subtraction.find_one({"_id": subtraction.id})
        assert mongo_document["name"] == "Malus domestica"

    async def test_delete(
        self, data_layer: DataLayer, fake: DataFaker, mongo: Mongo, pg: AsyncEngine
    ):
        """``delete`` addressed by the modern id soft-deletes in both stores."""
        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )
        subtraction = await fake.subtractions.create(user=user, upload=upload)

        await data_layer.subtractions.delete(await _modern_id(pg, subtraction.id))

        result = await data_layer.subtractions.find(None, False, False, _empty_query())
        assert subtraction.id not in [d.id for d in result.documents]

        mongo_document = await mongo.subtraction.find_one({"_id": subtraction.id})
        assert mongo_document["deleted"] is True

        async with AsyncSession(pg) as session:
            deleted = await session.scalar(
                select(SQLSubtraction.deleted).where(
                    SQLSubtraction.legacy_id == subtraction.id,
                ),
            )
        assert deleted is True

    async def test_finalize(
        self, data_layer: DataLayer, fake: DataFaker, pg: AsyncEngine
    ):
        """``finalize`` addressed by the modern id marks the subtraction ready."""
        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )
        subtraction = await fake.subtractions.create(
            user=user, upload=upload, finalized=False
        )

        finalized = await data_layer.subtractions.finalize(
            await _modern_id(pg, subtraction.id),
            FinalizeSubtractionRequest(
                count=1,
                gc=NucleotideComposition(**dict.fromkeys("actgn", 0.2)),
            ),
        )

        assert finalized.id == subtraction.id
        assert finalized.ready is True

    async def test_get_file(
        self, data_layer: DataLayer, fake: DataFaker, pg: AsyncEngine
    ):
        """``get_file`` addressed by the modern id streams the same file."""
        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )
        subtraction = await fake.subtractions.create(user=user, upload=upload)

        _, size = await data_layer.subtractions.get_file(
            await _modern_id(pg, subtraction.id),
            "subtraction.1.bt2",
        )

        _, legacy_size = await data_layer.subtractions.get_file(
            subtraction.id,
            "subtraction.1.bt2",
        )

        assert size == legacy_size

    async def test_missing_modern_id(self, data_layer: DataLayer):
        """A modern id with no matching row raises ``ResourceNotFoundError``."""
        with pytest.raises(ResourceNotFoundError):
            await data_layer.subtractions.get(999999)

        with pytest.raises(ResourceNotFoundError):
            await data_layer.subtractions.delete(999999)
