from pathlib import Path
from typing import NamedTuple
from unittest.mock import ANY, AsyncMock

import pytest
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion
from syrupy.filters import props

from tests.fixtures.analysis import seed_analysis
from tests.fixtures.samples import create_rights_sample
from virtool.analyses.sql import (
    SQLAnalysis,
    SQLAnalysisFile,
    SQLAnalysisSubtraction,
)
from virtool.api.client import JobClient, UserClient
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker, fake_file_chunker
from virtool.models.enums import AnalysisWorkflow
from virtool.models.roles import AdministratorRole
from virtool.mongo.core import Mongo
from virtool.pg.utils import get_row, get_row_by_id
from virtool.samples.oas import CreateAnalysisRequest
from virtool.subtractions.pg import SQLSubtraction
from virtool.users.models import User
from virtool.utils import timestamp


@pytest.fixture
async def subtraction_ids(fake: DataFaker) -> dict[str, int]:
    """Seed two subtractions and return their ``{name slug: integer id}`` map."""
    user = await fake.users.create()
    upload = await fake.uploads.create(user=user)
    first = await fake.subtractions.create(
        user=user,
        upload=upload,
        name="Subtraction 1",
        upload_files=False,
        finalized=False,
    )
    second = await fake.subtractions.create(
        user=user,
        upload=upload,
        name="Subtraction 2",
        upload_files=False,
        finalized=False,
    )
    return {"subtraction_1": first.id, "subtraction_2": second.id}


def build_user_client(user) -> UserClient:
    """Build a ``UserClient`` authenticated as ``user``."""
    return UserClient(
        administrator_role=user.administrator_role,
        authenticated=True,
        force_reset=False,
        groups=[group.id for group in user.groups],
        permissions=user.permissions.dict(),
        user_id=user.id,
    )


class SampleSetup(NamedTuple):
    """Identifiers for the sample and reference seeded by ``setup_sample``."""

    sample_id: int
    user: User
    reference_id: int
    client: UserClient

    @property
    def user_id(self) -> int:
        return self.user.id


@pytest.fixture
async def setup_sample(
    mongo: "Mongo",
    data_layer: DataLayer,
    fake: DataFaker,
    subtraction_ids: dict[str, int],
) -> SampleSetup:
    """Seed a finalized sample the owning user can read and write, and a reference with
    a ready index to analyse it against.
    """
    user = await fake.users.create()
    reference = await fake.references.create(user=user, name="Test Reference")

    sample = await fake.samples.create(user, ready=True)

    await data_layer.samples.update_rights(
        sample.id,
        {"all_read": True, "all_write": True},
    )

    await mongo.indexes.insert_one(
        {
            "_id": "test_index",
            "version": 11,
            "ready": True,
            "reference": {"id": reference.id},
        },
    )

    return SampleSetup(
        sample_id=sample.id,
        user=user,
        reference_id=reference.id,
        client=build_user_client(user),
    )


@pytest.mark.parametrize("number_of_analyses", [0, 1, 2])
async def test_find(
    number_of_analyses: int,
    data_layer: DataLayer,
    fake: DataFaker,
    snapshot_recent: SnapshotAssertion,
    setup_sample: SampleSetup,
    subtraction_ids: dict[str, int],
):
    """Tests that all analysis are listed."""
    client = setup_sample.client
    user_id = setup_sample.user_id

    other_sample = await fake.samples.create(setup_sample.user, ready=True)

    analysis_wrong_sample = await data_layer.analyses.create(
        CreateAnalysisRequest(
            ref_id=setup_sample.reference_id,
            subtractions=[
                subtraction_ids["subtraction_1"],
                subtraction_ids["subtraction_2"],
            ],
            workflow=AnalysisWorkflow.nuvs,
        ),
        other_sample.id,
        user_id,
    )

    for _ in range(number_of_analyses):
        await data_layer.analyses.create(
            CreateAnalysisRequest(
                ref_id=setup_sample.reference_id,
                subtractions=[
                    subtraction_ids["subtraction_1"],
                    subtraction_ids["subtraction_2"],
                ],
                workflow=AnalysisWorkflow.nuvs,
            ),
            setup_sample.sample_id,
            user_id,
        )

    analyses_found = await data_layer.analyses.find(
        1,
        25,
        client,
        setup_sample.sample_id,
    )

    assert analyses_found.dict() == snapshot_recent()
    assert analysis_wrong_sample not in analyses_found
    assert analyses_found.total_count == analyses_found.found_count


class TestFindSampleRights:
    """The analysis list is scoped to samples the requesting client can read."""

    @staticmethod
    async def _seed_analysis(
        mongo: Mongo,
        pg: AsyncEngine,
        legacy_id: str,
        sample_id: int,
        setup: SampleSetup,
    ) -> int:
        return await seed_analysis(
            mongo,
            pg,
            {
                "_id": legacy_id,
                "workflow": "pathoscope",
                "created_at": timestamp(),
                "ready": True,
                "job": None,
                "index": {"id": "test_index", "version": 11},
                "user": {"id": setup.user_id},
                "sample": {"id": sample_id},
                "reference": {"id": setup.reference_id},
                "results": {"hits": []},
                "subtractions": [],
            },
        )

    async def test_private_sample_of_other_user_hidden(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        setup_sample: SampleSetup,
    ):
        """An analysis on another user's private sample is absent from the documents
        and from ``total_count``.
        """
        other_user = await fake.users.create()

        other_private = await create_rights_sample(
            data_layer,
            fake,
            other_user,
            all_read=False,
        )

        await self._seed_analysis(mongo, pg, "hidden", other_private.id, setup_sample)

        owned = await self._seed_analysis(
            mongo,
            pg,
            "visible",
            setup_sample.sample_id,
            setup_sample,
        )

        found = await data_layer.analyses.find(1, 25, setup_sample.client)

        assert [document.id for document in found.documents] == [owned]
        assert found.total_count == 1
        assert found.found_count == 1

    async def test_group_readable_sample_visible(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        setup_sample: SampleSetup,
    ):
        """An analysis on another user's sample is listed when the client belongs to a
        group the sample is readable by.
        """
        group = await fake.groups.create()
        sample_owner = await fake.users.create()
        group_member = await fake.users.create(groups=[group])

        group_readable = await create_rights_sample(
            data_layer,
            fake,
            sample_owner,
            all_read=False,
            group_read=True,
            group=group.id,
        )

        shared = await self._seed_analysis(
            mongo,
            pg,
            "shared",
            group_readable.id,
            setup_sample,
        )

        found = await data_layer.analyses.find(
            1,
            25,
            build_user_client(group_member),
        )

        assert [document.id for document in found.documents] == [shared]

    async def test_private_sample_hidden_from_non_member(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        setup_sample: SampleSetup,
    ):
        """A group-readable sample stays hidden from a user outside the group."""
        group = await fake.groups.create()
        sample_owner = await fake.users.create()
        outsider = await fake.users.create()

        group_readable = await create_rights_sample(
            data_layer,
            fake,
            sample_owner,
            all_read=False,
            group_read=True,
            group=group.id,
        )

        await self._seed_analysis(mongo, pg, "shared", group_readable.id, setup_sample)

        found = await data_layer.analyses.find(1, 25, build_user_client(outsider))

        assert found.documents == []
        assert found.total_count == 0

    async def test_full_administrator_sees_private_sample(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        setup_sample: SampleSetup,
    ):
        """A full administrator lists analyses on another user's private sample,
        matching the single-resource bypass in ``has_sample_right``.
        """
        sample_owner = await fake.users.create()
        administrator = await fake.users.create(
            administrator_role=AdministratorRole.FULL,
        )

        other_private = await create_rights_sample(
            data_layer,
            fake,
            sample_owner,
            all_read=False,
        )

        hidden = await self._seed_analysis(
            mongo,
            pg,
            "private",
            other_private.id,
            setup_sample,
        )

        found = await data_layer.analyses.find(
            1,
            25,
            build_user_client(administrator),
        )

        assert [document.id for document in found.documents] == [hidden]
        assert found.total_count == 1

    async def test_base_administrator_scoped_like_user(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        setup_sample: SampleSetup,
    ):
        """An administrator below the full role is scoped like any other user and does
        not see another user's private sample.
        """
        sample_owner = await fake.users.create()
        administrator = await fake.users.create(
            administrator_role=AdministratorRole.BASE,
        )

        other_private = await create_rights_sample(
            data_layer,
            fake,
            sample_owner,
            all_read=False,
        )

        await self._seed_analysis(mongo, pg, "private", other_private.id, setup_sample)

        found = await data_layer.analyses.find(
            1,
            25,
            build_user_client(administrator),
        )

        assert found.documents == []
        assert found.total_count == 0


class TestHasRight:
    """Rights on an analysis are resolved from the parent sample's Postgres row."""

    @staticmethod
    async def _seed_analysis(
        mongo: Mongo,
        pg: AsyncEngine,
        legacy_id: str,
        sample_id: int,
        owner_id: int,
        reference_id: str,
    ) -> int:
        return await seed_analysis(
            mongo,
            pg,
            {
                "_id": legacy_id,
                "workflow": "pathoscope",
                "created_at": timestamp(),
                "ready": True,
                "job": None,
                "index": {"id": "test_index", "version": 11},
                "user": {"id": owner_id},
                "sample": {"id": sample_id},
                "reference": {"id": reference_id},
                "results": {"hits": []},
                "subtractions": [],
            },
        )

    async def test_owner_has_read_and_write(
        self,
        data_layer: DataLayer,
        mongo: Mongo,
        pg: AsyncEngine,
        setup_sample: SampleSetup,
    ):
        """The owner of the parent sample holds both rights on its analyses."""
        await self._seed_analysis(
            mongo,
            pg,
            "owned",
            setup_sample.sample_id,
            setup_sample.user_id,
            setup_sample.reference_id,
        )

        assert await data_layer.analyses.has_right(
            "owned",
            setup_sample.client,
            "read",
        )
        assert await data_layer.analyses.has_right(
            "owned",
            setup_sample.client,
            "write",
        )

    async def test_full_administrator_has_write(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        setup_sample: SampleSetup,
    ):
        """A full administrator holds both rights on another user's private sample."""
        sample_owner = await fake.users.create()
        administrator = await fake.users.create(
            administrator_role=AdministratorRole.FULL,
        )

        owner_private = await create_rights_sample(
            data_layer,
            fake,
            sample_owner,
            all_read=False,
        )

        await self._seed_analysis(
            mongo,
            pg,
            "private",
            owner_private.id,
            sample_owner.id,
            setup_sample.reference_id,
        )

        assert await data_layer.analyses.has_right(
            "private",
            build_user_client(administrator),
            "write",
        )

    async def test_base_administrator_denied(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        setup_sample: SampleSetup,
    ):
        """An administrator below the full role is scoped like any other user, matching
        how ``SamplesData.has_right`` treats the parent sample.
        """
        sample_owner = await fake.users.create()
        administrator = await fake.users.create(
            administrator_role=AdministratorRole.BASE,
        )

        owner_private = await create_rights_sample(
            data_layer,
            fake,
            sample_owner,
            all_read=False,
        )

        await self._seed_analysis(
            mongo,
            pg,
            "private",
            owner_private.id,
            sample_owner.id,
            setup_sample.reference_id,
        )

        assert not await data_layer.analyses.has_right(
            "private",
            build_user_client(administrator),
            "read",
        )

    async def test_all_read_grants_read_not_write(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        setup_sample: SampleSetup,
    ):
        """A world-readable sample grants read but withholds write."""
        sample_owner = await fake.users.create()
        other_user = await fake.users.create()

        world_readable = await create_rights_sample(
            data_layer,
            fake,
            sample_owner,
            all_read=True,
            all_write=False,
        )

        await self._seed_analysis(
            mongo,
            pg,
            "public",
            world_readable.id,
            sample_owner.id,
            setup_sample.reference_id,
        )

        client = build_user_client(other_user)

        assert await data_layer.analyses.has_right("public", client, "read")
        assert not await data_layer.analyses.has_right("public", client, "write")

    async def test_group_member_has_group_rights(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        setup_sample: SampleSetup,
    ):
        """A member of the sample's group holds the rights the group is granted."""
        group = await fake.groups.create()
        sample_owner = await fake.users.create()
        group_member = await fake.users.create(groups=[group])

        group_shared = await create_rights_sample(
            data_layer,
            fake,
            sample_owner,
            all_read=False,
            all_write=False,
            group_read=True,
            group_write=True,
            group=group.id,
        )

        await self._seed_analysis(
            mongo,
            pg,
            "shared",
            group_shared.id,
            sample_owner.id,
            setup_sample.reference_id,
        )

        client = build_user_client(group_member)

        assert await data_layer.analyses.has_right("shared", client, "read")
        assert await data_layer.analyses.has_right("shared", client, "write")

    async def test_non_member_denied(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        setup_sample: SampleSetup,
    ):
        """A user outside the sample's group holds neither right."""
        group = await fake.groups.create()
        sample_owner = await fake.users.create()
        outsider = await fake.users.create()

        group_shared = await create_rights_sample(
            data_layer,
            fake,
            sample_owner,
            all_read=False,
            group_read=True,
            group=group.id,
        )

        await self._seed_analysis(
            mongo,
            pg,
            "shared",
            group_shared.id,
            sample_owner.id,
            setup_sample.reference_id,
        )

        client = build_user_client(outsider)

        assert not await data_layer.analyses.has_right("shared", client, "read")
        assert not await data_layer.analyses.has_right("shared", client, "write")

    async def test_job_client_has_full_access(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        setup_sample: SampleSetup,
    ):
        """A job-authenticated client holds both rights on another user's private
        sample, since a job's identity is neither a user nor an administrator.
        """
        sample_owner = await fake.users.create()

        owner_private = await create_rights_sample(
            data_layer,
            fake,
            sample_owner,
            all_read=False,
            all_write=False,
        )

        await self._seed_analysis(
            mongo,
            pg,
            "private",
            owner_private.id,
            sample_owner.id,
            setup_sample.reference_id,
        )

        client = JobClient(job_id=1)

        assert await data_layer.analyses.has_right("private", client, "read")
        assert await data_layer.analyses.has_right("private", client, "write")

    async def test_missing_analysis_raises(
        self,
        data_layer: DataLayer,
        setup_sample: SampleSetup,
    ):
        """An analysis that does not exist raises ``ResourceNotFoundError`` so the API
        can return a 404 rather than a 403.
        """
        with pytest.raises(ResourceNotFoundError):
            await data_layer.analyses.has_right(
                "missing",
                setup_sample.client,
                "read",
            )


async def test_create(
    data_layer: DataLayer,
    snapshot: SnapshotAssertion,
    setup_sample: SampleSetup,
    subtraction_ids: dict[str, int],
):
    """Tests that an analysis is created with the expected fields."""
    user_id: str = setup_sample.user_id

    analysis = await data_layer.analyses.create(
        CreateAnalysisRequest(
            ref_id=setup_sample.reference_id,
            subtractions=[
                subtraction_ids["subtraction_1"],
                subtraction_ids["subtraction_2"],
            ],
            workflow=AnalysisWorkflow.nuvs,
        ),
        setup_sample.sample_id,
        user_id,
    )

    assert analysis == snapshot(name="obj", exclude=props("created_at", "updated_at"))


def _create_request(
    subtraction_ids: dict[str, int],
    ref_id: str,
) -> CreateAnalysisRequest:
    return CreateAnalysisRequest(
        ref_id=ref_id,
        subtractions=[
            subtraction_ids["subtraction_1"],
            subtraction_ids["subtraction_2"],
        ],
        workflow=AnalysisWorkflow.nuvs,
    )


class TestCreate:
    """Creating an analysis writes a Postgres row."""

    async def test_writes_pg_row(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
        setup_sample: SampleSetup,
        subtraction_ids: dict[str, int],
    ):
        """The Postgres row reflects the creation request."""
        analysis = await data_layer.analyses.create(
            _create_request(subtraction_ids, setup_sample.reference_id),
            setup_sample.sample_id,
            setup_sample.user_id,
        )

        row = await get_row(pg, SQLAnalysis, ("id", analysis.id))

        assert row is not None
        assert row.id == analysis.id
        assert row.legacy_id is None
        assert row.workflow == "nuvs"
        assert row.ready is False
        assert row.results is None
        assert row.sample == str(setup_sample.sample_id)
        assert row.reference == str(setup_sample.reference_id)
        assert row.reference_id == setup_sample.reference_id
        assert row.created_at == row.updated_at
        assert isinstance(row.user_id, int)

        async with AsyncSession(pg) as session:
            linked = (
                (
                    await session.execute(
                        select(SQLSubtraction.id)
                        .join(
                            SQLAnalysisSubtraction,
                            SQLAnalysisSubtraction.subtraction_id == SQLSubtraction.id,
                        )
                        .where(SQLAnalysisSubtraction.analysis_id == analysis.id),
                    )
                )
                .scalars()
                .all()
            )

        assert sorted(linked) == sorted(
            [subtraction_ids["subtraction_1"], subtraction_ids["subtraction_2"]],
        )

    async def test_links_job_with_integer_analysis_id(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
        setup_sample: SampleSetup,
        subtraction_ids: dict[str, int],
    ):
        """The analysis is linked to a job whose ``analysis_id`` argument is the
        analysis's integer id, resolved through the ``analyses.job_id`` foreign key.
        """
        analysis = await data_layer.analyses.create(
            _create_request(subtraction_ids, setup_sample.reference_id),
            setup_sample.sample_id,
            setup_sample.user_id,
        )

        row = await get_row(pg, SQLAnalysis, ("id", analysis.id))

        assert row is not None
        assert row.job_id is not None

        job = await data_layer.jobs.get(row.job_id)

        assert job.args["analysis_id"] == analysis.id
        assert isinstance(job.args["analysis_id"], int)

    async def test_subtractions_default_to_list(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
        setup_sample: SampleSetup,
    ):
        """An analysis created without subtractions links no subtraction rows."""
        analysis = await data_layer.analyses.create(
            CreateAnalysisRequest(
                ref_id=setup_sample.reference_id,
                workflow=AnalysisWorkflow.nuvs,
            ),
            setup_sample.sample_id,
            setup_sample.user_id,
        )

        async with AsyncSession(pg) as session:
            linked = (
                (
                    await session.execute(
                        select(SQLAnalysisSubtraction).where(
                            SQLAnalysisSubtraction.analysis_id == analysis.id,
                        ),
                    )
                )
                .scalars()
                .all()
            )

        assert linked == []

    async def test_unknown_subtraction_raises(
        self,
        data_layer: DataLayer,
        setup_sample: SampleSetup,
        subtraction_ids: dict[str, int],
    ):
        """Creating an analysis with an unresolvable subtraction is a conflict."""
        with pytest.raises(ResourceConflictError, match="905"):
            await data_layer.analyses.create(
                CreateAnalysisRequest(
                    ref_id=setup_sample.reference_id,
                    subtractions=[subtraction_ids["subtraction_1"], 905],
                    workflow=AnalysisWorkflow.nuvs,
                ),
                setup_sample.sample_id,
                setup_sample.user_id,
            )

    async def test_unknown_sample_raises(
        self,
        data_layer: DataLayer,
        setup_sample: SampleSetup,
        subtraction_ids: dict[str, int],
    ):
        """Creating an analysis for a sample with no ``legacy_samples`` row is a
        conflict.
        """
        with pytest.raises(ResourceConflictError, match="Sample does not exist"):
            await data_layer.analyses.create(
                _create_request(subtraction_ids, setup_sample.reference_id),
                "unknown_sample",
                setup_sample.user_id,
            )

    async def test_unknown_reference_raises(
        self,
        data_layer: DataLayer,
        setup_sample: SampleSetup,
        subtraction_ids: dict[str, int],
    ):
        """Creating an analysis for a reference with no ``legacy_references`` row is a
        conflict.
        """
        with pytest.raises(ResourceConflictError, match="Reference does not exist"):
            await data_layer.analyses.create(
                CreateAnalysisRequest(
                    ref_id="unknown_ref",
                    subtractions=[
                        subtraction_ids["subtraction_1"],
                        subtraction_ids["subtraction_2"],
                    ],
                    workflow=AnalysisWorkflow.nuvs,
                ),
                setup_sample.sample_id,
                setup_sample.user_id,
            )

    async def test_rolls_back_when_pg_write_fails(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
        setup_sample: SampleSetup,
        subtraction_ids: dict[str, int],
        mocker,
    ):
        """A failure writing the Postgres row leaves no analysis behind."""
        mocker.patch(
            "virtool.analyses.data.insert",
            side_effect=RuntimeError("boom"),
        )

        with pytest.raises(RuntimeError):
            await data_layer.analyses.create(
                _create_request(subtraction_ids, setup_sample.reference_id),
                setup_sample.sample_id,
                setup_sample.user_id,
            )

        async with AsyncSession(pg) as session:
            result = await session.execute(select(SQLAnalysis))
            assert result.scalars().first() is None


class TestFinalize:
    """Finalizing an analysis writes results and the ready flag to Postgres."""

    async def test_writes_results(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
        setup_sample: SampleSetup,
        subtraction_ids: dict[str, int],
        mocker,
    ):
        """Finalize marks the Postgres row ready and stores the results."""
        m_format_analysis = mocker.patch(
            "virtool.analyses.format.format_analysis",
            side_effect=lambda _pg, *, results, **_: results,
        )

        analysis = await data_layer.analyses.create(
            _create_request(subtraction_ids, setup_sample.reference_id),
            setup_sample.sample_id,
            setup_sample.user_id,
        )

        created = await get_row(pg, SQLAnalysis, ("id", analysis.id))

        results = {"hits": [{"index": 0, "sequence": "ACGT"}]}

        await data_layer.analyses.finalize(analysis.id, results)

        row = await get_row(pg, SQLAnalysis, ("id", analysis.id))

        assert row.ready is True
        assert row.results == results
        assert row.updated_at > created.updated_at

        # The PostgreSQL engine must be threaded through to format_analysis so it can
        # resolve Postgres-stored history diffs.
        m_format_analysis.assert_called_with(
            pg,
            workflow=ANY,
            results=ANY,
        )


class TestDelete:
    """Deleting an analysis removes its Postgres row."""

    async def test_deletes_pg_row(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
        setup_sample: SampleSetup,
        subtraction_ids: dict[str, int],
    ):
        """Delete removes the Postgres row."""
        analysis = await data_layer.analyses.create(
            _create_request(subtraction_ids, setup_sample.reference_id),
            setup_sample.sample_id,
            setup_sample.user_id,
        )

        await data_layer.analyses.delete(analysis.id, jobs_api_flag=True)

        assert await get_row(pg, SQLAnalysis, ("id", analysis.id)) is None

    async def test_native_analysis_skips_storage_cleanup(
        self,
        data_layer: DataLayer,
        mocker,
        setup_sample: SampleSetup,
        subtraction_ids: dict[str, int],
    ):
        """A Postgres-native analysis has a NULL legacy id, so no slug-prefixed
        storage objects exist to clean up.
        """
        delete_prefix = mocker.patch(
            "virtool.analyses.data.delete_prefix",
            new=AsyncMock(return_value=[]),
        )

        analysis = await data_layer.analyses.create(
            _create_request(subtraction_ids, setup_sample.reference_id),
            setup_sample.sample_id,
            setup_sample.user_id,
        )

        await data_layer.analyses.delete(analysis.id, jobs_api_flag=True)

        delete_prefix.assert_not_awaited()

    async def test_legacy_analysis_cleans_storage(
        self,
        data_layer: DataLayer,
        mocker,
        pg: AsyncEngine,
        setup_sample: SampleSetup,
        subtraction_ids: dict[str, int],
    ):
        """A Mongo-migrated analysis still removes its slug-prefixed storage objects."""
        delete_prefix = mocker.patch(
            "virtool.analyses.data.delete_prefix",
            new=AsyncMock(return_value=[]),
        )

        analysis = await data_layer.analyses.create(
            _create_request(subtraction_ids, setup_sample.reference_id),
            setup_sample.sample_id,
            setup_sample.user_id,
        )

        async with AsyncSession(pg) as session:
            await session.execute(
                update(SQLAnalysis)
                .where(SQLAnalysis.id == analysis.id)
                .values(legacy_id="oldslug"),
            )
            await session.commit()

        await data_layer.analyses.delete(analysis.id, jobs_api_flag=True)

        delete_prefix.assert_awaited_once()
        assert (
            delete_prefix.await_args.args[1]
            == f"samples/{setup_sample.sample_id}/analysis/oldslug/"
        )


async def test_get_without_if_modified_since(
    data_layer: DataLayer,
    setup_sample: SampleSetup,
    subtraction_ids: dict[str, int],
):
    """Test that an analysis can be fetched without an HTTP cache validator."""
    analysis = await data_layer.analyses.create(
        CreateAnalysisRequest(
            ref_id=setup_sample.reference_id,
            subtractions=[
                subtraction_ids["subtraction_1"],
                subtraction_ids["subtraction_2"],
            ],
            workflow=AnalysisWorkflow.nuvs,
        ),
        setup_sample.sample_id,
        setup_sample.user_id,
    )

    fetched = await data_layer.analyses.get(analysis.id)

    assert fetched.id == analysis.id


async def test_upload_file(
    data_layer: DataLayer,
    example_path: Path,
    setup_sample: SampleSetup,
    subtraction_ids: dict[str, int],
    snapshot_recent: SnapshotAssertion,
    spawn_job_client,
    tmp_path,
):
    """Test that an analysis result file is properly uploaded and a row is inserted into
    the `analysis_files` SQL table.
    """
    user_id = setup_sample.user_id

    analysis = await data_layer.analyses.create(
        CreateAnalysisRequest(
            ref_id=setup_sample.reference_id,
            subtractions=[
                subtraction_ids["subtraction_1"],
                subtraction_ids["subtraction_2"],
            ],
            workflow=AnalysisWorkflow.nuvs,
        ),
        setup_sample.sample_id,
        user_id,
    )

    chunks = fake_file_chunker(example_path / "sample" / "reads_1.fq.gz")

    analysis_file = await data_layer.analyses.upload_file(
        chunks,
        analysis.id,
        "fasta",
        "test",
    )

    assert analysis_file == snapshot_recent()
    assert await get_row_by_id(data_layer.analyses._pg, SQLAnalysisFile, 1)
