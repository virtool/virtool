import asyncio

from aiohttp import ClientSession
from sqlalchemy import delete, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.history.db
import virtool.indexes.db
import virtool.otus.db
import virtool.utils
from virtool.api.errors import APIInsufficientRights
from virtool.api.utils import compose_regex_query, paginate
from virtool.config import Config
from virtool.data.domain import DataLayerDomain
from virtool.data.errors import (
    ResourceConflictError,
    ResourceError,
    ResourceNotFoundError,
)
from virtool.data.events import Operation, emit, emits
from virtool.data.topg import (
    both_transactions,
    compose_legacy_id_single_expression,
    retry_both_transactions,
)
from virtool.data.transforms import apply_transforms
from virtool.groups.pg import SQLGroup
from virtool.history.db import (
    bulk_delete_history,
    bulk_insert_history,
    patch_to_version,
)
from virtool.history.models import HistorySearchResult
from virtool.history.sql import SQLLegacyHistory
from virtool.indexes.models import IndexMinimal, IndexSearchResult
from virtool.models.enums import HistoryMethod
from virtool.mongo.core import Mongo
from virtool.mongo.utils import get_one_field
from virtool.otus.models import OTU, OTUSearchResult
from virtool.otus.oas import CreateOTURequest
from virtool.pg.utils import get_row_by_id
from virtool.references.alot import prepare_otu_insertion
from virtool.references.db import (
    compose_archived_filter,
    compose_rights_filter,
    get_contributors,
    get_latest_build,
    get_manifest,
    get_otu_count,
    get_reference_groups,
    get_reference_users,
    get_unbuilt_count,
    populate_insert_only_reference,
    processor,
)
from virtool.references.models import (
    Reference,
    ReferenceGroup,
    ReferenceSearchResult,
    ReferenceUser,
)
from virtool.references.oas import (
    CreateReferenceGroupRequest,
    CreateReferenceRequest,
    CreateReferenceUserRequest,
    ReferenceRightsRequest,
    UpdateReferenceRequest,
)
from virtool.references.sql import (
    SQLReference,
    SQLReferenceGroup,
    SQLReferenceUser,
)
from virtool.references.tasks import (
    CloneReferenceTask,
    ImportReferenceTask,
)
from virtool.references.transforms import AttachImportedFromTransform
from virtool.references.utils import RIGHTS, ReferenceSourceData, reference_values
from virtool.storage.protocol import StorageBackend
from virtool.tasks.progress import (
    AccumulatingProgressHandlerWrapper,
    TaskProgressHandler,
)
from virtool.tasks.transforms import AttachTaskTransform
from virtool.types import Document
from virtool.uploads.sql import SQLUpload
from virtool.users.pg import SQLUser
from virtool.users.transforms import AttachUserTransform

REFERENCE_UPDATE_COLUMNS = frozenset(
    {"name", "description", "organism", "restrict_source_types", "source_types"},
)
"""``UpdateReferenceRequest`` fields that map to ``legacy_references`` columns.

Acts as an allowlist so only these fields are mirrored to Postgres on update.
"""


class ReferencesData(DataLayerDomain):
    name = "references"

    def __init__(
        self,
        mongo: Mongo,
        pg: AsyncEngine,
        config: Config,
        client: ClientSession,
        storage: StorageBackend,
    ):
        self._mongo = mongo
        self._pg = pg
        self._config = config
        self._client = client
        self._storage = storage

    async def _require_not_archived(self, ref_id: str) -> None:
        document = await self._mongo.references.find_one(
            {"_id": ref_id},
            {"archived": 1},
        )

        if document is None:
            raise ResourceNotFoundError()

        if document.get("archived"):
            raise ResourceConflictError("Reference is archived")

    async def _extend_user(self, user: Document) -> Document:
        """Extend a user document with additional data from PostgreSQL.

        :param user: the user document to extend
        :return: the extended user document
        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                select(SQLUser.id, SQLUser.handle, SQLUser.legacy_id).where(
                    SQLUser.id == user["id"],
                ),
            )

            user_row = result.first()

            if user_row is None:
                raise KeyError(f"User {user['id']} not found")

            return {
                **user,
                "id": user_row.id,
                "handle": user_row.handle,
            }

    async def find(
        self,
        find: str,
        user_id: int,
        administrator: bool,
        groups: list[int | str],
        page: int,
        per_page: int,
        archived: bool | None = None,
    ) -> ReferenceSearchResult:
        """Find references."""
        mongo_query = {**compose_archived_filter(archived)}

        if find:
            mongo_query = {
                **mongo_query,
                **compose_regex_query(find, ["name", "data_type"]),
            }

        base_query = compose_rights_filter(user_id, administrator, groups)

        data = await paginate(
            self._mongo.references,
            mongo_query,
            page,
            per_page,
            sort="name",
            base_query=base_query,
        )

        documents = [
            await processor(self._mongo, self._pg, document)
            for document in data["documents"]
        ]

        documents = await apply_transforms(
            documents,
            [
                AttachUserTransform(self._pg),
                AttachImportedFromTransform(self._mongo, self._pg),
                AttachTaskTransform(self._pg),
            ],
            self._pg,
        )

        return ReferenceSearchResult(
            **{
                **data,
                "documents": documents,
            },
        )

    @emits(Operation.CREATE)
    async def create(self, data: CreateReferenceRequest, user_id: int) -> Reference:
        settings = await self.data.settings.get_all()

        if data.clone_from:
            if not await self._mongo.references.count_documents(
                {"_id": data.clone_from},
            ):
                raise ResourceNotFoundError("Source reference does not exist")

            manifest = await get_manifest(self._mongo, data.clone_from)

            document = await virtool.references.db.create_clone(
                self._mongo,
                settings,
                data.name,
                data.clone_from,
                data.description,
                user_id,
            )

            context = {
                "created_at": document["created_at"],
                "manifest": manifest,
                "ref_id": document["_id"],
                "user_id": user_id,
            }

            task = await self.data.tasks.create(CloneReferenceTask, context=context)

            document["task"] = {"id": task.id}

        elif data.import_from:
            upload = await get_row_by_id(self._pg, SQLUpload, data.import_from)

            if not upload:
                raise ResourceNotFoundError("File not found")

            document = await virtool.references.db.create_import(
                self._mongo,
                settings,
                data.name,
                data.description,
                upload.id,
                user_id,
                data.data_type,
                data.organism,
            )

            context = {
                "created_at": document["created_at"],
                "name_on_disk": upload.name_on_disk,
                "ref_id": document["_id"],
                "user_id": user_id,
            }

            task = await self.data.tasks.create(ImportReferenceTask, context=context)

            document["task"] = {"id": task.id}

        else:
            document = await virtool.references.db.create_document(
                self._mongo,
                settings,
                data.name,
                data.organism,
                data.description,
                data.data_type,
                created_at=virtool.utils.timestamp(),
                user_id=user_id,
            )

        async def persist(mongo_session, pg_session) -> None:
            await self._mongo.references.insert_one(document, session=mongo_session)
            await self._write_legacy_reference(pg_session, document)

        await retry_both_transactions(self._mongo, self._pg, persist)

        return await self.get(document["_id"])

    async def _write_legacy_reference(
        self,
        pg_session: AsyncSession,
        document: Document,
    ) -> None:
        """Insert a ``legacy_references`` row and its seeded rights from a Mongo
        reference ``document`` into the open Postgres session.

        ``cloned_from`` holds the source reference's legacy id, which is resolved
        to its Postgres primary key. If the source has no Postgres row yet, the
        foreign key is left ``NULL`` for the backfill to fill in later.
        """
        cloned_from = document.get("cloned_from")

        cloned_from_id = None

        if cloned_from is not None:
            cloned_from_id = (
                await pg_session.execute(
                    select(SQLReference.id).where(
                        compose_legacy_id_single_expression(
                            SQLReference,
                            cloned_from["id"],
                        ),
                    ),
                )
            ).scalar_one_or_none()

        user = document.get("user")
        imported_from = document.get("imported_from")
        task = document.get("task")

        reference = SQLReference(
            **reference_values(
                document,
                user_id=user["id"] if user else None,
                upload_id=imported_from["id"] if imported_from else None,
                cloned_from_id=cloned_from_id,
                task_id=task["id"] if task else None,
            ),
        )

        pg_session.add(reference)

        await pg_session.flush()

        for member in document.get("users", []):
            pg_session.add(
                SQLReferenceUser(
                    reference_id=reference.id,
                    user_id=member["id"],
                    build=member.get("build", False),
                    modify=member.get("modify", False),
                    modify_otu=member.get("modify_otu", False),
                ),
            )

        for member in document.get("groups", []):
            pg_session.add(
                SQLReferenceGroup(
                    reference_id=reference.id,
                    group_id=member["id"],
                    build=member.get("build", False),
                    modify=member.get("modify", False),
                    modify_otu=member.get("modify_otu", False),
                ),
            )

    async def _resolve_reference_pk(
        self,
        pg_session: AsyncSession,
        ref_id: str,
    ) -> int | None:
        """Resolve a reference's Postgres primary key from its legacy id.

        Returns ``None`` when the reference has no Postgres row yet, signalling
        that the rights write should be skipped for the backfill to reconcile.
        """
        return (
            await pg_session.execute(
                select(SQLReference.id).where(
                    compose_legacy_id_single_expression(SQLReference, ref_id),
                ),
            )
        ).scalar_one_or_none()

    @staticmethod
    async def _upsert_reference_rights(
        pg_session: AsyncSession,
        model: type,
        member_column: str,
        reference_pk: int,
        member_id: int,
        rights: dict,
    ) -> None:
        """Upsert a reference rights child row on its composite key."""
        await pg_session.execute(
            pg_insert(model)
            .values(
                reference_id=reference_pk,
                **{member_column: member_id},
                **rights,
            )
            .on_conflict_do_update(
                index_elements=["reference_id", member_column],
                set_=rights,
            ),
        )

    @staticmethod
    async def _delete_reference_rights(
        pg_session: AsyncSession,
        model: type,
        member_column: str,
        reference_pk: int,
        member_id: int,
    ) -> None:
        """Delete a reference rights child row by its composite key."""
        await pg_session.execute(
            delete(model).where(
                model.reference_id == reference_pk,
                getattr(model, member_column) == member_id,
            ),
        )

    async def get(self, ref_id: str) -> Reference:
        """Get a reference."""
        document = await self._mongo.references.find_one(ref_id)

        if not document:
            raise ResourceNotFoundError

        (
            contributors,
            latest_build,
            otu_count,
            groups,
            users,
            unbuilt_count,
        ) = await asyncio.gather(
            get_contributors(self._pg, ref_id),
            get_latest_build(self._mongo, self._pg, ref_id),
            get_otu_count(self._mongo, ref_id),
            get_reference_groups(self._pg, document),
            get_reference_users(self._mongo, self._pg, document),
            get_unbuilt_count(self._pg, ref_id),
        )

        document.update(
            {
                "contributors": contributors,
                "groups": groups,
                "latest_build": latest_build,
                "otu_count": otu_count,
                "unbuilt_change_count": unbuilt_count,
                "users": users,
            },
        )

        document = await apply_transforms(
            document,
            [AttachUserTransform(self._pg), AttachTaskTransform(self._pg)],
            self._pg,
        )

        document = await apply_transforms(
            document,
            [AttachImportedFromTransform(self._mongo, self._pg)],
            self._pg,
        )

        for user in document["users"]:
            if "created_at" not in user:
                user["created_at"] = document["created_at"]

        return Reference(**document)

    @emits(Operation.UPDATE)
    async def update(self, ref_id: str, data: UpdateReferenceRequest) -> Reference:
        """Update a reference."""
        await self._require_not_archived(ref_id)

        document = await self._mongo.references.find_one(ref_id)

        if document is None:
            raise ResourceNotFoundError()

        data = data.dict(exclude_unset=True)

        scalars = {key: data[key] for key in REFERENCE_UPDATE_COLUMNS if key in data}

        async with both_transactions(self._mongo, self._pg) as (
            mongo_session,
            pg_session,
        ):
            await self._mongo.references.update_one(
                {"_id": ref_id},
                {"$set": data},
                session=mongo_session,
            )

            if scalars:
                await pg_session.execute(
                    update(SQLReference)
                    .where(SQLReference.legacy_id == ref_id)
                    .values(**scalars),
                )

        return await self.get(ref_id)

    async def _set_archived(self, ref_id: str, archived: bool) -> None:
        """Dual-write the ``archived`` flag for a reference.

        The Postgres statement matches by ``legacy_id`` and is a no-op when the
        reference has no Postgres row yet, leaving it for the backfill to create.
        """
        async with both_transactions(self._mongo, self._pg) as (
            mongo_session,
            pg_session,
        ):
            await self._mongo.references.update_one(
                {"_id": ref_id},
                {"$set": {"archived": archived}},
                session=mongo_session,
            )

            await pg_session.execute(
                update(SQLReference)
                .where(SQLReference.legacy_id == ref_id)
                .values(archived=archived),
            )

    @emits(Operation.UPDATE)
    async def archive(self, ref_id: str) -> Reference:
        """Archive a reference."""
        document = await self._mongo.references.find_one(ref_id)

        if document is None:
            raise ResourceNotFoundError()

        if not document.get("archived", False):
            await self._set_archived(ref_id, True)

        return await self.get(ref_id)

    @emits(Operation.UPDATE)
    async def unarchive(self, ref_id: str) -> Reference:
        """Unarchive a reference."""
        document = await self._mongo.references.find_one(ref_id)

        if document is None:
            raise ResourceNotFoundError()

        if document.get("archived", False):
            await self._set_archived(ref_id, False)

        return await self.get(ref_id)

    async def find_otus(
        self,
        term: str | None,
        verified: bool | None,
        ref_id: str | None,
        page: int,
        per_page: int,
    ) -> OTUSearchResult:
        if await virtool.mongo.utils.id_exists(self._mongo.references, ref_id):
            data = await virtool.otus.db.find(
                self._mongo,
                self._pg,
                term,
                page,
                per_page,
                verified,
                ref_id,
            )

            return OTUSearchResult(**data)

        raise ResourceNotFoundError()

    @emits(Operation.CREATE, domain="otus", name="create")
    async def create_otu(
        self,
        ref_id: str,
        data: CreateOTURequest,
        user_id: int,
    ) -> OTU:
        await self._require_not_archived(ref_id)

        # Check if either the name or abbreviation are already in use. Send a ``400`` if
        # they are.
        if message := await virtool.otus.db.check_name_and_abbreviation(
            self._mongo,
            ref_id,
            data.name,
            data.abbreviation,
        ):
            raise ResourceError(message)

        otu = await self.data.otus.create(ref_id, data, user_id=user_id)

        return otu

    async def find_history(
        self,
        ref_id: str,
        unbuilt: bool | None,
        page: int,
        per_page: int,
    ) -> HistorySearchResult:
        if not await self._mongo.references.count_documents({"_id": ref_id}):
            raise ResourceNotFoundError()

        data = await virtool.history.db.find(
            self._mongo,
            self._pg,
            page,
            per_page,
            reference_id=ref_id,
            unbuilt=unbuilt,
        )

        return HistorySearchResult(**data)

    async def find_indexes(
        self, ref_id: str, page: int, per_page: int
    ) -> IndexSearchResult:
        if not await virtool.mongo.utils.id_exists(self._mongo.references, ref_id):
            raise ResourceNotFoundError()

        data = await virtool.indexes.db.find(
            self._mongo, self._pg, page, per_page, ref_id=ref_id
        )

        return IndexSearchResult(**data)

    @emits(Operation.CREATE, domain="indexes", name="create")
    async def create_index(self, ref_id: str, req, user_id: int) -> IndexMinimal:
        if not await virtool.references.db.check_right(req, ref_id, "build"):
            raise APIInsufficientRights()

        await self._require_not_archived(ref_id)

        if await self._mongo.indexes.count_documents(
            {"reference.id": ref_id, "ready": False},
            limit=1,
        ):
            raise ResourceConflictError("Index build already in progress")

        if await self._mongo.otus.count_documents(
            {"reference.id": ref_id, "verified": False},
            limit=1,
        ):
            raise ResourceError("There are unverified OTUs")

        async with AsyncSession(self._pg) as session:
            has_unbuilt = await session.scalar(
                select(
                    select(SQLLegacyHistory.id)
                    .where(
                        SQLLegacyHistory.reference == ref_id,
                        SQLLegacyHistory.index.is_(None),
                    )
                    .exists(),
                ),
            )

        if not has_unbuilt:
            raise ResourceError("There are no unbuilt changes")

        index_id = await virtool.mongo.utils.get_new_id(self._mongo.indexes)

        job = await self.data.jobs.create(
            "build_index",
            {"index_id": index_id},
            user_id,
            0,
        )

        document = await virtool.indexes.db.create(
            self._mongo,
            self._pg,
            ref_id,
            user_id,
            job.id,
            index_id=index_id,
        )

        return await self.data.index.get(document["_id"])

    async def list_groups(self, ref_id: str) -> list[ReferenceGroup]:
        """List all groups that have access to the reference.

        :param ref_id: the id of the reference
        :raises ResourceNotFoundError: if the reference does not exist
        :return: a list of reference users
        """
        groups = await virtool.mongo.utils.get_one_field(
            self._mongo.references,
            "groups",
            ref_id,
        )

        if groups:
            return [ReferenceGroup(**group) for group in groups]

        raise ResourceNotFoundError

    async def create_group(
        self,
        ref_id: str,
        data: CreateReferenceGroupRequest,
    ) -> ReferenceGroup:
        """Create a reference group.

        This gives controlled access to the reference for an existing instance group.

        :param ref_id: the id of the reference
        :param data: the creation request data
        :return: the new reference griyo
        """
        document = await self._mongo.references.find_one(ref_id, ["groups"])

        if document is None:
            raise ResourceNotFoundError()

        async with AsyncSession(self._pg) as session:
            group = await session.get(SQLGroup, data.group_id)

            if group is None:
                raise ResourceConflictError("Group does not exist")

            if {group.id, group.legacy_id} & {g["id"] for g in document["groups"]}:
                raise ResourceConflictError("Group already exists")

        created_at = virtool.utils.timestamp()

        rights = {
            "build": data.build or False,
            "modify": data.modify or False,
            "modify_otu": data.modify_otu or False,
        }

        reference_group = {
            "id": group.id,
            "created_at": created_at,
            "legacy_id": group.legacy_id,
            **rights,
        }

        async with both_transactions(self._mongo, self._pg) as (
            mongo_session,
            pg_session,
        ):
            await self._mongo.references.update_one(
                {"_id": ref_id},
                {"$push": {"groups": reference_group}},
                session=mongo_session,
            )

            reference_pk = await self._resolve_reference_pk(pg_session, ref_id)

            if reference_pk is not None:
                await self._upsert_reference_rights(
                    pg_session,
                    SQLReferenceGroup,
                    "group_id",
                    reference_pk,
                    group.id,
                    rights,
                )

        reference = await self.get(ref_id)

        emit(reference, "references", "create_group", Operation.UPDATE)

        for group in reference.groups:
            if group.id == data.group_id:
                return group

        raise ValueError("Reference does not contain expected group.")

    async def get_group(self, ref_id: str, group_id: int | str) -> ReferenceGroup:
        """Get a reference group by the reference and group ids.

        :param ref_id: the id of the reference
        :param group_id: the id of the group

        """
        groups = await get_one_field(
            self._mongo.references,
            "groups",
            {"_id": ref_id, "groups.id": group_id},
        )

        if groups is None:
            raise ResourceNotFoundError()

        for group in groups:
            if group["id"] == group_id:
                return ReferenceGroup(**group)

        raise ResourceNotFoundError()

    async def update_group(
        self,
        ref_id: str,
        group_id: int | str,
        data: ReferenceRightsRequest,
    ) -> ReferenceGroup:
        document = await self._mongo.references.find_one(
            {"_id": ref_id, "groups.id": group_id},
            ["groups", "users"],
        )

        if document is None:
            raise ResourceNotFoundError()

        data = data.dict(exclude_unset=True)

        for group in document["groups"]:
            if group["id"] == group_id:
                group.update({key: data.get(key, group[key]) for key in RIGHTS})

                rights = {key: group[key] for key in RIGHTS}

                async with AsyncSession(self._pg) as session:
                    row = (
                        await session.execute(
                            select(SQLGroup).where(
                                compose_legacy_id_single_expression(
                                    SQLGroup,
                                    group_id,
                                ),
                            ),
                        )
                    ).scalar_one()

                async with both_transactions(self._mongo, self._pg) as (
                    mongo_session,
                    pg_session,
                ):
                    await self._mongo.references.update_one(
                        {"_id": ref_id},
                        {"$set": {"groups": document["groups"]}},
                        session=mongo_session,
                    )

                    reference_pk = await self._resolve_reference_pk(pg_session, ref_id)

                    if reference_pk is not None:
                        await self._upsert_reference_rights(
                            pg_session,
                            SQLReferenceGroup,
                            "group_id",
                            reference_pk,
                            row.id,
                            rights,
                        )

                emit(
                    await self.get(ref_id),
                    "references",
                    "update_group",
                    Operation.UPDATE,
                )

                return ReferenceGroup(
                    **{
                        **group,
                        "id": row.id,
                        "legacy_id": row.legacy_id,
                        "name": row.name,
                    },
                )

        raise ResourceNotFoundError()

    async def delete_group(self, ref_id: str, group_id: int | str) -> None:
        document = await self._mongo.references.find_one(
            {"_id": ref_id, "groups.id": group_id},
            ["groups", "users"],
        )

        if document is None:
            raise ResourceNotFoundError()

        async with AsyncSession(self._pg) as session:
            group_pk = (
                await session.execute(
                    select(SQLGroup.id).where(
                        compose_legacy_id_single_expression(SQLGroup, group_id),
                    ),
                )
            ).scalar_one_or_none()

        async with both_transactions(self._mongo, self._pg) as (
            mongo_session,
            pg_session,
        ):
            await self._mongo.references.update_one(
                {"_id": ref_id},
                {
                    "$set": {
                        "groups": [
                            g for g in document["groups"] if g["id"] != group_id
                        ],
                    },
                },
                session=mongo_session,
            )

            reference_pk = await self._resolve_reference_pk(pg_session, ref_id)

            if reference_pk is not None and group_pk is not None:
                await self._delete_reference_rights(
                    pg_session,
                    SQLReferenceGroup,
                    "group_id",
                    reference_pk,
                    group_pk,
                )

        emit(await self.get(ref_id), "references", "delete_group", Operation.UPDATE)

    async def create_user(
        self,
        ref_id: str,
        data: CreateReferenceUserRequest,
    ) -> ReferenceUser:
        """Create a reference user.

        These gives controlled access to a reference for an existing instance user.

        :param data: the request data
        :param ref_id: the id of the reference
        """
        document = await self._mongo.references.find_one({"_id": ref_id}, ["users"])

        if not document:
            raise ResourceNotFoundError()

        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                select(SQLUser.id, SQLUser.handle, SQLUser.legacy_id).where(
                    SQLUser.id == data.user_id,
                ),
            )
            user_row = result.first()

            if user_row is None:
                raise ResourceConflictError("User does not exist")

            existing_user_ids = {u["id"] for u in document["users"]}
            if user_row.id in existing_user_ids:
                raise ResourceConflictError("User already exists")

        created_at = virtool.utils.timestamp()

        rights = {
            "build": data.build or False,
            "modify": data.modify or False,
            "modify_otu": data.modify_otu or False,
        }

        reference_user = {"id": user_row.id, "created_at": created_at, **rights}

        async with both_transactions(self._mongo, self._pg) as (
            mongo_session,
            pg_session,
        ):
            await self._mongo.references.update_one(
                {"_id": ref_id},
                {"$push": {"users": reference_user}},
                session=mongo_session,
            )

            reference_pk = await self._resolve_reference_pk(pg_session, ref_id)

            if reference_pk is not None:
                await self._upsert_reference_rights(
                    pg_session,
                    SQLReferenceUser,
                    "user_id",
                    reference_pk,
                    user_row.id,
                    rights,
                )

        emit(await self.get(ref_id), "references", "create_user", Operation.UPDATE)

        return ReferenceUser(**await self._extend_user(reference_user))

    async def update_user(
        self,
        ref_id: str,
        user_id: int,
        data: ReferenceRightsRequest,
    ) -> ReferenceUser:
        """Update a reference user."""
        document = await self._mongo.references.find_one(
            {"_id": ref_id, "users.id": user_id},
            ["users"],
        )

        if document is None:
            raise ResourceNotFoundError()

        data = data.dict(exclude_unset=True)

        for user in document["users"]:
            if user["id"] == user_id:
                user.update({key: data.get(key, user[key]) for key in RIGHTS})

                rights = {key: user[key] for key in RIGHTS}

                async with both_transactions(self._mongo, self._pg) as (
                    mongo_session,
                    pg_session,
                ):
                    await self._mongo.references.update_one(
                        {"_id": ref_id},
                        {"$set": {"users": document["users"]}},
                        session=mongo_session,
                    )

                    reference_pk = await self._resolve_reference_pk(pg_session, ref_id)

                    if reference_pk is not None:
                        await self._upsert_reference_rights(
                            pg_session,
                            SQLReferenceUser,
                            "user_id",
                            reference_pk,
                            user_id,
                            rights,
                        )

                emit(
                    await self.get(ref_id),
                    "references",
                    "update_user",
                    Operation.UPDATE,
                )

                return ReferenceUser(**await self._extend_user(user))

        raise ResourceNotFoundError()

    async def delete_user(self, ref_id: str, user_id: int) -> None:
        """Delete a reference user.

        :param ref_id: the id of the reference
        :param user_id: the id of the user to delete

        """
        document = await self._mongo.references.find_one(
            {"_id": ref_id, "users.id": user_id},
            ["groups", "users"],
        )

        if document is None:
            raise ResourceNotFoundError

        filtered_users = [user for user in document["users"] if user["id"] != user_id]

        async with both_transactions(self._mongo, self._pg) as (
            mongo_session,
            pg_session,
        ):
            await self._mongo.references.update_one(
                {"_id": ref_id},
                {"$set": {"users": filtered_users}},
                session=mongo_session,
            )

            reference_pk = await self._resolve_reference_pk(pg_session, ref_id)

            if reference_pk is not None:
                await self._delete_reference_rights(
                    pg_session,
                    SQLReferenceUser,
                    "user_id",
                    reference_pk,
                    user_id,
                )

        emit(await self.get(ref_id), "references", "delete_user", Operation.UPDATE)

    async def populate_cloned_reference(
        self,
        manifest: dict[str, int],
        ref_id: str,
        user_id: int,
        progress_handler: TaskProgressHandler,
    ) -> None:
        """Populate a reference with the data from another reference."""
        count = len(manifest)

        # Some extra progress for inserting new documents.
        headroom = int(count * 0.3)

        tracker = AccumulatingProgressHandlerWrapper(progress_handler, count + headroom)

        created_at = await get_one_field(self._mongo.references, "created_at", ref_id)

        otus = []

        for source_otu_id, version in manifest.items():
            _, patched, _ = await patch_to_version(
                self._mongo,
                self._pg,
                source_otu_id,
                version,
            )

            otus.append(patched)

            await tracker.add(1)

        await populate_insert_only_reference(
            created_at,
            HistoryMethod.clone,
            self._mongo,
            self._pg,
            otus,
            ref_id,
            user_id,
        )

        await tracker.add(headroom)

        emit(
            await self.get(ref_id),
            "references",
            "populate_cloned_reference",
            Operation.UPDATE,
        )

    async def populate_imported_reference(
        self,
        ref_id: str,
        user_id: int,
        data: ReferenceSourceData,
        progress_handler: TaskProgressHandler,
    ) -> None:
        created_at = await get_one_field(self._mongo.references, "created_at", ref_id)

        tracker = AccumulatingProgressHandlerWrapper(
            progress_handler,
            3,
        )

        await self._mongo.references.update_one(
            {"_id": ref_id},
            {
                "$set": {
                    "data_type": data.data_type,
                    "organism": data.organism,
                },
            },
        )

        await tracker.add(1)

        insertions = [
            prepare_otu_insertion(
                created_at,
                HistoryMethod.import_otu,
                otu.dict(by_alias=True),
                ref_id,
                user_id,
            )
            for otu in data.otus
        ]

        diff_rows = [
            {"change_id": insertion.history.id, "diff": insertion.history.diff}
            for insertion in insertions
        ]

        await bulk_insert_history(
            self._pg,
            diff_rows,
            [insertion.history.document for insertion in insertions],
        )

        await tracker.add(1)

        try:
            sequences = []

            for insertion in insertions:
                sequences.extend(insertion.sequences)

            async with asyncio.TaskGroup() as tg:
                tg.create_task(
                    self._mongo.otus.insert_many(
                        [insertion.otu for insertion in insertions],
                        None,
                    ),
                )
                tg.create_task(
                    self._mongo.sequences.insert_many(sequences, None),
                )
        except Exception:
            await bulk_delete_history(self._pg, [row["change_id"] for row in diff_rows])

            await asyncio.gather(
                self._mongo.sequences.delete_many({"reference.id": ref_id}),
                self._mongo.otus.delete_many({"reference.id": ref_id}),
            )

            await self._mongo.references.delete_one({"_id": ref_id})
            raise

        await tracker.add(1)

        emit(
            await self.get(ref_id),
            "references",
            "populate_imported_reference",
            Operation.UPDATE,
        )
