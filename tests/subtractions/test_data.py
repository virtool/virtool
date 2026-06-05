from multidict import MultiDict, MultiDictProxy
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.mongo.core import Mongo
from virtool.subtractions.oas import UpdateSubtractionRequest
from virtool.subtractions.pg import SQLSubtraction
from virtool.uploads.sql import UploadType


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
