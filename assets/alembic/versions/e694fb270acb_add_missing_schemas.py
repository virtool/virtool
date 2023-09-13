"""Add missing schemas

Revision ID: e694fb270acb
Revises:
Create Date: 2023-07-12 22:45:51.965830+00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "e694fb270acb"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "index_files",
        sa.Column("id", sa.INTEGER(), autoincrement=True, nullable=False),
        sa.Column("name", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column("index", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column(
            "type",
            postgresql.ENUM("json", "fasta", "bowtie2", name="indextype"),
            autoincrement=False,
            nullable=True,
        ),
        sa.Column("size", sa.Integer(), autoincrement=False, nullable=True),
        sa.PrimaryKeyConstraint("id", name="index_files_pkey"),
        sa.UniqueConstraint("index", "name", name="index_files_index_name_key"),
    )
    op.create_table(
        "sample_artifacts",
        sa.Column("id", sa.INTEGER(), autoincrement=True, nullable=False),
        sa.Column("sample", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column("name", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column("name_on_disk", sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.Column("size", sa.Integer(), autoincrement=False, nullable=True),
        sa.Column(
            "type",
            postgresql.ENUM(
                "sam",
                "bam",
                "fasta",
                "fastq",
                "csv",
                "tsv",
                "json",
                name="artifacttype",
            ),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column(
            "uploaded_at", postgresql.TIMESTAMP(), autoincrement=False, nullable=True
        ),
        sa.PrimaryKeyConstraint("id", name="sample_artifacts_pkey"),
        sa.UniqueConstraint("sample", "name", name="sample_artifacts_sample_name_key"),
    )
    op.create_table(
        "instance_messages",
        sa.Column("id", sa.INTEGER(), autoincrement=True, nullable=False),
        sa.Column("active", sa.BOOLEAN(), autoincrement=False, nullable=True),
        sa.Column(
            "color",
            postgresql.ENUM(
                "red", "yellow", "blue", "purple", "orange", "grey", name="messagecolor"
            ),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column("message", sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.Column(
            "created_at", postgresql.TIMESTAMP(), autoincrement=False, nullable=True
        ),
        sa.Column(
            "updated_at", postgresql.TIMESTAMP(), autoincrement=False, nullable=True
        ),
        sa.Column("user", sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.PrimaryKeyConstraint("id", name="instance_messages_pkey"),
    )
    op.create_table(
        "analysis_files",
        sa.Column("id", sa.INTEGER(), autoincrement=True, nullable=False),
        sa.Column("analysis", sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.Column("description", sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.Column(
            "format",
            postgresql.ENUM(
                "sam",
                "bam",
                "fasta",
                "fastq",
                "csv",
                "tsv",
                "json",
                name="analysisformat",
            ),
            autoincrement=False,
            nullable=True,
        ),
        sa.Column("name", sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.Column("name_on_disk", sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.Column("size", sa.Integer(), autoincrement=False, nullable=True),
        sa.Column(
            "uploaded_at", postgresql.TIMESTAMP(), autoincrement=False, nullable=True
        ),
        sa.PrimaryKeyConstraint("id", name="analysis_files_pkey"),
        sa.UniqueConstraint("name_on_disk", name="analysis_files_name_on_disk_key"),
    )
    op.create_table(
        "tasks",
        sa.Column("id", sa.INTEGER(), autoincrement=True, nullable=False),
        sa.Column("complete", sa.BOOLEAN(), autoincrement=False, nullable=True),
        sa.Column(
            "context",
            postgresql.JSONB(astext_type=sa.Text()),
            autoincrement=False,
            nullable=True,
        ),
        sa.Column("count", sa.INTEGER(), autoincrement=False, nullable=True),
        sa.Column(
            "created_at", postgresql.TIMESTAMP(), autoincrement=False, nullable=False
        ),
        sa.Column("error", sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.Column("file_size", sa.BIGINT(), autoincrement=False, nullable=True),
        sa.Column("progress", sa.INTEGER(), autoincrement=False, nullable=True),
        sa.Column("step", sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.Column("type", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.PrimaryKeyConstraint("id", name="tasks_pkey"),
    )
    op.create_table(
        "nuvs_blast",
        sa.Column("id", sa.INTEGER(), autoincrement=True, nullable=False),
        sa.Column(
            "analysis_id", sa.VARCHAR(length=10), autoincrement=False, nullable=False
        ),
        sa.Column("sequence_index", sa.INTEGER(), autoincrement=False, nullable=False),
        sa.Column(
            "created_at", postgresql.TIMESTAMP(), autoincrement=False, nullable=False
        ),
        sa.Column(
            "updated_at", postgresql.TIMESTAMP(), autoincrement=False, nullable=False
        ),
        sa.Column(
            "last_checked_at",
            postgresql.TIMESTAMP(),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column("error", sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.Column("interval", sa.INTEGER(), autoincrement=False, nullable=True),
        sa.Column("rid", sa.VARCHAR(length=24), autoincrement=False, nullable=True),
        sa.Column("ready", sa.BOOLEAN(), autoincrement=False, nullable=False),
        sa.Column(
            "result",
            postgresql.JSON(astext_type=sa.Text()),
            autoincrement=False,
            nullable=True,
        ),
        sa.Column("task_id", sa.INTEGER(), autoincrement=False, nullable=True),
        sa.ForeignKeyConstraint(
            ["task_id"], ["tasks.id"], name="nuvs_blast_task_id_fkey"
        ),
        sa.PrimaryKeyConstraint("id", name="nuvs_blast_pkey"),
        sa.UniqueConstraint(
            "analysis_id",
            "sequence_index",
            name="nuvs_blast_analysis_id_sequence_index_key",
        ),
    )
    op.create_table(
        "sample_artifacts_cache",
        sa.Column("id", sa.INTEGER(), autoincrement=True, nullable=False),
        sa.Column("key", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column("name", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column("name_on_disk", sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.Column("sample", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column("size", sa.Integer(), autoincrement=False, nullable=True),
        sa.Column(
            "type",
            postgresql.ENUM(
                "sam",
                "bam",
                "fasta",
                "fastq",
                "csv",
                "tsv",
                "json",
                name="artifacttype",
            ),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column(
            "uploaded_at", postgresql.TIMESTAMP(), autoincrement=False, nullable=True
        ),
        sa.PrimaryKeyConstraint("id", name="sample_artifacts_cache_pkey"),
        sa.UniqueConstraint(
            "key", "name", "sample", name="sample_artifacts_cache_key_name_sample_key"
        ),
    )
    op.create_table(
        "subtraction_files",
        sa.Column("id", sa.INTEGER(), autoincrement=True, nullable=False),
        sa.Column("name", sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.Column("subtraction", sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.Column(
            "type",
            postgresql.ENUM("fasta", "bowtie2", name="subtractiontype"),
            autoincrement=False,
            nullable=True,
        ),
        sa.Column("size", sa.Integer(), autoincrement=False, nullable=True),
        sa.PrimaryKeyConstraint("id", name="subtraction_files_pkey"),
        sa.UniqueConstraint(
            "subtraction", "name", name="subtraction_files_subtraction_name_key"
        ),
    )
    op.create_table(
        "uploads",
        sa.Column(
            "id",
            sa.INTEGER(),
            autoincrement=True,
            nullable=False,
        ),
        sa.Column(
            "created_at", postgresql.TIMESTAMP(), autoincrement=False, nullable=True
        ),
        sa.Column("name", sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.Column("name_on_disk", sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.Column("ready", sa.BOOLEAN(), autoincrement=False, nullable=False),
        sa.Column("removed", sa.BOOLEAN(), autoincrement=False, nullable=False),
        sa.Column(
            "removed_at", postgresql.TIMESTAMP(), autoincrement=False, nullable=True
        ),
        sa.Column("reserved", sa.BOOLEAN(), autoincrement=False, nullable=False),
        sa.Column("size", sa.BIGINT(), autoincrement=False, nullable=True),
        sa.Column(
            "type",
            postgresql.ENUM(
                "hmm", "reference", "reads", "subtraction", name="uploadtype"
            ),
            autoincrement=False,
            nullable=True,
        ),
        sa.Column("user", sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.Column(
            "uploaded_at", postgresql.TIMESTAMP(), autoincrement=False, nullable=True
        ),
        sa.PrimaryKeyConstraint("id", name="uploads_pkey"),
        sa.UniqueConstraint("name_on_disk", name="uploads_name_on_disk_key"),
    )
    op.create_table(
        "sample_reads_cache",
        sa.Column("id", sa.INTEGER(), autoincrement=True, nullable=False),
        sa.Column("key", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column("name", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column("name_on_disk", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column("sample", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column("size", sa.Integer(), autoincrement=False, nullable=True),
        sa.Column(
            "uploaded_at", postgresql.TIMESTAMP(), autoincrement=False, nullable=True
        ),
        sa.PrimaryKeyConstraint("id", name="sample_reads_cache_pkey"),
    )
    op.create_table(
        "labels",
        sa.Column("id", sa.INTEGER(), autoincrement=True, nullable=False),
        sa.Column("name", sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.Column("color", sa.VARCHAR(length=7), autoincrement=False, nullable=True),
        sa.Column("description", sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.PrimaryKeyConstraint("id", name="labels_pkey"),
        sa.UniqueConstraint("name", name="labels_name_key"),
    )
    op.create_table(
        "sample_reads",
        sa.Column("id", sa.INTEGER(), autoincrement=True, nullable=False),
        sa.Column("sample", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column("name", sa.VARCHAR(length=13), autoincrement=False, nullable=False),
        sa.Column("name_on_disk", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column("size", sa.Integer(), autoincrement=False, nullable=True),
        sa.Column("upload", sa.INTEGER(), autoincrement=False, nullable=True),
        sa.Column(
            "uploaded_at", postgresql.TIMESTAMP(), autoincrement=False, nullable=True
        ),
        sa.ForeignKeyConstraint(
            ["upload"], ["uploads.id"], name="sample_reads_upload_fkey"
        ),
        sa.PrimaryKeyConstraint("id", name="sample_reads_pkey"),
        sa.UniqueConstraint("sample", "name", name="sample_reads_sample_name_key"),
    )


def _downgrade() -> None:
    op.drop_table("sample_reads")
    op.drop_table("labels")
    op.drop_table("sample_reads_cache")
    op.drop_table("groups")
    op.drop_table("uploads")
    op.drop_table("subtraction_files")
    op.drop_table("sample_artifacts_cache")
    op.drop_table("tasks")
    op.drop_table("nuvs_blast")
    op.drop_table("analysis_files")
    op.drop_table("instance_messages")
    op.drop_table("sample_artifacts")
    op.drop_table("index_files")
