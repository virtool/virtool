import pytest
from multidict import MultiDict, MultiDictProxy
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.errors import ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.subtractions.oas import (
    FinalizeSubtractionRequest,
    NucleotideComposition,
    UpdateSubtractionRequest,
)
from virtool.subtractions.pg import SQLSubtraction
from virtool.uploads.sql import SQLUpload, UploadType


def _empty_query() -> MultiDictProxy:
    return MultiDictProxy(MultiDict())


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
    pg: AsyncEngine,
    snapshot_recent,
):
    """A finalized subtraction is persisted to Postgres with no legacy id."""
    user = await fake.users.create()
    upload = await fake.uploads.create(
        user=user,
        upload_type=UploadType.subtraction,
        name="malus.fa.gz",
    )
    subtraction = await fake.subtractions.create(user=user, upload=upload)

    assert subtraction == snapshot_recent(name="obj")

    async with AsyncSession(pg) as session:
        row = (
            await session.execute(
                select(SQLSubtraction).where(SQLSubtraction.id == subtraction.id),
            )
        ).scalar_one()

    assert row.to_dict() == snapshot_recent(name="pg")
    assert row.legacy_id is None


class TestMutations:
    """Single-subtraction mutations addressed by the integer id, persisted to
    Postgres only.
    """

    async def test_get(self, data_layer: DataLayer, fake: DataFaker):
        """``get`` returns the subtraction addressed by its integer id."""
        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )
        subtraction = await fake.subtractions.create(user=user, upload=upload)

        assert await data_layer.subtractions.get(subtraction.id) == subtraction
        assert isinstance(subtraction.id, int)

    async def test_update(
        self, data_layer: DataLayer, fake: DataFaker, pg: AsyncEngine
    ):
        """``update`` persists the new name to Postgres."""
        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )
        subtraction = await fake.subtractions.create(user=user, upload=upload)

        updated = await data_layer.subtractions.update(
            subtraction.id,
            UpdateSubtractionRequest(name="Malus domestica", nickname="apple"),
        )

        assert updated.id == subtraction.id
        assert updated.name == "Malus domestica"

        async with AsyncSession(pg) as session:
            name = await session.scalar(
                select(SQLSubtraction.name).where(SQLSubtraction.id == subtraction.id),
            )
        assert name == "Malus domestica"

    async def test_delete(
        self, data_layer: DataLayer, fake: DataFaker, pg: AsyncEngine
    ):
        """``delete`` soft-deletes the subtraction in Postgres."""
        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )
        subtraction = await fake.subtractions.create(user=user, upload=upload)

        await data_layer.subtractions.delete(subtraction.id)

        result = await data_layer.subtractions.find(None, False, False, _empty_query())
        assert subtraction.id not in [d.id for d in result.documents]

        async with AsyncSession(pg) as session:
            deleted = await session.scalar(
                select(SQLSubtraction.deleted).where(
                    SQLSubtraction.id == subtraction.id,
                ),
            )
        assert deleted is True

    async def test_finalize(self, data_layer: DataLayer, fake: DataFaker):
        """``finalize`` marks the subtraction ready."""
        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user,
            upload_type=UploadType.subtraction,
        )
        subtraction = await fake.subtractions.create(
            user=user, upload=upload, finalized=False
        )

        finalized = await data_layer.subtractions.finalize(
            subtraction.id,
            FinalizeSubtractionRequest(
                count=1,
                gc=NucleotideComposition(**dict.fromkeys("actgn", 0.2)),
            ),
        )

        assert finalized.id == subtraction.id
        assert finalized.ready is True

    async def test_missing_id(self, data_layer: DataLayer):
        """An integer id with no matching row raises ``ResourceNotFoundError``."""
        with pytest.raises(ResourceNotFoundError):
            await data_layer.subtractions.get(999999)

        with pytest.raises(ResourceNotFoundError):
            await data_layer.subtractions.delete(999999)
