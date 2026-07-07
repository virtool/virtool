"""add legacy_samples job_id unique constraint

Enforce that at most one sample references a given job through
``legacy_samples.job_id``. A ``create_sample`` job produces exactly one sample,
so the reverse lookup from a job to its sample is 1:1. This mirrors the
``UNIQUE`` constraint on ``subtractions.job_id`` and lets ``job_samples`` be
retired in favour of the reverse foreign key (VIR-2530).

``job_id`` is nullable and Postgres treats NULLs as distinct, so samples with no
job are unaffected.

Revision ID: df76f45e6f0e
Revises: 91b32f49a8b2
Create Date: 2026-07-07 21:43:49.599692+00:00

"""

from alembic import op

revision = "df76f45e6f0e"
down_revision = "91b32f49a8b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint(
        "legacy_samples_job_id_key",
        "legacy_samples",
        ["job_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "legacy_samples_job_id_key",
        "legacy_samples",
        type_="unique",
    )
