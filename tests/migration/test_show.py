import arrow
import pytest

from virtool.migration.cls import GenericRevision, RevisionSource
from virtool.migration.show import (
    load_alembic_revisions,
    load_all_revisions,
    load_virtool_revisions,
    order_revisions,
)


class TestOrderRevisions:
    def test(self):
        """Test that an unordered list of revisions with interspersed Alembic and Virtool
        revisions is ordered correctly.
        """
        revisions = [
            GenericRevision(
                alembic_downgrade="rev_1",
                created_at=arrow.get("2021-01-02T00:00:00").naive,
                id="rev_2",
                name="Rev 2",
                source=RevisionSource.VIRTOOL,
                upgrade=None,
                virtool_downgrade=None,
            ),
            GenericRevision(
                alembic_downgrade=None,
                created_at=arrow.get("2021-01-03T00:00:00").naive,
                id="rev_3",
                name="Rev 3",
                source=RevisionSource.VIRTOOL,
                upgrade=None,
                virtool_downgrade="rev_2",
            ),
            GenericRevision(
                # Since this is an Alembic downgrade, its `alembic_downgrade` field points
                # to the last Alembic revision.
                alembic_downgrade="rev_1",
                created_at=arrow.get("2021-01-04T00:00:00").naive,
                id="rev_4",
                name="Rev 4",
                source=RevisionSource.ALEMBIC,
                upgrade=None,
                virtool_downgrade=None,
            ),
            # This is the root revision.
            GenericRevision(
                alembic_downgrade=None,
                created_at=arrow.get("2021-01-01T00:00:00").naive,
                id="rev_1",
                name="Rev 1",
                source=RevisionSource.ALEMBIC,
                upgrade=None,
                virtool_downgrade=None,
            ),
            GenericRevision(
                alembic_downgrade="rev_4",
                created_at=arrow.get("2021-01-05T00:00:00").naive,
                id="rev_5",
                name="Rev 5",
                source=RevisionSource.VIRTOOL,
                upgrade=None,
                virtool_downgrade=None,
            ),
        ]

        assert order_revisions(revisions) == [
            revisions[3],
            revisions[0],
            revisions[1],
            revisions[2],
            revisions[4],
        ]

    def test_no_root(self):
        revisions = [
            GenericRevision(
                alembic_downgrade="rev_1",
                created_at=arrow.get("2021-01-02T00:00:00").naive,
                id="rev_2",
                name="Rev 2",
                source=RevisionSource.VIRTOOL,
                upgrade=None,
                virtool_downgrade=None,
            ),
            GenericRevision(
                alembic_downgrade=None,
                created_at=arrow.get("2021-01-03T00:00:00").naive,
                id="rev_3",
                name="Rev 3",
                source=RevisionSource.VIRTOOL,
                upgrade=None,
                virtool_downgrade="rev_2",
            ),
            GenericRevision(
                # Since this is an Alembic downgrade, its `alembic_downgrade` field points
                # to the last Alembic revision.
                alembic_downgrade="rev_1",
                created_at=arrow.get("2021-01-04T00:00:00").naive,
                id="rev_4",
                name="Rev 4",
                source=RevisionSource.ALEMBIC,
                upgrade=None,
                virtool_downgrade=None,
            ),
        ]

        with pytest.raises(ValueError, match="No root revision found."):
            order_revisions(revisions)

    def test_multiple_roots(self):
        """Test that an error is raised if there are multiple root revisions."""
        revisions = [
            GenericRevision(
                alembic_downgrade="rev_1",
                created_at=arrow.get("2021-01-02T00:00:00").naive,
                id="rev_2",
                name="Rev 2",
                source=RevisionSource.VIRTOOL,
                upgrade=None,
                virtool_downgrade=None,
            ),
            GenericRevision(
                alembic_downgrade=None,
                created_at=arrow.get("2021-01-03T00:00:00").naive,
                id="rev_3",
                name="Rev 3",
                source=RevisionSource.VIRTOOL,
                upgrade=None,
                virtool_downgrade="rev_2",
            ),
            GenericRevision(
                # Since this is an Alembic downgrade, its `alembic_downgrade` field points
                # to the last Alembic revision.
                alembic_downgrade="rev_1",
                created_at=arrow.get("2021-01-04T00:00:00").naive,
                id="rev_4",
                name="Rev 4",
                source=RevisionSource.ALEMBIC,
                upgrade=None,
                virtool_downgrade=None,
            ),
            # This is the root revision.
            GenericRevision(
                alembic_downgrade=None,
                created_at=arrow.get("2021-01-01T00:00:00").naive,
                id="rev_1",
                name="Rev 1",
                source=RevisionSource.ALEMBIC,
                upgrade=None,
                virtool_downgrade=None,
            ),
            # This is another root revision.
            GenericRevision(
                alembic_downgrade=None,
                created_at=arrow.get("2021-01-05T00:00:00").naive,
                id="rev_5",
                name="Rev 5",
                source=RevisionSource.ALEMBIC,
                upgrade=None,
                virtool_downgrade=None,
            ),
        ]

        with pytest.raises(ValueError, match="Multiple root revisions found."):
            order_revisions(revisions)

    def test_non_alembic_root(self):
        """Test that an error is raised if the root revision is not an Alembic revision."""
        revisions = [
            GenericRevision(
                alembic_downgrade=None,
                created_at=arrow.get("2021-01-02T00:00:00").naive,
                id="rev_1",
                name="Rev 1",
                source=RevisionSource.VIRTOOL,
                upgrade=None,
                virtool_downgrade=None,
            ),
            GenericRevision(
                alembic_downgrade=None,
                created_at=arrow.get("2021-01-03T00:00:00").naive,
                id="rev_2",
                name="Rev 2",
                source=RevisionSource.VIRTOOL,
                upgrade=None,
                virtool_downgrade="rev_1",
            ),
        ]

        with pytest.raises(
            ValueError, match="Root revision is not an Alembic revision."
        ):
            order_revisions(revisions)

    def test_alembic_fork(self):
        """Test that an error is raised when two Alembic revisions share a downgrade."""
        revisions = [
            GenericRevision(
                alembic_downgrade=None,
                created_at=arrow.get("2021-01-01T00:00:00").naive,
                id="root",
                name="Root",
                source=RevisionSource.ALEMBIC,
                upgrade=None,
                virtool_downgrade=None,
            ),
            GenericRevision(
                alembic_downgrade="root",
                created_at=arrow.get("2021-01-02T00:00:00").naive,
                id="branch_a",
                name="Branch A",
                source=RevisionSource.ALEMBIC,
                upgrade=None,
                virtool_downgrade=None,
            ),
            GenericRevision(
                alembic_downgrade="root",
                created_at=arrow.get("2021-01-03T00:00:00").naive,
                id="branch_b",
                name="Branch B",
                source=RevisionSource.ALEMBIC,
                upgrade=None,
                virtool_downgrade=None,
            ),
        ]

        with pytest.raises(
            ValueError,
            match="Revisions branch_a and branch_b both downgrade to root.",
        ):
            order_revisions(revisions)

    def test_virtool_fork(self):
        """Test that an error is raised when two Virtool revisions share a downgrade."""
        revisions = [
            GenericRevision(
                alembic_downgrade=None,
                created_at=arrow.get("2021-01-01T00:00:00").naive,
                id="root",
                name="Root",
                source=RevisionSource.ALEMBIC,
                upgrade=None,
                virtool_downgrade=None,
            ),
            GenericRevision(
                alembic_downgrade="root",
                created_at=arrow.get("2021-01-02T00:00:00").naive,
                id="trunk",
                name="Trunk",
                source=RevisionSource.VIRTOOL,
                upgrade=None,
                virtool_downgrade=None,
            ),
            GenericRevision(
                alembic_downgrade=None,
                created_at=arrow.get("2021-01-03T00:00:00").naive,
                id="branch_a",
                name="Branch A",
                source=RevisionSource.VIRTOOL,
                upgrade=None,
                virtool_downgrade="trunk",
            ),
            GenericRevision(
                alembic_downgrade=None,
                created_at=arrow.get("2021-01-04T00:00:00").naive,
                id="branch_b",
                name="Branch B",
                source=RevisionSource.VIRTOOL,
                upgrade=None,
                virtool_downgrade="trunk",
            ),
        ]

        with pytest.raises(
            ValueError,
            match="Revisions branch_a and branch_b both downgrade to trunk.",
        ):
            order_revisions(revisions)

    def test_orphaned(self):
        """Test that an error is raised when a revision cannot be reached from the root.

        The orphans form a valid chain of their own, but it hangs off a revision that
        is not in the loaded set.
        """
        revisions = [
            GenericRevision(
                alembic_downgrade=None,
                created_at=arrow.get("2021-01-01T00:00:00").naive,
                id="root",
                name="Root",
                source=RevisionSource.ALEMBIC,
                upgrade=None,
                virtool_downgrade=None,
            ),
            GenericRevision(
                alembic_downgrade="root",
                created_at=arrow.get("2021-01-02T00:00:00").naive,
                id="reachable",
                name="Reachable",
                source=RevisionSource.ALEMBIC,
                upgrade=None,
                virtool_downgrade=None,
            ),
            GenericRevision(
                alembic_downgrade="missing",
                created_at=arrow.get("2021-01-03T00:00:00").naive,
                id="orphan_a",
                name="Orphan A",
                source=RevisionSource.ALEMBIC,
                upgrade=None,
                virtool_downgrade=None,
            ),
            GenericRevision(
                alembic_downgrade="orphan_a",
                created_at=arrow.get("2021-01-04T00:00:00").naive,
                id="orphan_b",
                name="Orphan B",
                source=RevisionSource.ALEMBIC,
                upgrade=None,
                virtool_downgrade=None,
            ),
        ]

        with pytest.raises(
            ValueError,
            match="Revisions could not be reached from the root: orphan_a, orphan_b.",
        ):
            order_revisions(revisions)

    def test_duplicate_ids(self):
        """Test that an error is raised when two revisions share an id.

        Such a chain orders cleanly, but `apply` records applied revisions by id and
        would silently skip the second as already applied.
        """
        revisions = [
            GenericRevision(
                alembic_downgrade=None,
                created_at=arrow.get("2021-01-01T00:00:00").naive,
                id="root",
                name="Root",
                source=RevisionSource.ALEMBIC,
                upgrade=None,
                virtool_downgrade=None,
            ),
            GenericRevision(
                alembic_downgrade="root",
                created_at=arrow.get("2021-01-02T00:00:00").naive,
                id="copied",
                name="Copied",
                source=RevisionSource.ALEMBIC,
                upgrade=None,
                virtool_downgrade=None,
            ),
            GenericRevision(
                alembic_downgrade="copied",
                created_at=arrow.get("2021-01-03T00:00:00").naive,
                id="copied",
                name="Copied Again",
                source=RevisionSource.ALEMBIC,
                upgrade=None,
                virtool_downgrade=None,
            ),
        ]

        with pytest.raises(ValueError, match="Revision ids are not unique: copied."):
            order_revisions(revisions)


class TestLoadAllRevisions:
    def test_chain_is_intact(self):
        """Test that every revision in the repository is ordered exactly once.

        This fails if a revision is added that forks the chain or that cannot be
        reached from the root.
        """
        loaded = [*load_alembic_revisions(), *load_virtool_revisions()]

        ordered_ids = [revision.id for revision in load_all_revisions()]

        assert sorted(ordered_ids) == sorted(revision.id for revision in loaded)
        assert len(ordered_ids) == len(set(ordered_ids))
