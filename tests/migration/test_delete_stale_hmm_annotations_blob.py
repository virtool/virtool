"""Tests for the ``delete stale hmm annotations blob`` migration."""

import pytest

from assets.revisions.rev_8kt397kdecbe_delete_stale_hmm_annotations_blob import upgrade
from virtool.hmm.data import HMM_ANNOTATIONS_KEY
from virtool.migration.ctx import MigrationContext
from virtool.storage.errors import StorageKeyNotFoundError


async def test_deletes_cached_annotations(ctx: MigrationContext):
    """The cached annotations blob is removed so it regenerates from Postgres."""

    async def _stale():
        yield b'[{"id": "p9gtlz0d", "cluster": 10}]'

    await ctx.storage.write(HMM_ANNOTATIONS_KEY, _stale())

    await upgrade(ctx)

    with pytest.raises(StorageKeyNotFoundError):
        await ctx.storage.size(HMM_ANNOTATIONS_KEY)
