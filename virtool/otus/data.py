import asyncio
from collections.abc import Mapping
from copy import deepcopy
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorClientSession
from pymongo.results import DeleteResult
from virtool_core.models.enums import HistoryMethod
from virtool_core.models.otu import OTU, Sequence

import virtool.history.db
import virtool.otus.db
from virtool.data.errors import ResourceNotFoundError
from virtool.data.transforms import apply_transforms
from virtool.downloads.utils import format_fasta_entry, format_fasta_filename
from virtool.history.utils import (
    compose_create_description,
    compose_edit_description,
    compose_remove_description,
)
from virtool.mongo.core import Mongo
from virtool.mongo.utils import get_one_field
from virtool.otus.db import (
    SEQUENCE_PROJECTION,
    increment_otu_version,
    update_otu_verification,
)
from virtool.otus.oas import CreateOTURequest, UpdateOTURequest, UpdateSequenceRequest
from virtool.otus.utils import find_isolate, format_isolate_name
from virtool.references.transforms import AttachReferenceTransform
from virtool.types import Document
from virtool.users.transforms import AttachUserTransform
from virtool.utils import base_processor


class OTUData:
    name = "otus"

    def __init__(self, mongo: Mongo, data_path: Path):
        self._mongo = mongo
        self._data_path = data_path

    async def find(self, query: Mapping, term: str | None, verified: bool | None):
        return await virtool.otus.db.find(self._mongo, term, query, verified)

    async def get(self, otu_id: str) -> OTU:
        """Get a single OTU by ID.

        :param otu_id: the ID of the OTU to get
        :return: the OTU
        """
        document = await virtool.otus.db.join_and_format(self._mongo, otu_id)

        if document is None:
            raise ResourceNotFoundError

        document = await apply_transforms(
            document,
            [AttachReferenceTransform(self._mongo)],
        )

        return OTU(
            **{
                **document,
                "most_recent_change": await apply_transforms(
                    document["most_recent_change"],
                    [AttachUserTransform(self._mongo)],
                ),
            },
        )

    async def get_fasta(self, otu_id: str) -> tuple[str, str] | None:
        """Generate a FASTA filename and body for an OTU's sequences.

        :param otu_id: the ID of the OTU
        :return: a FASTA filename and body

        """
        otu = await self._mongo.otus.find_one(otu_id, ["name", "isolates"])

        if otu is None:
            raise ResourceNotFoundError

        fasta = []

        for isolate in otu["isolates"]:
            isolate_name = format_isolate_name(isolate)

            fasta.extend(
                [
                    format_fasta_entry(
                        otu["name"],
                        isolate_name,
                        sequence["_id"],
                        sequence["sequence"],
                    )
                    async for sequence in self._mongo.sequences.find(
                        {"otu_id": otu_id, "isolate_id": isolate["id"]},
                        ["sequence"],
                    )
                ],
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
        otu = await self._mongo.otus.find_one(
            {"_id": otu_id, "isolates.id": isolate_id},
            ["name", "isolates"],
        )

        if not otu:
            raise ResourceNotFoundError("OTU does not exist")

        isolate = virtool.otus.utils.find_isolate(otu["isolates"], isolate_id)

        if not isolate:
            raise ResourceNotFoundError("Isolate does not exist")

        return otu["name"], virtool.otus.utils.format_isolate_name(isolate)

    async def get_isolate_fasta(self, otu_id: str, isolate_id: str) -> tuple[str, str]:
        """Generate a FASTA filename and body for the sequences associated with the
        isolate identified by the passed ``otu_id`` and ``isolate_id``.

        :param otu_id: the id of the isolates' parent otu
        :param isolate_id: the id of the isolate to FASTA
        :return: as FASTA filename and body

        """
        _, isolate_name = await self.get_otu_and_isolate_names(otu_id, isolate_id)

        otu = await self._mongo.otus.find_one(
            {"_id": otu_id, "isolates.id": isolate_id},
            ["name", "isolates"],
        )

        fasta = []

        async for sequence in self._mongo.sequences.find(
            {"otu_id": otu_id, "isolate_id": isolate_id},
            ["sequence"],
        ):
            fasta.append(
                virtool.downloads.utils.format_fasta_entry(
                    otu["name"],
                    isolate_name,
                    sequence["_id"],
                    sequence["sequence"],
                ),
            )

        return virtool.downloads.utils.format_fasta_filename(
            otu["name"],
            isolate_name,
        ), "\n".join(fasta)

    async def get_sequence_fasta(self, sequence_id: str) -> tuple[str, str]:
        """Generate a FASTA filename and body for the sequence associated with the
        passed ``sequence_id``.

        :param sequence_id: the id sequence of the sequence to FASTAfy
        :return: as FASTA filename and body

        """
        sequence = await self._mongo.sequences.find_one(
            sequence_id,
            ["sequence", "otu_id", "isolate_id"],
        )

        if not sequence:
            raise ResourceNotFoundError("Sequence does not exist")

        otu_name, isolate_name = await self.get_otu_and_isolate_names(
            sequence["otu_id"],
            sequence["isolate_id"],
        )

        fasta = virtool.downloads.utils.format_fasta_entry(
            otu_name,
            isolate_name,
            sequence_id,
            sequence["sequence"],
        )

        return (
            virtool.downloads.utils.format_fasta_filename(
                otu_name,
                isolate_name,
                sequence["_id"],
            ),
            fasta,
        )

    async def create(self, ref_id: str, data: CreateOTURequest, user_id: str) -> OTU:
        """Create an OTU and it's first history record.

        :param ref_id: the ID of the parent reference
        :param data: an OTU creation request
        :param user_id: the ID of the creating user
        :return: the OTU
        """

        async def func(session: AsyncIOMotorClientSession) -> Document:
            document_ = await self._mongo.otus.insert_one(
                {
                    "name": data.name,
                    "abbreviation": data.abbreviation,
                    "last_indexed_version": None,
                    "verified": False,
                    "lower_name": data.name.lower(),
                    "isolates": [],
                    "version": 0,
                    "reference": {"id": ref_id},
                    "schema": [],
                },
                session=session,
            )

            await virtool.history.db.add(
                self._mongo,
                self._data_path,
                HistoryMethod.create,
                None,
                document_,
                compose_create_description(document_),
                user_id,
                session=session,
            )

            return document_

        document = await self._mongo.with_transaction(func)

        return await self.get(document["_id"])

    async def update(self, otu_id: str, data: UpdateOTURequest, user_id: str) -> OTU:
        """Update an OTU.

        Modifiable fields are `name`, `abbreviation`, and `schema`. Method creates a
        corresponding history record.

        :param otu_id: the ID of the OTU to edit
        :param data: the update request
        :param user_id: the requesting user id
        :return: the updated and joined OTU document

        """
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

        async def func(session: AsyncIOMotorClientSession):
            old = await virtool.otus.db.join(self._mongo, otu_id, session=session)

            document_ = await self._mongo.otus.find_one_and_update(
                {"_id": otu_id},
                {"$set": update, "$inc": {"version": 1}},
                session=session,
            )

            await virtool.otus.db.update_sequence_segments(
                self._mongo,
                old,
                document_,
                session=session,
            )

            new = await virtool.otus.db.join(
                self._mongo,
                otu_id,
                document_,
                session=session,
            )

            await update_otu_verification(self._mongo, new, session=session)

            await virtool.history.db.add(
                self._mongo,
                self._data_path,
                HistoryMethod.edit,
                old,
                new,
                compose_edit_description(
                    new["name"],
                    new["abbreviation"],
                    old["abbreviation"],
                    new["schema"],
                ),
                user_id,
                session=session,
            )

        await self._mongo.with_transaction(func)

        return await self.get(otu_id)

    async def remove(self, otu_id: str, user_id: str) -> DeleteResult | None:
        """Remove an OTU.

        Create a history document to record the change.

        :param otu_id: the ID of the OTU
        :param user_id: the ID of the requesting user
        :return: `True` if the removal was successful

        """
        joined = await virtool.otus.db.join(self._mongo, otu_id)

        if not joined:
            return None

        async def func(session: AsyncIOMotorClientSession) -> DeleteResult | None:
            _, delete_result, _ = await asyncio.gather(
                self._mongo.sequences.delete_many({"otu_id": otu_id}, session=session),
                self._mongo.otus.delete_one({"_id": otu_id}, session=session),
                # Unset the reference internal_control if it is the OTU being removed.
                self._mongo.references.update_one(
                    {
                        "_id": joined["reference"]["id"],
                        "internal_control.id": joined["_id"],
                    },
                    {"$set": {"internal_control": None}},
                    session=session,
                ),
            )

            description = compose_remove_description(joined)

            await virtool.history.db.add(
                self._mongo,
                self._data_path,
                HistoryMethod.remove,
                joined,
                None,
                description,
                user_id,
                session=session,
            )

            return delete_result

        return await self._mongo.with_transaction(func)

    async def add_isolate(
        self,
        otu_id: str,
        source_type: str,
        source_name: str,
        user_id: str,
        default: bool = False,
    ):
        async def func(session: AsyncIOMotorClientSession) -> Document:
            document = await self._mongo.otus.find_one(otu_id, session=session)

            isolates = deepcopy(document["isolates"])

            # True if the new isolate should be default and any existing isolates should
            # be non-default.
            will_be_default = not isolates or default

            # Set ``default`` to ``False`` for all existing isolates if the new one
            # should be default.
            if will_be_default:
                for isolate_ in isolates:
                    isolate_["default"] = False

            document = await self._mongo.otus.find_one(otu_id, session=session)

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
                session=session,
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
                session=session,
            )

            # Get the joined entry now that it has been updated.
            new = await virtool.otus.db.join(self._mongo, otu_id, session=session)

            await update_otu_verification(self._mongo, new, session=session)

            description = f"Added {format_isolate_name(isolate_)}"

            if will_be_default:
                description += " as default"

            await virtool.history.db.add(
                self._mongo,
                self._data_path,
                HistoryMethod.add_isolate,
                old,
                new,
                description,
                user_id,
                session=session,
            )

            return isolate_

        isolate = await self._mongo.with_transaction(func)

        return {**isolate, "sequences": []}

    async def update_isolate(
        self,
        otu_id: str,
        isolate_id: str,
        user_id: str,
        source_type: str | None = None,
        source_name: str | None = None,
    ):
        isolates = await get_one_field(self._mongo.otus, "isolates", otu_id)

        isolate = find_isolate(isolates, isolate_id)
        old_isolate_name = format_isolate_name(isolate)

        if source_type is not None:
            isolate["source_type"] = source_type

        if source_name is not None:
            isolate["source_name"] = source_name

        new_isolate_name = format_isolate_name(isolate)

        async def func(session: AsyncIOMotorClientSession) -> Document:
            old = await virtool.otus.db.join(self._mongo, otu_id, session=session)

            # Replace the isolates list with the update one.
            document = await self._mongo.otus.find_one_and_update(
                {"_id": otu_id},
                {
                    "$set": {"isolates": isolates, "verified": False},
                    "$inc": {"version": 1},
                },
                session=session,
            )

            # Get the joined entry now that it has been updated.
            new_ = await virtool.otus.db.join(
                self._mongo,
                otu_id,
                document,
                session=session,
            )

            await virtool.otus.db.update_otu_verification(
                self._mongo,
                new_,
                session=session,
            )

            # Use the old and new entry to add a new history document for the change.
            await virtool.history.db.add(
                self._mongo,
                self._data_path,
                HistoryMethod.edit_isolate,
                old,
                new_,
                f"Renamed {old_isolate_name} to {new_isolate_name}",
                user_id,
                session=session,
            )

            return new_

        new = await self._mongo.with_transaction(func)

        complete = await virtool.otus.db.join_and_format(
            self._mongo,
            otu_id,
            joined=new,
        )

        return find_isolate(complete["isolates"], isolate_id)

    async def set_isolate_as_default(
        self,
        otu_id: str,
        isolate_id: str,
        user_id: str,
    ) -> Document:
        """Set a new default isolate.

        :param otu_id: the ID of the parent OTU
        :param isolate_id: the ID of the isolate set as default
        :param user_id: the ID of the requesting user
        :return: the updated isolate

        """

        async def func(session: AsyncIOMotorClientSession) -> Document:
            document = await self._mongo.otus.find_one(otu_id, session=session)

            isolate = find_isolate(document["isolates"], isolate_id)

            old = await virtool.otus.db.join(
                self._mongo,
                otu_id,
                document,
                session=session,
            )

            # If the default isolate will be unchanged, immediately return the existing
            # isolate.
            if isolate["default"]:
                return find_isolate(old["isolates"], isolate_id)

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
                session=session,
            )

            # Get the joined entry now that it has been updated.
            new = await virtool.otus.db.join(
                self._mongo,
                otu_id,
                document,
                session=session,
            )

            await virtool.otus.db.update_otu_verification(self._mongo, new)

            # Use the old and new entry to add a new history document for the change.
            await virtool.history.db.add(
                self._mongo,
                self._data_path,
                HistoryMethod.set_as_default,
                old,
                new,
                f"Set {format_isolate_name(isolate)} as default",
                user_id,
                session=session,
            )

            return find_isolate(new["isolates"], isolate_id)

        return await self._mongo.with_transaction(func)

    async def remove_isolate(self, otu_id: str, isolate_id: str, user_id: str):
        """Remove an isolate.

        :param otu_id: the ID of the parent OTU
        :param isolate_id: the ID of the isolate to remove
        :param user_id: the ID of the requesting user

        """

        async def func(session: AsyncIOMotorClientSession):
            document = await self._mongo.otus.find_one(otu_id)

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
                session=session,
            )

            document = await self._mongo.otus.find_one_and_update(
                {"_id": otu_id},
                {
                    "$set": {"isolates": isolates, "verified": False},
                    "$inc": {"version": 1},
                },
                session=session,
            )

            new = await virtool.otus.db.join(
                self._mongo,
                otu_id,
                document,
                session=session,
            )

            await asyncio.gather(
                virtool.otus.db.update_otu_verification(
                    self._mongo,
                    new,
                    session=session,
                ),
                self._mongo.sequences.delete_many(
                    {"otu_id": otu_id, "isolate_id": isolate_id},
                    session=session,
                ),
            )

            description = f"Removed {format_isolate_name(isolate_to_remove)}"

            if isolate_to_remove["default"] and new_default:
                description += f" and set {format_isolate_name(new_default)} as default"

            await virtool.history.db.add(
                self._mongo,
                self._data_path,
                HistoryMethod.remove_isolate,
                old,
                new,
                description,
                user_id,
                session=session,
            )

        await self._mongo.with_transaction(func)

    async def create_sequence(
        self,
        otu_id: str,
        isolate_id: str,
        accession: str,
        definition: str,
        sequence: str,
        user_id: str,
        host: str = "",
        segment: str | None = None,
        sequence_id: str | None = None,
        target: str | None = None,
    ):
        async def func(session: AsyncIOMotorClientSession) -> Document:
            old = await virtool.otus.db.join(self._mongo, otu_id, session=session)

            to_insert = {
                "accession": accession,
                "definition": definition,
                "otu_id": otu_id,
                "isolate_id": isolate_id,
                "host": host,
                "reference": {"id": old["reference"]["id"]},
                "segment": segment,
                "sequence": sequence.replace(" ", "").replace("\n", ""),
                "target": target,
            }

            if sequence_id:
                to_insert["_id"] = sequence_id

            document = await self._mongo.sequences.insert_one(
                to_insert,
                session=session,
            )

            new = await virtool.otus.db.join(
                self._mongo,
                otu_id,
                document=await increment_otu_version(
                    self._mongo,
                    otu_id,
                    session=session,
                ),
                session=session,
            )

            await virtool.otus.db.update_otu_verification(
                self._mongo,
                new,
                session=session,
            )

            isolate_name = format_isolate_name(
                find_isolate(old["isolates"], isolate_id),
            )

            await virtool.history.db.add(
                self._mongo,
                self._data_path,
                HistoryMethod.create_sequence,
                old,
                new,
                f"Created new sequence {accession} in {isolate_name}",
                user_id,
                session=session,
            )

            return document

        return base_processor(await self._mongo.with_transaction(func))

    async def get_sequence(
        self,
        otu_id: str,
        isolate_id: str,
        sequence_id: str,
    ) -> Sequence:
        if await self._mongo.otus.count_documents(
            {"_id": otu_id, "isolates.id": isolate_id},
            limit=1,
        ) and (
            document := await self._mongo.sequences.find_one(
                {"_id": sequence_id, "otu_id": otu_id, "isolate_id": isolate_id},
                SEQUENCE_PROJECTION,
            )
        ):
            document = await apply_transforms(
                base_processor(document),
                [AttachReferenceTransform(self._mongo)],
            )
            return Sequence(**document)

        raise ResourceNotFoundError

    async def update_sequence(
        self,
        otu_id: str,
        isolate_id: str,
        sequence_id: str,
        user_id: str,
        data: UpdateSequenceRequest,
    ):
        data = data.dict(exclude_unset=True)

        update = {
            key: data[key]
            for key in ("accession", "definition", "host", "segment", "target")
            if key in data
        }

        if "sequence" in data:
            update["sequence"] = data["sequence"].replace(" ", "").replace("\n", "")

        async def func(session: AsyncIOMotorClientSession) -> Document:
            old = await virtool.otus.db.join(self._mongo, otu_id, session=session)

            document = await self._mongo.sequences.find_one_and_update(
                {"_id": sequence_id},
                {"$set": update},
                session=session,
            )

            await increment_otu_version(self._mongo, otu_id, session=session)

            new = await virtool.otus.db.join(self._mongo, otu_id, session=session)

            await update_otu_verification(self._mongo, new, session=session)

            isolate_name = format_isolate_name(
                find_isolate(old["isolates"], isolate_id),
            )

            await virtool.history.db.add(
                self._mongo,
                self._data_path,
                HistoryMethod.edit_sequence,
                old,
                new,
                f"Edited sequence {sequence_id} in {isolate_name}",
                user_id,
                session=session,
            )

            return document

        return base_processor(await self._mongo.with_transaction(func))

    async def remove_sequence(
        self,
        otu_id: str,
        isolate_id: str,
        sequence_id: str,
        user_id: str,
    ):
        """Remove a sequence.

        :param otu_id: the ID of the parent OTU:
        :param isolate_id: the ID of the parent isolate
        :param sequence_id: the ID of the sequence to remove
        :param user_id: the ID of the requesting user

        """
        old = await virtool.otus.db.join(self._mongo, otu_id)

        async def func(session: AsyncIOMotorClientSession):
            await self._mongo.sequences.delete_one(
                {"_id": sequence_id},
                session=session,
            )

            new = await virtool.otus.db.join(
                self._mongo,
                otu_id,
                document=await increment_otu_version(
                    self._mongo,
                    otu_id,
                    session=session,
                ),
                session=session,
            )

            await update_otu_verification(self._mongo, new, session=session)

            isolate_name = format_isolate_name(
                find_isolate(old["isolates"], isolate_id),
            )

            await virtool.history.db.add(
                self._mongo,
                self._data_path,
                HistoryMethod.remove_sequence,
                old,
                new,
                f"Removed sequence {sequence_id} from {isolate_name}",
                user_id,
                session=session,
            )

        await self._mongo.with_transaction(func)
