"""The data layer domain for OTUs."""

import asyncio
from collections import defaultdict
from copy import deepcopy
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClientSession
from pymongo.results import DeleteResult
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.history.db
import virtool.otus.db
import virtool.otus.utils
from virtool.data.errors import (
    ResourceConflictError,
    ResourceError,
    ResourceNotFoundError,
)
from virtool.data.topg import resolve_legacy_id, retry_both_transactions
from virtool.data.transforms import apply_transforms
from virtool.history.utils import (
    compose_create_description,
    compose_edit_description,
    compose_remove_description,
)
from virtool.models.enums import HistoryMethod
from virtool.mongo.core import Mongo
from virtool.otus.db import (
    get_legacy_otu_fields,
    get_legacy_otu_reference_id,
    get_legacy_sequence,
    get_legacy_sequence_body,
    increment_otu_version,
    legacy_isolate_exists,
    legacy_sequence_exists,
    list_legacy_isolate_sequence_bodies,
    list_legacy_isolate_sequences,
    list_legacy_otu_sequence_bodies,
    update_otu_verification,
)
from virtool.otus.models import OTU, OTUIsolate, OTUSequence, Sequence
from virtool.otus.oas import CreateOTURequest, UpdateOTURequest, UpdateSequenceRequest
from virtool.otus.utils import (
    evaluate_changes,
    find_isolate,
    format_fasta_entry,
    format_fasta_filename,
    format_isolate_name,
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

        async def func(
            mongo_session: AsyncIOMotorClientSession,
            pg_session: AsyncSession,
        ) -> Document:
            document_ = await self._mongo.otus.insert_one(
                {
                    "name": data.name,
                    "abbreviation": data.abbreviation,
                    "last_indexed_version": None,
                    "verified": False,
                    "lower_name": data.name.lower(),
                    "isolates": [],
                    "version": 0,
                    "reference": {"id": reference_pk},
                    "schema": data.dict()["otu_schema"],
                },
                session=mongo_session,
            )

            await virtool.otus.db.write_legacy_otu(pg_session, document_)

            await virtool.history.db.add(
                pg_session,
                compose_create_description(document_),
                HistoryMethod.create,
                None,
                document_,
                user_id,
            )

            return document_

        document = await retry_both_transactions(self._mongo, self._pg, func)

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

        async def func(
            mongo_session: AsyncIOMotorClientSession,
            pg_session: AsyncSession,
        ):
            await virtool.otus.db.lock_legacy_otu(pg_session, otu_id)

            old = await virtool.otus.db.join(self._mongo, otu_id, session=mongo_session)

            document_ = await self._mongo.otus.find_one_and_update(
                {"_id": otu_id},
                {"$set": update, "$inc": {"version": 1}},
                session=mongo_session,
            )

            await virtool.otus.db.update_sequence_segments(
                self._mongo,
                old,
                document_,
                session=mongo_session,
            )

            new = await virtool.otus.db.join(
                self._mongo,
                otu_id,
                document_,
                session=mongo_session,
            )

            await update_otu_verification(self._mongo, new, session=mongo_session)

            final = await self._mongo.otus.find_one(otu_id, session=mongo_session)

            await virtool.otus.db.write_legacy_otu(pg_session, final)

            # ``update_sequence_segments`` unsets ``segment`` on sequences whose
            # segment name is no longer in the schema. Re-mirror the OTU's sequences
            # so their Postgres rows track that change.
            if {s["name"] for s in (old or {}).get("schema", [])} - {
                s["name"] for s in final.get("schema", [])
            }:
                async for sequence in self._mongo.sequences.find(
                    {"otu_id": otu_id},
                    session=mongo_session,
                ):
                    await virtool.otus.db.write_legacy_sequence(pg_session, sequence)

            await virtool.history.db.add(
                pg_session,
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

        await retry_both_transactions(self._mongo, self._pg, func)

        return await self.get(otu_id)

    async def remove(self, otu_id: str, user_id: int) -> DeleteResult | None:
        """Remove an OTU.

        Create a history document to record the change.

        :param otu_id: the ID of the OTU
        :param user_id: the ID of the requesting user
        :return: `True` if the removal was successful

        """
        joined = await virtool.otus.db.join(self._mongo, otu_id)

        if not joined:
            return None

        async def func(
            mongo_session: AsyncIOMotorClientSession,
            pg_session: AsyncSession,
        ) -> DeleteResult | None:
            _, delete_result = await asyncio.gather(
                self._mongo.sequences.delete_many(
                    {"otu_id": otu_id}, session=mongo_session
                ),
                self._mongo.otus.delete_one({"_id": otu_id}, session=mongo_session),
            )

            await virtool.otus.db.delete_legacy_otu(pg_session, otu_id)

            description = compose_remove_description(joined)

            await virtool.history.db.add(
                pg_session,
                description,
                HistoryMethod.remove,
                joined,
                None,
                user_id,
            )

            return delete_result

        return await retry_both_transactions(self._mongo, self._pg, func)

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

        async def func(
            mongo_session: AsyncIOMotorClientSession,
            pg_session: AsyncSession,
        ) -> OTUIsolate:
            await virtool.otus.db.lock_legacy_otu(pg_session, otu_id)

            document = await self._mongo.otus.find_one(otu_id, session=mongo_session)

            isolates = deepcopy(document["isolates"])

            # True if the new isolate should be default and any existing isolates should
            # be non-default.
            will_be_default = not isolates or default

            # Set ``default`` to ``False`` for all existing isolates if the new one
            # should be default.
            if will_be_default:
                for isolate_ in isolates:
                    isolate_["default"] = False

            old = await virtool.otus.db.join(
                self._mongo,
                otu_id,
                document,
                session=mongo_session,
            )

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

            # Push the new isolate to the database.
            await self._mongo.otus.update_one(
                {"_id": otu_id},
                {
                    "$set": {"isolates": [*isolates, isolate_], "verified": False},
                    "$inc": {"version": 1},
                },
                session=mongo_session,
            )

            # Get the joined entry now that it has been updated.
            new = await virtool.otus.db.join(self._mongo, otu_id, session=mongo_session)

            await update_otu_verification(self._mongo, new, session=mongo_session)

            final = await self._mongo.otus.find_one(otu_id, session=mongo_session)

            await virtool.otus.db.write_legacy_otu(pg_session, final)

            description = f"Added {format_isolate_name(isolate_)}"

            if will_be_default:
                description += " as default"

            await virtool.history.db.add(
                pg_session,
                description,
                HistoryMethod.add_isolate,
                old,
                new,
                user_id,
            )

            return OTUIsolate(**{**isolate_, "sequences": []})

        return await retry_both_transactions(self._mongo, self._pg, func)

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

        isolates = (await get_legacy_otu_fields(self._pg, otu_id, ["isolates"]))[
            "isolates"
        ]

        isolate = find_isolate(isolates, isolate_id)
        old_isolate_name = format_isolate_name(isolate)

        if source_type is not None:
            isolate["source_type"] = source_type

        if source_name is not None:
            isolate["source_name"] = source_name

        new_isolate_name = format_isolate_name(isolate)

        async def func(
            mongo_session: AsyncIOMotorClientSession,
            pg_session: AsyncSession,
        ) -> Document:
            await virtool.otus.db.lock_legacy_otu(pg_session, otu_id)

            old = await virtool.otus.db.join(self._mongo, otu_id, session=mongo_session)

            # Replace the isolates list with the update one.
            document = await self._mongo.otus.find_one_and_update(
                {"_id": otu_id},
                {
                    "$set": {"isolates": isolates, "verified": False},
                    "$inc": {"version": 1},
                },
                session=mongo_session,
            )

            # Get the joined entry now that it has been updated.
            new_ = await virtool.otus.db.join(
                self._mongo,
                otu_id,
                document,
                session=mongo_session,
            )

            await virtool.otus.db.update_otu_verification(
                self._mongo,
                new_,
                session=mongo_session,
            )

            final = await self._mongo.otus.find_one(otu_id, session=mongo_session)

            await virtool.otus.db.write_legacy_otu(pg_session, final)

            # Use the old and new entry to add a new history document for the change.
            await virtool.history.db.add(
                pg_session,
                f"Renamed {old_isolate_name} to {new_isolate_name}",
                HistoryMethod.edit_isolate,
                old,
                new_,
                user_id,
            )

            return new_

        new = await retry_both_transactions(self._mongo, self._pg, func)

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

        async def func(
            mongo_session: AsyncIOMotorClientSession,
            pg_session: AsyncSession,
        ) -> Document:
            await virtool.otus.db.lock_legacy_otu(pg_session, otu_id)

            document = await self._mongo.otus.find_one(otu_id, session=mongo_session)

            isolate = find_isolate(document["isolates"], isolate_id)

            old = await virtool.otus.db.join(
                self._mongo,
                otu_id,
                document,
                session=mongo_session,
            )

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
                for isolate in document["isolates"]
            ]

            # Replace the isolates list with the updated one.
            document = await self._mongo.otus.find_one_and_update(
                {"_id": otu_id},
                {
                    "$set": {"isolates": isolates, "verified": False},
                    "$inc": {"version": 1},
                },
                session=mongo_session,
            )

            # Get the joined entry now that it has been updated.
            new = await virtool.otus.db.join(
                self._mongo,
                otu_id,
                document,
                session=mongo_session,
            )

            await virtool.otus.db.update_otu_verification(
                self._mongo,
                new,
                session=mongo_session,
            )

            final = await self._mongo.otus.find_one(otu_id, session=mongo_session)

            await virtool.otus.db.write_legacy_otu(pg_session, final)

            # Use the old and new entry to add a new history document for the change.
            await virtool.history.db.add(
                pg_session,
                f"Set {format_isolate_name(isolate)} as default",
                HistoryMethod.set_as_default,
                old,
                new,
                user_id,
            )

            return strip_sequence_references(
                find_isolate(new["isolates"], isolate_id),
            )

        return await retry_both_transactions(self._mongo, self._pg, func)

    async def remove_isolate(self, otu_id: str, isolate_id: str, user_id: int) -> None:
        """Remove an isolate.

        :param otu_id: the ID of the parent OTU
        :param isolate_id: the ID of the isolate to remove
        :param user_id: the ID of the requesting user

        """

        async def func(
            mongo_session: AsyncIOMotorClientSession,
            pg_session: AsyncSession,
        ):
            await virtool.otus.db.lock_legacy_otu(pg_session, otu_id)

            document = await self._mongo.otus.find_one(otu_id, session=mongo_session)

            isolates = deepcopy(document["isolates"])

            # Get any isolates that have the isolate id to be removed
            # (only one should match!).
            isolate_to_remove = find_isolate(isolates, isolate_id)

            isolates.remove(isolate_to_remove)

            new_default = None

            # Set the first isolate as default if the removed isolate was the default.
            if isolate_to_remove["default"] and len(isolates):
                new_default = isolates[0]
                new_default["default"] = True

            old = await virtool.otus.db.join(
                self._mongo,
                otu_id,
                document,
                session=mongo_session,
            )

            document = await self._mongo.otus.find_one_and_update(
                {"_id": otu_id},
                {
                    "$set": {"isolates": isolates, "verified": False},
                    "$inc": {"version": 1},
                },
                session=mongo_session,
            )

            new = await virtool.otus.db.join(
                self._mongo,
                otu_id,
                document,
                session=mongo_session,
            )

            await asyncio.gather(
                virtool.otus.db.update_otu_verification(
                    self._mongo,
                    new,
                    session=mongo_session,
                ),
                self._mongo.sequences.delete_many(
                    {"otu_id": otu_id, "isolate_id": isolate_id},
                    session=mongo_session,
                ),
            )

            final = await self._mongo.otus.find_one(otu_id, session=mongo_session)

            await virtool.otus.db.write_legacy_otu(pg_session, final)

            await virtool.otus.db.delete_legacy_isolate_sequences(
                pg_session,
                otu_id,
                isolate_id,
            )

            description = f"Removed {format_isolate_name(isolate_to_remove)}"

            if isolate_to_remove["default"] and new_default:
                description += f" and set {format_isolate_name(new_default)} as default"

            await virtool.history.db.add(
                pg_session,
                description,
                HistoryMethod.remove_isolate,
                old,
                new,
                user_id,
            )

        await retry_both_transactions(self._mongo, self._pg, func)

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

        async def func(
            mongo_session: AsyncIOMotorClientSession,
            pg_session: AsyncSession,
        ) -> OTUSequence:
            await virtool.otus.db.lock_legacy_otu(pg_session, otu_id)

            old = await virtool.otus.db.join(self._mongo, otu_id, session=mongo_session)

            to_insert = {
                "accession": accession,
                "definition": definition,
                "otu_id": otu_id,
                "isolate_id": isolate_id,
                "host": host,
                "reference": {"id": old["reference"]["id"]},
                "segment": segment,
                "sequence": sequence.replace(" ", "").replace("\n", ""),
            }

            if sequence_id:
                to_insert["_id"] = sequence_id

            document = await self._mongo.sequences.insert_one(
                to_insert,
                session=mongo_session,
            )

            new = await virtool.otus.db.join(
                self._mongo,
                otu_id,
                document=await increment_otu_version(
                    self._mongo,
                    otu_id,
                    session=mongo_session,
                ),
                session=mongo_session,
            )

            await virtool.otus.db.update_otu_verification(
                self._mongo,
                new,
                session=mongo_session,
            )

            final = await self._mongo.otus.find_one(otu_id, session=mongo_session)

            await virtool.otus.db.write_legacy_otu(pg_session, final)

            await virtool.otus.db.write_legacy_sequence(pg_session, document)

            isolate_name = format_isolate_name(
                find_isolate(old["isolates"], isolate_id),
            )

            await virtool.history.db.add(
                pg_session,
                f"Created new sequence {accession} in {isolate_name}",
                HistoryMethod.create_sequence,
                old,
                new,
                user_id,
            )

            return OTUSequence(**document)

        return await retry_both_transactions(self._mongo, self._pg, func)

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

        async def func(
            mongo_session: AsyncIOMotorClientSession,
            pg_session: AsyncSession,
        ) -> Document:
            await virtool.otus.db.lock_legacy_otu(pg_session, otu_id)

            old = await virtool.otus.db.join(self._mongo, otu_id, session=mongo_session)

            document = await self._mongo.sequences.find_one_and_update(
                {"_id": sequence_id},
                {"$set": update},
                session=mongo_session,
            )

            await increment_otu_version(self._mongo, otu_id, session=mongo_session)

            new = await virtool.otus.db.join(self._mongo, otu_id, session=mongo_session)

            await update_otu_verification(self._mongo, new, session=mongo_session)

            final_otu = await self._mongo.otus.find_one(otu_id, session=mongo_session)

            await virtool.otus.db.write_legacy_otu(pg_session, final_otu)

            final_sequence = await self._mongo.sequences.find_one(
                sequence_id,
                session=mongo_session,
            )

            await virtool.otus.db.write_legacy_sequence(pg_session, final_sequence)

            isolate_name = format_isolate_name(
                find_isolate(old["isolates"], isolate_id),
            )

            await virtool.history.db.add(
                pg_session,
                f"Edited sequence {sequence_id} in {isolate_name}",
                HistoryMethod.edit_sequence,
                old,
                new,
                user_id,
            )

            return document

        return base_processor(
            await retry_both_transactions(self._mongo, self._pg, func)
        )

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
        old = await virtool.otus.db.join(self._mongo, otu_id)

        async def func(
            mongo_session: AsyncIOMotorClientSession,
            pg_session: AsyncSession,
        ):
            await virtool.otus.db.lock_legacy_otu(pg_session, otu_id)

            await self._mongo.sequences.delete_one(
                {"_id": sequence_id},
                session=mongo_session,
            )

            new = await virtool.otus.db.join(
                self._mongo,
                otu_id,
                document=await increment_otu_version(
                    self._mongo,
                    otu_id,
                    session=mongo_session,
                ),
                session=mongo_session,
            )

            await update_otu_verification(self._mongo, new, session=mongo_session)

            final = await self._mongo.otus.find_one(otu_id, session=mongo_session)

            await virtool.otus.db.write_legacy_otu(pg_session, final)

            await virtool.otus.db.delete_legacy_sequence(pg_session, sequence_id)

            isolate_name = format_isolate_name(
                find_isolate(old["isolates"], isolate_id),
            )

            await virtool.history.db.add(
                pg_session,
                f"Removed sequence {sequence_id} from {isolate_name}",
                HistoryMethod.remove_sequence,
                old,
                new,
                user_id,
            )

        await retry_both_transactions(self._mongo, self._pg, func)
