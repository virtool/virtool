"""relax indexes job-or-task constraint

Widen ``ck_indexes_job_or_task`` from ``num_nonnulls(job_id, task_id) = 1`` to
``<= 1`` so a legacy job-backed index whose job was deleted before the jobs
migration can be copied with neither a ``job_id`` nor a ``task_id``. Jobs are
historically deletable, so an old completed build can outlive its job.

This must run before the index backfill (``9ws3adnisz85``), which is why that
revision downgrades to this one.

Revision ID: aaac048795ba
Revises: 6ffca63a8b95
Create Date: 2026-07-17 19:54:04.995207+00:00

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "aaac048795ba"
down_revision = "6ffca63a8b95"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_indexes_job_or_task", "indexes", type_="check")
    op.create_check_constraint(
        "ck_indexes_job_or_task",
        "indexes",
        "num_nonnulls(job_id, task_id) <= 1",
    )


def downgrade() -> None:
    # Restoring the stricter ``= 1`` constraint fails by design if any index carries
    # neither a job nor a task -- the deleted-job rows this revision exists to admit.
    # Postgres rejects the constraint against violating data, so a downgrade past
    # this point requires resolving those rows by hand first rather than silently
    # dropping the invariant.
    op.drop_constraint("ck_indexes_job_or_task", "indexes", type_="check")
    op.create_check_constraint(
        "ck_indexes_job_or_task",
        "indexes",
        "num_nonnulls(job_id, task_id) = 1",
    )
