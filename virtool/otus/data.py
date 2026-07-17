"""The data layer domain for OTUs."""

import asyncio
from collections import defaultdict
from collections.abc import Awaitable, Callable
from copy import deepcopy
from typing import Any

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
    compose_edit_description,
    compose_remove_description,
)
from virtool.models.enums import HistoryMethod
from virtool.mongo.core import Mongo
from virtool.otus.db import (
    delete_legacy_isolate_sequences,
    delete_legacy_otu,
    delete_legacy_sequence,
    get_legacy_otu_fields,
    get_legacy_otu_reference_id,
    get_legacy_sequence,
    get_legacy_sequence_body,
    get_legacy_sequence_in_session,
    increment_legacy_otu_version,
    insert_legacy_otu,
    insert_legacy_sequence,
    join_legacy_otu_in_session,
    legacy_isolate_exists,
    legacy_otu_id_taken,
    legacy_sequence_exists,
    legacy_sequence_id_taken,
    list_legacy_isolate_sequence_bodies,
    list_legacy_isolate_sequences,
    list_legacy_otu_sequence_bodies,
    lock_legacy_otu,
    update_legacy_otu_verification,
    update_legacy_sequence_segments,
    write_legacy_otu,
    write_legacy_sequence,
)
from virtool.otus.models import OTU, OTUIsolate, OTUSequence, Sequence
from virtool.otus.oas import CreateOTURequest, UpdateOTURequest, UpdateSequenceRequest
from virtool.otus.utils import (
    evaluate_changes,
    find_isolate,
    format_fasta_entry,
    format_fasta_filename,
    format_isolate_name,
    split,
    strip_sequence_references,
)
from virtool.references.db import check_source_type
from virtool.references.sql import SQLReference
from virtool.references.transforms import AttachReferenceTransform
from virtool.types import Document
from virtool.users.transforms import AttachUserTransform
from virtool.utils import base_processor


class OTUData:
    """The data layer domain for OTUs."""

    name = "otus"

    def __init__(self, mongo: Mongo, pg: AsyncEngine) -> None:
        self._mongo = mongo
        self._pg = pg

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
            id_ = self._mongo.id_provider.get()

            if not await taken(pg_session, id_):
                return id_

    async def find(
        self, page: int, per_page: int, term: str | None, verified: bool | None
    ) -> dict[str, Any] | list[dict | None]:
        """Find OTUs matching the given query."""
        return await virtool.otus.db.find(self._pg, term, page, per_page, verified)

    async def get_reference_id(
        self,
        otu_id: str,
        isolate_id: str | None = None,
    ) -> int:
        """Get the id of the reference an OTU belongs to.

        Backs the authorization checks on the OTU handlers, which need the parent
        reference to resolve a right but nothing else about the OTU. The handler owns
        the resulting decision.

        Passing ``isolate_id`` additionally requires the OTU to carry that isolate, so a
        handler addressing an isolate gets its existence check from the same read.

        :param otu_id: the ID of the OTU
        :param isolate_id: the ID of an isolate the OTU must carry
        :return: the ID of the parent reference
        :raises ResourceNotFoundError: the OTU, or the named isolate, does not exist
        """
        reference_id = await get_legacy_otu_reference_id(
            self._pg,
            otu_id,
            isolate_id=isolate_id,
        )

        if reference_id is None:
            raise ResourceNotFoundError

        return reference_id

    async def list_isolates(self, otu_id: str) -> list[Document]:
        """List an OTU's isolates and their sequences.

        :param otu_id: the ID of the OTU
        :return: the isolates
        :raises ResourceNotFoundError: the OTU does not exist
        """
        document = await virtool.otus.db.join_and_format(self._pg, otu_id)

        if document is None:
            raise ResourceNotFoundError

        return document["isolates"]

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

    async def get_fasta(self, otu_id: str) -> tuple[str, str] | None:
        """Generate a FASTA filename and body for an OTU's sequences.

        :param otu_id: the ID of the OTU
        :return: a FASTA filename and body

        """
        otu = await get_legacy_otu_fields(self._pg, otu_id, ["name", "isolates"])

        if otu is None:
            raise ResourceNotFoundError

        sequences_by_isolate: dict[str, list[tuple[str, str]]] = defaultdict(list)

        for isolate_id, sequence_id, sequence in await list_legacy_otu_sequence_bodies(
            self._pg,
            otu_id,
        ):
            sequences_by_isolate[isolate_id].append((sequence_id, sequence))

        fasta = []

        for isolate in otu["isolates"]:
            isolate_name = format_isolate_name(isolate)

            fasta.extend(
                format_fasta_entry(otu["name"], isolate_name, sequence_id, sequence)
                for sequence_id, sequence in sequences_by_isolate[isolate["id"]]
            )

        return format_fasta_filename(otu["name"]), "\n".join(fasta)

    async def get_otu_and_isolate_names(
        self,
        otu_id: str,
        isolate_id: str,
    ) -> tuple[str, str]:
        """Get the OTU name and isolate name for a OTU-isolate combination specified by
        `otu_id` and `isolate_id`.

        :param otu_id: the OTU ID
        :param isolate_id: the isolate ID
        :return: an OTU name and isolate name

        """
        otu = await get_legacy_otu_fields(
            self._pg,
            otu_id,
            ["name", "isolates"],
            isolate_id=isolate_id,
        )

        if not otu:
            raise ResourceNotFoundError("OTU does not exist")

        isolate = virtool.otus.utils.find_isolate(otu["isolates"], isolate_id)

        return otu["name"], virtool.otus.utils.format_isolate_name(isolate)

    async def get_isolate_fasta(self, otu_id: str, isolate_id: str) -> tuple[str, str]:
        """Generate a FASTA filename and body for the sequences associated with the
        isolate identified by the passed ``otu_id`` and ``isolate_id``.

        :param otu_id: the id of the isolates' parent otu
        :param isolate_id: the id of the isolate to FASTA
        :return: as FASTA filename and body

        """
        otu_name, isolate_name = await self.get_otu_and_isolate_names(
            otu_id,
            isolate_id,
        )

        fasta = [
            virtool.otus.utils.format_fasta_entry(
                otu_name,
                isolate_name,
                sequence_id,
                sequence,
            )
            for sequence_id, sequence in await list_legacy_isolate_sequence_bodies(
                self._pg,
                otu_id,
                isolate_id,
            )
        ]

        return virtool.otus.utils.format_fasta_filename(
            otu_name,
            isolate_name,
        ), "\n".join(fasta)

    async def get_sequence_fasta(self, sequence_id: str) -> tuple[str, str]:
        """Generate a FASTA filename and body for the sequence associated with the
        passed ``sequence_id``.

        :param sequence_id: the id sequence of the sequence to FASTAfy
        :return: as FASTA filename and body

        """
        body = await get_legacy_sequence_body(self._pg, sequence_id)

        if body is None:
            raise ResourceNotFoundError("Sequence does not exist")

        otu_id, isolate_id, sequence = body

        otu_name, isolate_name = await self.get_otu_and_isolate_names(
            otu_id,
            isolate_id,
        )

        fasta = virtool.otus.utils.format_fasta_entry(
            otu_name,
            isolate_name,
            sequence_id,
            sequence,
        )

        return (
            virtool.otus.utils.format_fasta_filename(
                otu_name,
                isolate_name,
                sequence_id,
            ),
            fasta,
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

    async def update(self, otu_id: str, data: UpdateOTURequest, user_id: int) -> OTU:
        """Update an OTU.

        Modifiable fields are `name`, `abbreviation`, and `schema`. Method creates a
        corresponding history record.

        A request that would leave every modifiable field as it already is makes no
        change and creates no history record; the OTU is returned as-is.

        :param otu_id: the ID of the OTU to edit
        :param data: the update request
        :param user_id: the requesting user id
        :return: the updated and joined OTU document
        :raises ResourceNotFoundError: the OTU does not exist
        :raises ResourceError: the new name or abbreviation is already in use

        """
        existing = await get_legacy_otu_fields(
            self._pg,
            otu_id,
            ["abbreviation", "name", "reference", "schema"],
        )

        if existing is None:
            raise ResourceNotFoundError

        name, abbreviation, otu_schema = evaluate_changes(
            data.dict(by_alias=True, exclude_unset=True),
            existing,
        )

        if name is None and abbreviation is None and otu_schema is None:
            return await self.get(otu_id)

        if message := await virtool.otus.db.check_name_and_abbreviation(
            self._pg,
            existing["reference"]["id"],
            name,
            abbreviation,
        ):
            raise ResourceError(message)

        # Update the ``modified`` and ``verified`` fields in the otu document now,
        # because we are definitely going to modify the otu.
        update = {"verified": False}

        data = data.dict(by_alias=True, exclude_unset=True)

        # If the name is changing, update the ``lower_name`` field in the otu document.
        if "name" in data:
            name = data["name"]
            update.update({"name": name, "lower_name": name.lower()})

        if "abbreviation" in data:
            update["abbreviation"] = data["abbreviation"]

        if "schema" in data:
            update["schema"] = data["schema"]

        async with AsyncSession(self._pg) as session:
            await lock_legacy_otu(session, otu_id)

            old = await join_legacy_otu_in_session(session, otu_id)

            old_document, _ = split(old)

            new_document = {
                **old_document,
                **update,
                "version": old_document["version"] + 1,
            }

            await write_legacy_otu(session, new_document)

            await update_legacy_sequence_segments(session, old, new_document)

            new = await join_legacy_otu_in_session(session, otu_id)

            await update_legacy_otu_verification(session, new)

            await virtool.history.db.add(
                session,
                compose_edit_description(
                    new["name"],
                    new["abbreviation"],
                    old["abbreviation"],
                    new["schema"],
                ),
                HistoryMethod.edit,
                old,
                new,
                user_id,
            )

            await session.commit()

        return await self.get(otu_id)

    async def remove(self, otu_id: str, user_id: int) -> bool:
        """Remove an OTU.

        Create a history document to record the change.

        :param otu_id: the ID of the OTU
        :param user_id: the ID of the requesting user
        :return: `True` if the removal was successful

        """
        async with AsyncSession(self._pg) as session:
            joined = await join_legacy_otu_in_session(session, otu_id)

            if not joined:
                return False

            await delete_legacy_otu(session, otu_id)

            description = compose_remove_description(joined)

            await virtool.history.db.add(
                session,
                description,
                HistoryMethod.remove,
                joined,
                None,
                user_id,
            )

            await session.commit()

        return True

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
                new_isolate_id = self._mongo.id_provider.get()

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

    async def update_isolate(
        self,
        otu_id: str,
        isolate_id: str,
        user_id: int,
        source_type: str | None = None,
        source_name: str | None = None,
    ):
        if source_type is not None:
            source_type = source_type.lower()

            await self._check_source_type(otu_id, source_type)

        async with AsyncSession(self._pg) as session:
            await lock_legacy_otu(session, otu_id)

            old = await join_legacy_otu_in_session(session, otu_id)

            # The isolates are taken from ``old`` rather than read separately. The
            # rename is written as a whole-document replacement, so a list read outside
            # this transaction could carry a concurrent edit that ``old`` does not and
            # silently revert it.
            old_document, _ = split(old)

            isolates = deepcopy(old_document["isolates"])

            isolate = find_isolate(isolates, isolate_id)
            old_isolate_name = format_isolate_name(isolate)

            if source_type is not None:
                isolate["source_type"] = source_type

            if source_name is not None:
                isolate["source_name"] = source_name

            new_isolate_name = format_isolate_name(isolate)

            new_document = {
                **old_document,
                "isolates": isolates,
                "verified": False,
                "version": old_document["version"] + 1,
            }

            await write_legacy_otu(session, new_document)

            new = await join_legacy_otu_in_session(session, otu_id)

            await update_legacy_otu_verification(session, new)

            # Use the old and new entry to add a new history document for the change.
            await virtool.history.db.add(
                session,
                f"Renamed {old_isolate_name} to {new_isolate_name}",
                HistoryMethod.edit_isolate,
                old,
                new,
                user_id,
            )

            await session.commit()

        complete = await virtool.otus.db.join_and_format(
            self._pg,
            otu_id,
            joined=new,
        )

        return strip_sequence_references(find_isolate(complete["isolates"], isolate_id))

    async def set_isolate_as_default(
        self,
        otu_id: str,
        isolate_id: str,
        user_id: int,
    ) -> Document:
        """Set a new default isolate.

        :param otu_id: the ID of the parent OTU
        :param isolate_id: the ID of the isolate set as default
        :param user_id: the ID of the requesting user
        :return: the updated isolate

        """
        async with AsyncSession(self._pg) as session:
            await lock_legacy_otu(session, otu_id)

            old = await join_legacy_otu_in_session(session, otu_id)

            old_document, _ = split(old)

            isolate = find_isolate(old_document["isolates"], isolate_id)

            # If the default isolate will be unchanged, immediately return the existing
            # isolate.
            if isolate["default"]:
                return strip_sequence_references(
                    find_isolate(old["isolates"], isolate_id),
                )

            # Set ``default`` to ``False`` for all existing isolates if the new one
            # should be default.
            isolates = [
                {**isolate, "default": isolate_id == isolate["id"]}
                for isolate in old_document["isolates"]
            ]

            new_document = {
                **old_document,
                "isolates": isolates,
                "verified": False,
                "version": old_document["version"] + 1,
            }

            await write_legacy_otu(session, new_document)

            new = await join_legacy_otu_in_session(session, otu_id)

            await update_legacy_otu_verification(session, new)

            # Use the old and new entry to add a new history document for the change.
            await virtool.history.db.add(
                session,
                f"Set {format_isolate_name(isolate)} as default",
                HistoryMethod.set_as_default,
                old,
                new,
                user_id,
            )

            await session.commit()

            return strip_sequence_references(
                find_isolate(new["isolates"], isolate_id),
            )

    async def remove_isolate(self, otu_id: str, isolate_id: str, user_id: int) -> None:
        """Remove an isolate.

        :param otu_id: the ID of the parent OTU
        :param isolate_id: the ID of the isolate to remove
        :param user_id: the ID of the requesting user

        """
        async with AsyncSession(self._pg) as session:
            await lock_legacy_otu(session, otu_id)

            old = await join_legacy_otu_in_session(session, otu_id)

            old_document, _ = split(old)

            isolates = deepcopy(old_document["isolates"])

            # Get any isolates that have the isolate id to be removed
            # (only one should match!).
            isolate_to_remove = find_isolate(isolates, isolate_id)

            isolates.remove(isolate_to_remove)

            new_default = None

            # Set the first isolate as default if the removed isolate was the default.
            if isolate_to_remove["default"] and len(isolates):
                new_default = isolates[0]
                new_default["default"] = True

            new_document = {
                **old_document,
                "isolates": isolates,
                "verified": False,
                "version": old_document["version"] + 1,
            }

            await write_legacy_otu(session, new_document)

            await delete_legacy_isolate_sequences(session, otu_id, isolate_id)

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

        return OTUSequence(**document)

    async def get_sequence(
        self,
        otu_id: str,
        isolate_id: str,
        sequence_id: str,
    ) -> Sequence:
        if await legacy_isolate_exists(self._pg, otu_id, isolate_id) and (
            document := await get_legacy_sequence(
                self._pg,
                otu_id,
                isolate_id,
                sequence_id,
            )
        ):
            document = await apply_transforms(
                base_processor(document),
                [AttachReferenceTransform(self._pg)],
                self._pg,
            )
            return Sequence(**document)

        raise ResourceNotFoundError

    async def list_isolate_sequences(
        self,
        otu_id: str,
        isolate_id: str,
    ) -> list[OTUSequence]:
        """List the sequences belonging to an isolate.

        :param otu_id: the ID of the parent OTU
        :param isolate_id: the ID of the isolate
        :return: the isolate's sequences
        :raises ResourceNotFoundError: the OTU or isolate does not exist
        """
        if not await legacy_isolate_exists(self._pg, otu_id, isolate_id):
            raise ResourceNotFoundError

        return [
            OTUSequence(**document)
            for document in await list_legacy_isolate_sequences(
                self._pg,
                otu_id,
                isolate_id,
            )
        ]

    async def get_isolate(self, otu_id: str, isolate_id: str) -> OTUIsolate:
        """Get an isolate and its sequences.

        :param otu_id: the ID of the parent OTU
        :param isolate_id: the ID of the isolate
        :return: the isolate
        :raises ResourceNotFoundError: the OTU or isolate does not exist
        """
        document = await get_legacy_otu_fields(
            self._pg,
            otu_id,
            ["isolates"],
            isolate_id=isolate_id,
        )

        if not document:
            raise ResourceNotFoundError

        isolate = find_isolate(document["isolates"], isolate_id)

        sequences = [
            OTUSequence(**sequence_document)
            for sequence_document in await list_legacy_isolate_sequences(
                self._pg,
                otu_id,
                isolate_id,
            )
        ]

        return OTUIsolate(**{**isolate, "sequences": sequences})

    async def sequence_exists(self, sequence_id: str) -> bool:
        """Return whether a sequence exists.

        :param sequence_id: the ID of the sequence
        :return: whether the sequence exists
        """
        return await legacy_sequence_exists(self._pg, sequence_id)

    async def update_sequence(
        self,
        otu_id: str,
        isolate_id: str,
        sequence_id: str,
        user_id: int,
        data: UpdateSequenceRequest,
    ):
        """Update a sequence.

        :raises ResourceError: the segment is not defined in the parent OTU's schema
        """
        data = data.dict(exclude_unset=True)

        if message := await virtool.otus.db.check_sequence_segment(
            self._pg,
            otu_id,
            data,
        ):
            raise ResourceError(message)

        update = {
            key: data[key]
            for key in ("accession", "definition", "host", "segment")
            if key in data
        }

        if "sequence" in data:
            update["sequence"] = data["sequence"].replace(" ", "").replace("\n", "")

        async with AsyncSession(self._pg) as session:
            await lock_legacy_otu(session, otu_id)

            old = await join_legacy_otu_in_session(session, otu_id)

            # Read by id alone, not out of ``old``, because this path addresses a
            # sequence by id alone: the handler's existence guard does not scope it to
            # the OTU in the path either.
            document = {
                **await get_legacy_sequence_in_session(session, sequence_id),
                **update,
            }

            await increment_legacy_otu_version(session, otu_id)

            await write_legacy_sequence(session, document)

            new = await join_legacy_otu_in_session(session, otu_id)

            await update_legacy_otu_verification(session, new)

            isolate_name = format_isolate_name(
                find_isolate(old["isolates"], isolate_id),
            )

            await virtool.history.db.add(
                session,
                f"Edited sequence {sequence_id} in {isolate_name}",
                HistoryMethod.edit_sequence,
                old,
                new,
                user_id,
            )

            await session.commit()

        return base_processor(document)

    async def remove_sequence(
        self,
        otu_id: str,
        isolate_id: str,
        sequence_id: str,
        user_id: int,
    ) -> None:
        """Remove a sequence.

        :param otu_id: the ID of the parent OTU:
        :param isolate_id: the ID of the parent isolate
        :param sequence_id: the ID of the sequence to remove
        :param user_id: the ID of the requesting user

        """
        async with AsyncSession(self._pg) as session:
            await lock_legacy_otu(session, otu_id)

            old = await join_legacy_otu_in_session(session, otu_id)

            await increment_legacy_otu_version(session, otu_id)

            await delete_legacy_sequence(session, sequence_id)

            new = await join_legacy_otu_in_session(session, otu_id)

            await update_legacy_otu_verification(session, new)

            isolate_name = format_isolate_name(
                find_isolate(old["isolates"], isolate_id),
            )

            await virtool.history.db.add(
                session,
                f"Removed sequence {sequence_id} from {isolate_name}",
                HistoryMethod.remove_sequence,
                old,
                new,
                user_id,
            )

            await session.commit()
