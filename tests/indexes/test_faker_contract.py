"""Contract tests for ``DataFaker.indexes``.

The shape the domain emits is pinned by the ``test_upload`` snapshot in
``tests/indexes/test_api.py``. These cover the defaults no call site exercises.
"""

from virtool.fake.next import DataFaker


async def test_version_autoincrement_is_per_reference(fake: DataFaker):
    """Versions increment independently for each reference, built or not."""
    user = await fake.users.create()
    ref_a = await fake.references.create(user=user)
    ref_b = await fake.references.create(user=user)

    a = [await fake.indexes.create(ref_a, user) for _ in range(3)]
    b = [await fake.indexes.create(ref_b, user, ready=True) for _ in range(2)]

    assert [i.version for i in a] == [0, 1, 2]
    assert [i.version for i in b] == [0, 1]
    assert len({i.id for i in a + b}) == 5


async def test_manifest_defaults_to_reference_otus(fake: DataFaker):
    """An omitted manifest captures the reference's OTUs at their current versions."""
    user = await fake.users.create()
    reference = await fake.references.create(user=user)
    otu = await fake.otus.create(reference.id, user)

    index = await fake.indexes.create(reference, user)

    assert index.manifest == {otu.id: otu.version}
