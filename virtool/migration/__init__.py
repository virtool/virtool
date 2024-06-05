"""Manage revisions in Alembic and other Virtool data.

* Virtool revisions are performed on PostgreSQL MongoDB, OpenFGA, and data files.
* Alembic revisions are for PostgreSQL only.

When should you use Virtool revisions for Postgres? When you need to make mass changes
to the database involving multiple transactions. For example, migrating OTU data from
MongoDB to PostgreSQL.

In Virtool, Alembic and non-Alembic revisions are managed together. If your newest
revision is an Alembic revision, and you create a new one. It will directly depend on
the previous Alembic revision having been applied.

# Guidelines

## MongoDB Transactions

In MongoDB, transactions fail frequently. We should avoid them for all but the smallest
operations.

It is not possible to guarantee that the revision will be recorded as complete even if
the ``upgrade()`` method succeeds. In this case, the revision will be run again next
time the migration is run.

Only write revisions for MongoDB that can be run again without causing problems and can
be re-run in the case that a previous run did not complete. You can do this by taking
the following precautions.

1. If you are adding a field, only add it to documents that do not have it.
2. If you are **not** using a transaction with ``update_many``, manually check that the
   update was successful. The ``update_many`` operation is not atomic.

   See existing revisions for how to do this.

## File Operations

Revisions containing file operations musts be written with the assumption that they
will fail and have to be re-run.

"""

from virtool.migration.cls import MigrationContext, MigrationError

__all__ = [
    "MigrationContext",
    "MigrationError",
]
