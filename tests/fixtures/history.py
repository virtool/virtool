from copy import deepcopy

import pytest
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

import virtool.history.db
from virtool.models.enums import HistoryMethod
from virtool.otus.db import (
    join_legacy_otu_in_session,
    lock_legacy_otu,
    update_legacy_otu_verification,
    write_legacy_otu,
)
from virtool.otus.oas import CreateOTURequest
from virtool.otus.sql import SQLOTU, SQLSequence
from virtool.otus.utils import find_isolate, format_isolate_name, split


@pytest.fixture
def test_otu_edit():
    """An :class:`tuple` containing old and new otu documents for testing history diffing."""
    return (
        {
            "_id": "6116cba1",
            "abbreviation": "PVF",
            "imported": True,
            "isolates": [
                {
                    "default": True,
                    "isolate_id": "cab8b360",
                    "sequences": [
                        {
                            "_id": "KX269872",
                            "definition": "Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene, complete "
                            "cds.",
                            "host": "sweet cherry",
                            "isolate_id": "cab8b360",
                            "sequence": "TGTTTAAGAGATTAAACAACCGCTTTC",
                            "segment": None,
                        }
                    ],
                    "source_name": "8816-v2",
                    "source_type": "isolate",
                }
            ],
            "reference": {"id": "hxn167"},
            "last_indexed_version": 0,
            "lower_name": "prunus virus f",
            "name": "Prunus virus F",
            "schema": [],
            "version": 0,
        },
        {
            "_id": "6116cba1",
            "abbreviation": "",
            "imported": True,
            "isolates": [
                {
                    "default": True,
                    "isolate_id": "cab8b360",
                    "sequences": [
                        {
                            "_id": "KX269872",
                            "definition": "Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene, complete "
                            "cds.",
                            "host": "sweet cherry",
                            "isolate_id": "cab8b360",
                            "sequence": "TGTTTAAGAGATTAAACAACCGCTTTC",
                            "segment": None,
                        }
                    ],
                    "source_name": "8816-v2",
                    "source_type": "isolate",
                }
            ],
            "reference": {"id": "hxn167"},
            "last_indexed_version": 0,
            "lower_name": "prunus virus f",
            "name": "Prunus virus E",
            "schema": [],
            "version": 1,
        },
    )


async def _rename_otu(pg, otu_id: str, name: str, user_id: int) -> None:
    """Rename an OTU and record the ``edit`` change.

    Nothing in Virtool edits an OTU from Python any more, so there is no data layer
    method to drive. The write is composed here from the same primitives the dropped
    one used, so the ``legacy_history`` row and its diff keep the shape
    :func:`virtool.history.db.patch_to_version` has to revert: an ``edit`` whose diff
    holds ``change`` operations on scalar fields.
    """
    async with AsyncSession(pg) as session:
        await lock_legacy_otu(session, otu_id)

        old = await join_legacy_otu_in_session(session, otu_id)
        old_document, _ = split(old)

        new_document = {
            **old_document,
            "name": name,
            "lower_name": name.lower(),
            "verified": False,
            "version": old_document["version"] + 1,
        }

        await write_legacy_otu(session, new_document)

        new = await join_legacy_otu_in_session(session, otu_id)

        await update_legacy_otu_verification(session, new)

        await virtool.history.db.add(
            session,
            f"Changed name to {name}",
            HistoryMethod.edit,
            old,
            new,
            user_id,
        )

        await session.commit()


async def _remove_isolate(pg, otu_id: str, isolate_id: str, user_id: int) -> None:
    """Remove an isolate from an OTU and record the ``remove_isolate`` change.

    Composed here for the same reason as :func:`_rename_otu`. The diff holds a
    ``remove`` operation on the ``isolates`` list, which reverts by re-inserting the
    element at its old index.
    """
    async with AsyncSession(pg) as session:
        await lock_legacy_otu(session, otu_id)

        old = await join_legacy_otu_in_session(session, otu_id)
        old_document, _ = split(old)

        isolates = deepcopy(old_document["isolates"])
        isolate_to_remove = find_isolate(isolates, isolate_id)
        isolates.remove(isolate_to_remove)

        new_default = None

        if isolate_to_remove["default"] and isolates:
            new_default = isolates[0]
            new_default["default"] = True

        await write_legacy_otu(
            session,
            {
                **old_document,
                "isolates": isolates,
                "verified": False,
                "version": old_document["version"] + 1,
            },
        )

        await session.execute(
            delete(SQLSequence).where(
                SQLSequence.otu_id == otu_id,
                SQLSequence.isolate_id == isolate_id,
            ),
        )

        new = await join_legacy_otu_in_session(session, otu_id)

        await update_legacy_otu_verification(session, new)

        description = f"Removed {format_isolate_name(isolate_to_remove)}"

        if isolate_to_remove["default"] and new_default:
            description += f" and set {format_isolate_name(new_default)} as default"

        await virtool.history.db.add(
            session,
            description,
            HistoryMethod.remove_isolate,
            old,
            new,
            user_id,
        )

        await session.commit()


async def _remove_otu(pg, otu_id: str, user_id: int) -> None:
    """Delete an OTU and record the ``remove`` change.

    Composed here for the same reason as :func:`_rename_otu`. This is the only way to
    reach a ``"removed"`` sentinel change, and the only way to leave an OTU with
    history but no live row -- the state
    :func:`virtool.history.db.patch_to_version` falls back to the history row for the
    parent reference id in.
    """
    async with AsyncSession(pg) as session:
        joined = await join_legacy_otu_in_session(session, otu_id)

        await session.execute(delete(SQLOTU).where(SQLOTU.id == otu_id))

        await virtool.history.db.add(
            session,
            f"Removed {joined['name']}",
            HistoryMethod.remove,
            joined,
            None,
            user_id,
        )

        await session.commit()


@pytest.fixture
def build_otu_history(data_layer, fake, pg):
    """Build a multi-version OTU history.

    The OTU passes through five versions:

    * ``0`` -- created
    * ``1`` -- an isolate added
    * ``2`` -- a sequence added to the isolate
    * ``3`` -- renamed
    * ``4`` -- the isolate removed
    * ``removed`` -- the OTU removed (only when ``remove`` is ``True``)

    Versions 0 through 2 come from the OTU data layer. The last three are composed from
    the write primitives the dropped data layer methods used, because Virtool no longer
    edits or removes OTUs from Python. Each still writes its change through
    :func:`virtool.history.db.add`, so the stored diffs carry the operation types
    :func:`virtool.history.db.patch_to_version` has to revert -- which is the point of
    building history this deep.

    Returns the id of the OTU the mutations created so callers address it rather than a
    hand-picked literal id.
    """

    async def func(remove: bool) -> str:
        user = await fake.users.create()
        reference = await fake.references.create(user=user)

        otu = await data_layer.otus.create(
            reference.id,
            CreateOTURequest(name="Prunus virus F", abbreviation="PVF"),
            user.id,
        )

        isolate = await data_layer.otus.add_isolate(
            otu.id,
            "isolate",
            "8816-v2",
            user.id,
        )

        await data_layer.otus.create_sequence(
            otu.id,
            isolate.id,
            "KX269872",
            "Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene",
            "TGTTTAAGAGATTAAACAACCGCTTTC",
            user.id,
            host="sweet cherry",
        )

        await _rename_otu(pg, otu.id, "Test Virus", user.id)
        await _remove_isolate(pg, otu.id, isolate.id, user.id)

        if remove:
            await _remove_otu(pg, otu.id, user.id)

        return otu.id

    return func
