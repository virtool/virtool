"""The data layer domain for OTUs."""

import asyncio
from collections.abc import Awaitable, Callable
from copy import deepcopy

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.history.db
import virtool.otus.db
import virtool.otus.utils
from virtool.data.errors import (
    ResourceConflictError,
    ResourceError,
    ResourceNotFoundError,
)
from virtool.data.topg import resolve_legacy_id
from virtool.data.transforms import apply_transforms
from virtool.history.utils import (
    compose_create_description,
)
from virtool.identifier import AbstractIdProvider
from virtool.models.enums import HistoryMethod
from virtool.otus.db import (
    get_legacy_otu_reference_id,
    increment_legacy_otu_version,
    insert_legacy_otu,
    insert_legacy_sequence,
    join_legacy_otu_in_session,
    legacy_otu_id_taken,
    legacy_sequence_id_taken,
    lock_legacy_otu,
    update_legacy_otu_verification,
    write_legacy_otu,
)
from virtool.otus.models import OTU, OTUIsolate, OTUSequence
from virtool.otus.oas import CreateOTURequest
from virtool.otus.utils import (
    find_isolate,
    format_isolate_name,
    format_sequence,
    split,
)
from virtool.references.db import check_source_type
from virtool.references.sql import SQLReference
from virtool.references.transforms import AttachReferenceTransform
from virtool.users.transforms import AttachUserTransform


class OTUData:
    """The data layer domain for OTUs."""

    name = "otus"

    def __init__(self, pg: AsyncEngine, id_provider: AbstractIdProvider) -> None:
        self._pg = pg
        self._id_provider = id_provider

    async def _generate_id(
        self,
        pg_session: AsyncSession,
        taken: Callable[[AsyncSession, str], Awaitable[bool]],
    ) -> str:
        """Generate an id no ``legacy_otus`` or ``legacy_sequences`` row holds yet.

        The create paths need the id before the row is written, so it cannot come from
        ``Collection.insert_one`` inventing one. This replaces the collision check that
        ran inside it, asking Postgres what it used to ask Mongo.

        The generators do collide. ``FakeIdProvider`` replays one seeded sequence, so a
        test that seeds a document under an id the provider later reaches gets a
        collision every run rather than never, and ``RandomIdProvider`` draws an
        8-character string that has some chance of landing on a taken one.

        The check races a concurrent create that picks the same id in the same instant,
        which the insert-only writes it feeds turn into an ``IntegrityError`` rather
        than a clobbered row. That was already the outcome -- Mongo's unique ``_id``
        index raised on the same race before it left the write path.
        """
        while True:
            id_ = self._id_provider.get()

            if not await taken(pg_session, id_):
                return id_

    async def get(self, otu_id: str) -> OTU:
        """Get a single OTU by ID.

        :param otu_id: the ID of the OTU to get
        :return: the OTU
        """
        document = await virtool.otus.db.join_and_format(self._pg, otu_id)

        if document is None:
            raise ResourceNotFoundError

        document, most_recent_change = await asyncio.gather(
            apply_transforms(
                document,
                [AttachReferenceTransform(self._pg)],
                self._pg,
            ),
            virtool.history.db.get_most_recent_change(
                self._pg,
                otu_id,
            ),
        )

        return OTU(
            **{
                **document,
                "most_recent_change": await apply_transforms(
                    most_recent_change,
                    [AttachUserTransform(self._pg)],
                    self._pg,
                ),
            },
        )

    async def create(self, ref_id: str, data: CreateOTURequest, user_id: int) -> OTU:
        """Create an OTU and it's first history record.

        :param ref_id: the ID of the parent reference
        :param data: an OTU creation request
        :param user_id: the ID of the creating user
        :return: the OTU
        """
        async with AsyncSession(self._pg) as session:
            reference_pk = await resolve_legacy_id(session, SQLReference, ref_id)

        if reference_pk is None:
            raise ResourceNotFoundError("Reference does not exist")

        async with AsyncSession(self._pg) as session:
            document = {
                "_id": await self._generate_id(session, legacy_otu_id_taken),
                "name": data.name,
                "abbreviation": data.abbreviation,
                "last_indexed_version": None,
                "verified": False,
                "lower_name": data.name.lower(),
                "isolates": [],
                "version": 0,
                "reference": {"id": reference_pk},
                "schema": data.dict()["otu_schema"],
            }

            await insert_legacy_otu(session, document)

            await virtool.history.db.add(
                session,
                compose_create_description(document),
                HistoryMethod.create,
                None,
                document,
                user_id,
            )

            await session.commit()

        return await self.get(document["_id"])

    async def _check_source_type(self, otu_id: str, source_type: str) -> None:
        """Ensure ``source_type`` is allowed by the OTU's parent reference.

        :param otu_id: the id of the OTU the isolate belongs to
        :param source_type: the lowercased source type
        :raises ResourceNotFoundError: the OTU does not exist
        :raises ResourceConflictError: the reference does not allow the source type
        """
        reference_id = await get_legacy_otu_reference_id(self._pg, otu_id)

        if reference_id is None:
            raise ResourceNotFoundError

        if not await check_source_type(self._pg, reference_id, source_type):
            raise ResourceConflictError("Source type is not allowed")

    async def add_isolate(
        self,
        otu_id: str,
        source_type: str,
        source_name: str,
        user_id: int,
        default: bool = False,
    ) -> OTUIsolate:
        source_type = source_type.lower()

        await self._check_source_type(otu_id, source_type)

        async with AsyncSession(self._pg) as session:
            await lock_legacy_otu(session, otu_id)

            old = await join_legacy_otu_in_session(session, otu_id)

            old_document, _ = split(old)

            isolates = deepcopy(old_document["isolates"])

            # True if the new isolate should be default and any existing isolates should
            # be non-default.
            will_be_default = not isolates or default

            # Set ``default`` to ``False`` for all existing isolates if the new one
            # should be default.
            if will_be_default:
                for isolate_ in isolates:
                    isolate_["default"] = False

            existing_isolate_ids = {i["id"] for i in isolates}

            while True:
                new_isolate_id = self._id_provider.get()

                if new_isolate_id not in existing_isolate_ids:
                    break

            isolate_ = {
                "id": new_isolate_id,
                "default": will_be_default,
                "source_type": source_type,
                "source_name": source_name,
            }

            new_document = {
                **old_document,
                "isolates": [*isolates, isolate_],
                "verified": False,
                "version": old_document["version"] + 1,
            }

            await write_legacy_otu(session, new_document)

            new = await join_legacy_otu_in_session(session, otu_id)

            await update_legacy_otu_verification(session, new)

            description = f"Added {format_isolate_name(isolate_)}"

            if will_be_default:
                description += " as default"

            await virtool.history.db.add(
                session,
                description,
                HistoryMethod.add_isolate,
                old,
                new,
                user_id,
            )

            await session.commit()

        return OTUIsolate(**{**isolate_, "sequences": []})

    async def create_sequence(
        self,
        otu_id: str,
        isolate_id: str,
        accession: str,
        definition: str,
        sequence: str,
        user_id: int,
        host: str = "",
        segment: str | None = None,
        sequence_id: str | None = None,
    ) -> OTUSequence:
        """Create a sequence on an isolate.

        :raises ResourceError: the segment is not defined in the parent OTU's schema
        """
        if message := await virtool.otus.db.check_sequence_segment(
            self._pg,
            otu_id,
            {"segment": segment},
        ):
            raise ResourceError(message)

        async with AsyncSession(self._pg) as session:
            await lock_legacy_otu(session, otu_id)

            old = await join_legacy_otu_in_session(session, otu_id)

            document = {
                "_id": sequence_id
                or await self._generate_id(session, legacy_sequence_id_taken),
                "accession": accession,
                "definition": definition,
                "otu_id": otu_id,
                "isolate_id": isolate_id,
                "host": host,
                "reference": {"id": old["reference"]["id"]},
                "segment": segment,
                "sequence": sequence.replace(" ", "").replace("\n", ""),
            }

            await increment_legacy_otu_version(session, otu_id)

            await insert_legacy_sequence(session, document)

            new = await join_legacy_otu_in_session(session, otu_id)

            await update_legacy_otu_verification(session, new)

            isolate_name = format_isolate_name(
                find_isolate(old["isolates"], isolate_id),
            )

            await virtool.history.db.add(
                session,
                f"Created new sequence {accession} in {isolate_name}",
                HistoryMethod.create_sequence,
                old,
                new,
                user_id,
            )

            await session.commit()

        return OTUSequence(**format_sequence(document))
