import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.topg import compose_legacy_id_multi_mongo_match
from virtool.groups.pg import SQLGroup
from virtool.users.utils import generate_base_permissions


class TestComposeLegacyIdMultiMongoMatch:
    @pytest.fixture
    async def groups(self, pg: AsyncEngine) -> dict[str, int]:
        async with AsyncSession(pg) as session:
            rows = [
                SQLGroup(
                    legacy_id="group_a_legacy",
                    name="A",
                    permissions=generate_base_permissions(),
                ),
                SQLGroup(
                    legacy_id="group_b_legacy",
                    name="B",
                    permissions=generate_base_permissions(),
                ),
            ]
            session.add_all(rows)
            await session.flush()
            ids = {row.legacy_id: row.id for row in rows}
            await session.commit()

        return ids

    async def test_covers_both_forms(self, pg: AsyncEngine, groups: dict[str, int]):
        """Each matched row contributes both its legacy string and integer id."""
        match = await compose_legacy_id_multi_mongo_match(
            pg, SQLGroup, ["group_a_legacy", "group_b_legacy"]
        )

        assert set(match["$in"]) == {
            "group_a_legacy",
            "group_b_legacy",
            groups["group_a_legacy"],
            groups["group_b_legacy"],
        }

    async def test_integer_input_resolves_legacy(
        self, pg: AsyncEngine, groups: dict[str, int]
    ):
        """An integer input resolves to its legacy string so mixed-form documents
        still match.
        """
        match = await compose_legacy_id_multi_mongo_match(
            pg, SQLGroup, [groups["group_a_legacy"]]
        )

        assert set(match["$in"]) == {groups["group_a_legacy"], "group_a_legacy"}

    async def test_unresolved_id_passes_through(
        self, pg: AsyncEngine, groups: dict[str, int]
    ):
        """An id with no matching row is kept so nothing is silently dropped."""
        match = await compose_legacy_id_multi_mongo_match(
            pg, SQLGroup, ["group_a_legacy", "ghost"]
        )

        assert "ghost" in match["$in"]
        assert groups["group_a_legacy"] in match["$in"]

    async def test_empty_matches_nothing(self, pg: AsyncEngine):
        """An empty id list yields an empty ``$in`` without querying Postgres."""
        assert await compose_legacy_id_multi_mongo_match(pg, SQLGroup, []) == {
            "$in": []
        }
