import arrow
import pytest

from virtool.migration.cls import GenericRevision, RevisionSource
from virtool.migration.show import order_revisions


class TestOrderRevisions:
    def test(self):
        """
        Test that an unordered list of revisions with interspersed Alembic and Virtool
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
        """
        Test that an error is raised if there are multiple root revisions.
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
        """
        Test that an error is raised if the root revision is not an Alembic revision.
        """
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
