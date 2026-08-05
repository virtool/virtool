"""Minting of object-storage keys."""

import uuid


def mint_storage_key(domain: str, parent_id: int) -> str:
    """Mint a fresh object-storage key for a file belonging to ``parent_id``.

    Keys are ``{domain}/{parent_id}/{uuid}``. The UUID leaf is what makes the key
    independent of anything in the database: the row that names the object
    records the key verbatim, so no read path ever recomposes it and no change to
    how keys are chosen can force objects to move.

    The ``parent_id`` segment groups an owning resource's objects for human
    inspection and has no meaning to any read path. Objects written before keys
    were recorded keep whatever prefix they were stored under, so keys are
    heterogeneous by design.
    """
    return f"{domain}/{parent_id}/{uuid.uuid4().hex}"


def mint_root_storage_key(domain: str) -> str:
    """Mint a fresh object-storage key for a resource that has no owner.

    Uploads are not files belonging to some other resource -- they are the
    resource -- so there is no parent id to group them under and the key is
    ``{domain}/{uuid}``.

    Minting without a parent id also means the key is available before the row
    exists, so the object can be written first and the row created afterwards.
    That keeps a database transaction from being held open for the length of the
    upload stream.
    """
    return f"{domain}/{uuid.uuid4().hex}"
