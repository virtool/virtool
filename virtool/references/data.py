import asyncio
import math
from datetime import datetime

from aiohttp import ClientSession
from sqlalchemy import ColumnExpressionArgument, delete, func, or_, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.history.db
import virtool.indexes.db
import virtool.otus.db
import virtool.tasks.db
import virtool.utils
from virtool.config import Config
from virtool.data.domain import DataLayerDomain
from virtool.data.errors import (
    ResourceConflictError,
    ResourceError,
    ResourceNotFoundError,
)
from virtool.data.events import Operation, emit, emits
from virtool.data.topg import (
    compose_legacy_id_multi_expression,
    compose_legacy_id_single_expression,
    compose_legacy_id_subquery,
    resolve_legacy_id,
)
from virtool.data.transforms import apply_transforms
from virtool.groups.pg import SQLGroup
from virtool.history.db import (
    patch_to_version,
)
from virtool.history.models import HistorySearchResult
from virtool.history.sql import SQLLegacyHistory
from virtool.indexes.models import IndexMinimal, IndexSearchResult
from virtool.indexes.sql import SQLIndex
from virtool.indexes.tasks import CreateIndexTask
from virtool.models.enums import HistoryMethod
from virtool.otus.models import OTU, OTUSearchResult
from virtool.otus.oas import CreateOTURequest
from virtool.otus.sql import SQLOTU
from virtool.pg.utils import get_row_by_id
from virtool.references.db import (
    get_cloned_from_lookup,
    get_contributors,
    get_latest_builds,
    get_manifest,
    get_otu_count,
    get_reference_groups,
    get_reference_users,
    get_unbuilt_count,
    map_reference_minimal,
    populate_insert_only_reference,
    processor,
    write_legacy_reference,
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
from virtool.references.utils import RIGHTS, ReferenceSourceData
from virtool.storage.protocol import StorageBackend
from virtool.tasks.progress import (
    AccumulatingProgressHandlerWrapper,
    TaskProgressHandler,
)
from virtool.tasks.sql import SQLTask
from virtool.tasks.transforms import AttachTaskTransform
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
        pg: AsyncEngine,
        config: Config,
        client: ClientSession,
        storage: StorageBackend,
    ):
        self._pg = pg
        self._config = config
        self._client = client
        self._storage = storage

    async def _resolve_reference_id(self, ref_id: int | str) -> int:
        """Resolve a public reference id (integer PK or legacy string) to its PK.

        :param ref_id: the primary key or legacy id of the reference
        :return: the primary key of the reference
        """
        async with AsyncSession(self._pg) as session:
            reference_pk = await session.scalar(
                select(SQLReference.id).where(
                    compose_legacy_id_single_expression(SQLReference, ref_id),
                ),
            )

        if reference_pk is None:
            raise ResourceNotFoundError()

        return reference_pk

    async def _require_exists(self, ref_id: int | str | None) -> None:
        """Raise ``ResourceNotFoundError`` unless a reference exists.

        A ``None`` id never matches. Passing it to the legacy id expression would
        otherwise match any Postgres-native reference, whose ``legacy_id`` is ``NULL``.

        :param ref_id: the primary key or legacy id of the reference
        """
        if ref_id is None:
            raise ResourceNotFoundError()

        async with AsyncSession(self._pg) as session:
            reference_pk = await session.scalar(
                select(SQLReference.id).where(
                    compose_legacy_id_single_expression(SQLReference, ref_id),
                ),
            )

        if reference_pk is None:
            raise ResourceNotFoundError()

    async def _get_archived(self, ref_id: int | str) -> bool:
        """Return the ``archived`` flag of a reference.

        :param ref_id: the primary key or legacy id of the reference
        :return: whether the reference is archived
        """
        async with AsyncSession(self._pg) as session:
            row = (
                await session.execute(
                    select(SQLReference.archived).where(
                        compose_legacy_id_single_expression(SQLReference, ref_id),
                    ),
                )
            ).first()

        if row is None:
            raise ResourceNotFoundError()

        return row.archived

    async def _require_not_archived(self, ref_id: int | str) -> None:
        if await self._get_archived(ref_id):
            raise ResourceConflictError("Reference is archived")

    async def check_right(
        self,
        ref_id: int | str,
        right: str,
        *,
        user_id: int | None,
        group_ids: list[int],
        administrator: bool,
    ) -> bool:
        """Check whether a user has a right on a reference.

        A full administrator is granted any right without a database lookup, even
        against a reference that does not exist.

        Otherwise, membership alone grants ``read``; any other right requires an entry
        that carries the right flag. A user entry does not short-circuit: a group can
        grant a right the user's own entry lacks.

        The caller extracts ``user_id``, ``group_ids``, and ``administrator`` from the
        request client; this method owns only the resulting grant decision.

        :param ref_id: the primary key or legacy id of the reference
        :param right: the right to check (``read``, ``build``, ``modify``, ``modify_otu``)
        :param user_id: the id of the requesting user, or ``None`` for a client with no user
        :param group_ids: the ids of the groups the user belongs to
        :param administrator: whether the requesting client is a full administrator
        :return: whether the right is granted
        :raises ResourceNotFoundError: if the reference does not exist
        """
        if administrator:
            return True

        async with AsyncSession(self._pg) as session:
            reference_pk = await session.scalar(
                select(SQLReference.id).where(
                    compose_legacy_id_single_expression(SQLReference, ref_id),
                ),
            )

            if reference_pk is None:
                raise ResourceNotFoundError

            if user_id is not None:
                user_query = select(SQLReferenceUser.reference_id).where(
                    SQLReferenceUser.reference_id == reference_pk,
                    SQLReferenceUser.user_id == user_id,
                )

                if right != "read":
                    user_query = user_query.where(
                        getattr(SQLReferenceUser, right).is_(True),
                    )

                if await session.scalar(user_query.limit(1)) is not None:
                    return True

            if group_ids:
                group_query = select(SQLReferenceGroup.reference_id).where(
                    SQLReferenceGroup.reference_id == reference_pk,
                    SQLReferenceGroup.group_id.in_(group_ids),
                )

                if right != "read":
                    group_query = group_query.where(
                        getattr(SQLReferenceGroup, right).is_(True),
                    )

                if await session.scalar(group_query.limit(1)) is not None:
                    return True

        return False

    async def _get_created_at(self, ref_id: int | str) -> datetime:
        """Return the ``created_at`` timestamp of a reference.

        :param ref_id: the primary key or legacy id of the reference
        :return: the reference's creation timestamp
        """
        async with AsyncSession(self._pg) as session:
            created_at = await session.scalar(
                select(SQLReference.created_at).where(
                    compose_legacy_id_single_expression(SQLReference, ref_id),
                ),
            )

        if created_at is None:
            raise ResourceNotFoundError

        return created_at

    async def _resolve_group_ids(self, groups: list[int | str]) -> list[int]:
        """Resolve the Postgres primary keys for ``groups``.

        ``groups`` are the requesting client's group memberships, which may be legacy
        Mongo string ids or integer primary keys during the migration.
        """
        if not groups:
            return []

        async with AsyncSession(self._pg) as session:
            return list(
                (
                    await session.execute(
                        select(SQLGroup.id).where(
                            compose_legacy_id_multi_expression(SQLGroup, groups),
                        ),
                    )
                )
                .scalars()
                .all(),
            )

    async def _compose_rights_filter(
        self,
        user_id: int,
        groups: list[int | str],
    ) -> ColumnExpressionArgument[bool]:
        """Compose the Postgres predicate scoping references to those the user can read.

        Mirrors the Mongo ``$or`` rights filter: the requesting user owns the
        reference, is granted direct user rights, or belongs to a group that is
        granted rights.
        """
        clauses = [
            SQLReference.user_id == user_id,
            SQLReference.id.in_(
                select(SQLReferenceUser.reference_id).where(
                    SQLReferenceUser.user_id == user_id,
                ),
            ),
        ]

        group_ids = await self._resolve_group_ids(groups)

        if group_ids:
            clauses.append(
                SQLReference.id.in_(
                    select(SQLReferenceGroup.reference_id).where(
                        SQLReferenceGroup.group_id.in_(group_ids),
                    ),
                ),
            )

        return or_(*clauses)

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
        base_filters: list[ColumnExpressionArgument[bool]] = []

        if not administrator:
            base_filters.append(await self._compose_rights_filter(user_id, groups))

        search_filters = list(base_filters)

        if archived is not None:
            search_filters.append(SQLReference.archived.is_(archived))

        if find:
            escaped = find.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            search_filters.append(
                SQLReference.name.ilike(f"%{escaped}%", escape="\\"),
            )

        async with AsyncSession(self._pg) as session:
            total_count = await session.scalar(
                select(func.count()).select_from(SQLReference).where(*base_filters),
            )

            found_count = await session.scalar(
                select(func.count()).select_from(SQLReference).where(*search_filters),
            )

            rows = (
                (
                    await session.execute(
                        select(SQLReference)
                        .where(*search_filters)
                        .order_by(SQLReference.name, SQLReference.id)
                        .offset(per_page * (page - 1))
                        .limit(per_page),
                    )
                )
                .scalars()
                .all()
            )

            cloned_from_lookup = await get_cloned_from_lookup(session, rows)

        latest_builds = await get_latest_builds(self._pg, [row.id for row in rows])

        documents = [
            await processor(
                self._pg,
                row,
                cloned_from_lookup.get(row.cloned_from_id),
                latest_builds[row.id],
            )
            for row in rows
        ]

        documents = await apply_transforms(
            documents,
            [
                AttachUserTransform(self._pg),
                AttachImportedFromTransform(self._pg),
                AttachTaskTransform(self._pg),
            ],
            self._pg,
        )

        return ReferenceSearchResult(
            documents=documents,
            found_count=found_count,
            total_count=total_count,
            page=page,
            page_count=int(math.ceil(found_count / per_page)),
            per_page=per_page,
        )

    @emits(Operation.CREATE)
    async def create(self, data: CreateReferenceRequest, user_id: int) -> Reference:
        settings = await self.data.settings.get_all()

        task_class: type | None = None
        context: dict | None = None

        if data.clone_from:
            try:
                clone_from = await self._resolve_reference_id(data.clone_from)
            except ResourceNotFoundError:
                raise ResourceNotFoundError("Source reference does not exist") from None

            manifest = await get_manifest(self._pg, clone_from)

            document = await virtool.references.db.create_clone(
                self._pg,
                settings,
                data.name,
                clone_from,
                data.description,
                user_id,
            )

            task_class = CloneReferenceTask
            context = {
                "manifest": manifest,
                "user_id": user_id,
            }

        elif data.import_from:
            upload = await get_row_by_id(self._pg, SQLUpload, data.import_from)

            if not upload:
                raise ResourceNotFoundError("File not found")

            document = await virtool.references.db.create_import(
                settings,
                data.name,
                data.description,
                upload.id,
                user_id,
                data.data_type,
                data.organism,
            )

            task_class = ImportReferenceTask
            context = {
                "name_on_disk": upload.name_on_disk,
                "user_id": user_id,
            }

        else:
            document = await virtool.references.db.create_document(
                settings,
                data.name,
                data.organism,
                data.description,
                data.data_type,
                created_at=virtool.utils.timestamp(),
                user_id=user_id,
            )

        async with AsyncSession(self._pg) as session:
            reference_pk = await write_legacy_reference(session, document)

            if task_class is not None:
                task = await self.data.tasks.create(
                    task_class,
                    context={**context, "ref_id": reference_pk},
                )

                await session.execute(
                    update(SQLReference)
                    .where(SQLReference.id == reference_pk)
                    .values(task_id=task.id),
                )

            await session.commit()

        return await self.get(reference_pk)

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

    async def get(self, ref_id: int | str) -> Reference:
        """Get a reference."""
        async with AsyncSession(self._pg) as session:
            row = (
                await session.execute(
                    select(SQLReference).where(
                        compose_legacy_id_single_expression(SQLReference, ref_id),
                    ),
                )
            ).scalar_one_or_none()

            if row is None:
                raise ResourceNotFoundError

            cloned_from_lookup = await get_cloned_from_lookup(session, [row])

        (
            contributors,
            latest_builds,
            otu_count,
            groups,
            users,
            unbuilt_count,
        ) = await asyncio.gather(
            get_contributors(self._pg, row.id),
            get_latest_builds(self._pg, [row.id]),
            get_otu_count(self._pg, row.id),
            get_reference_groups(self._pg, row.id, row.created_at),
            get_reference_users(self._pg, row.id, row.created_at),
            get_unbuilt_count(self._pg, row.id),
        )

        document = {
            **map_reference_minimal(row, cloned_from_lookup.get(row.cloned_from_id)),
            "description": row.description,
            "restrict_source_types": row.restrict_source_types,
            "source_types": row.source_types,
            "contributors": contributors,
            "groups": groups,
            "latest_build": latest_builds[row.id],
            "otu_count": otu_count,
            "unbuilt_change_count": unbuilt_count,
            "users": users,
        }

        document = await apply_transforms(
            document,
            [AttachUserTransform(self._pg), AttachTaskTransform(self._pg)],
            self._pg,
        )

        document = await apply_transforms(
            document,
            [AttachImportedFromTransform(self._pg)],
            self._pg,
        )

        return Reference(**document)

    @emits(Operation.UPDATE)
    async def update(
        self, ref_id: int | str, data: UpdateReferenceRequest
    ) -> Reference:
        """Update a reference."""
        await self._require_not_archived(ref_id)

        data = data.dict(exclude_unset=True)

        scalars = {key: data[key] for key in REFERENCE_UPDATE_COLUMNS if key in data}

        if scalars:
            async with AsyncSession(self._pg) as session:
                await session.execute(
                    update(SQLReference)
                    .where(compose_legacy_id_single_expression(SQLReference, ref_id))
                    .values(**scalars),
                )
                await session.commit()

        return await self.get(ref_id)

    async def _set_archived(self, ref_id: int | str, archived: bool) -> None:
        """Set the ``archived`` flag for a reference."""
        async with AsyncSession(self._pg) as session:
            await session.execute(
                update(SQLReference)
                .where(compose_legacy_id_single_expression(SQLReference, ref_id))
                .values(archived=archived),
            )
            await session.commit()

    @emits(Operation.UPDATE)
    async def archive(self, ref_id: int | str) -> Reference:
        """Archive a reference."""
        if not await self._get_archived(ref_id):
            await self._set_archived(ref_id, True)

        return await self.get(ref_id)

    @emits(Operation.UPDATE)
    async def unarchive(self, ref_id: int | str) -> Reference:
        """Unarchive a reference."""
        if await self._get_archived(ref_id):
            await self._set_archived(ref_id, False)

        return await self.get(ref_id)

    async def find_otus(
        self,
        term: str | None,
        verified: bool | None,
        ref_id: int | str | None,
        page: int,
        per_page: int,
    ) -> OTUSearchResult:
        await self._require_exists(ref_id)

        data = await virtool.otus.db.find(
            self._pg,
            term,
            page,
            per_page,
            verified,
            ref_id,
        )

        return OTUSearchResult(**data)

    @emits(Operation.CREATE, domain="otus", name="create")
    async def create_otu(
        self,
        ref_id: int | str,
        data: CreateOTURequest,
        user_id: int,
    ) -> OTU:
        await self._require_not_archived(ref_id)

        # Check if either the name or abbreviation are already in use. Send a ``400`` if
        # they are.
        if message := await virtool.otus.db.check_name_and_abbreviation(
            self._pg,
            ref_id,
            data.name,
            data.abbreviation,
        ):
            raise ResourceError(message)

        otu = await self.data.otus.create(ref_id, data, user_id=user_id)

        return otu

    async def find_history(
        self,
        ref_id: int | str,
        unbuilt: bool | None,
        page: int,
        per_page: int,
    ) -> HistorySearchResult:
        await self._require_exists(ref_id)

        data = await virtool.history.db.find(
            self._pg,
            page,
            per_page,
            reference_id=ref_id,
            unbuilt=unbuilt,
        )

        return HistorySearchResult(**data)

    async def find_indexes(
        self, ref_id: int | str, page: int, per_page: int
    ) -> IndexSearchResult:
        await self._require_exists(ref_id)

        data = await virtool.indexes.db.find(self._pg, page, per_page, ref_id=ref_id)

        return IndexSearchResult(**data)

    @emits(Operation.CREATE, domain="indexes", name="create")
    async def create_index(self, ref_id: int | str, user_id: int) -> IndexMinimal:
        await self._require_not_archived(ref_id)

        async with AsyncSession(self._pg) as session:
            has_in_progress = await session.scalar(
                select(
                    select(SQLIndex.id)
                    .where(
                        SQLIndex.reference_id
                        == compose_legacy_id_subquery(SQLReference, ref_id),
                        SQLIndex.ready.is_(False),
                    )
                    .exists(),
                ),
            )

            if has_in_progress:
                raise ResourceConflictError("Index build already in progress")

            has_unverified = await session.scalar(
                select(
                    select(SQLOTU.id)
                    .where(
                        SQLOTU.reference_id
                        == compose_legacy_id_subquery(SQLReference, ref_id),
                        SQLOTU.verified.is_(False),
                    )
                    .exists(),
                ),
            )

            if has_unverified:
                raise ResourceError("There are unverified OTUs")

            has_unbuilt = await session.scalar(
                select(
                    select(SQLLegacyHistory.id)
                    .where(
                        SQLLegacyHistory.reference_id
                        == compose_legacy_id_subquery(SQLReference, ref_id),
                        SQLLegacyHistory.index_id.is_(None),
                    )
                    .exists(),
                ),
            )

        if not has_unbuilt:
            raise ResourceError("There are no unbuilt changes")

        manifest = await virtool.references.db.get_manifest(self._pg, ref_id)

        try:
            async with AsyncSession(self._pg) as pg_session:
                reference_pk = await resolve_legacy_id(
                    pg_session,
                    SQLReference,
                    ref_id,
                )

                if reference_pk is None:
                    raise ResourceNotFoundError

                # Serialize builds for this reference so version allocation is race
                # free. The pre-transaction guard above can be cleared by two callers
                # at once; the loser then either fails to take the lock, or — if the
                # winner has already committed — takes it and sees the winner's
                # in-progress index on the recheck below. Either way a single build
                # starts, and the ``(reference_id, version)`` unique constraint is the
                # deeper backstop caught in the ``except`` clause. The lock is keyed
                # like ``TasksData.create_periodic`` and released at transaction end.
                locked = await pg_session.scalar(
                    select(
                        func.pg_try_advisory_xact_lock(
                            func.hashtext(f"index_build:{reference_pk}"),
                        ),
                    ),
                )

                if not locked:
                    raise ResourceConflictError("Index build already in progress")

                has_in_progress = await pg_session.scalar(
                    select(
                        select(SQLIndex.id)
                        .where(
                            SQLIndex.reference_id == reference_pk,
                            SQLIndex.ready.is_(False),
                        )
                        .exists(),
                    ),
                )

                if has_in_progress:
                    raise ResourceConflictError("Index build already in progress")

                index_version = await virtool.indexes.db.get_next_version(
                    pg_session,
                    ref_id,
                )

                # The task is created before the index so its id can back the index
                # row, but the index id is minted by Postgres on flush, so the task's
                # context is stamped with it only afterwards.
                task = await virtool.tasks.db.create(pg_session, CreateIndexTask)

                index = await virtool.indexes.db.create(
                    pg_session,
                    ref_id,
                    user_id,
                    index_version,
                    manifest,
                    task_id=task.id,
                )

                # The public id is the integer primary key. It is stored directly in the
                # JSONB task context; ``generate_task_index`` resolves both the integer
                # and the stringified form so tasks created before this cutover still run.
                index_id = index.id

                await pg_session.execute(
                    update(SQLTask)
                    .where(SQLTask.id == task.id)
                    .values(context={"index_id": index_id}),
                )

                await pg_session.commit()
        except IntegrityError as error:
            # Deep backstop: if two builds still allocated the same version, the
            # ``(reference_id, version)`` unique constraint rejects the duplicate.
            raise ResourceConflictError("Index build already in progress") from error

        task.context["index_id"] = index_id

        emit(task, "tasks", "create", Operation.CREATE)

        return await self.data.index.get(index_id)

    async def list_groups(self, ref_id: str) -> list[ReferenceGroup]:
        """List all groups that have access to the reference.

        :param ref_id: the id of the reference
        :raises ResourceNotFoundError: if the reference does not exist
        :return: a list of reference groups
        """
        async with AsyncSession(self._pg) as session:
            reference = (
                await session.execute(
                    select(SQLReference.id, SQLReference.created_at).where(
                        compose_legacy_id_single_expression(SQLReference, ref_id),
                    ),
                )
            ).one_or_none()

            if reference is None:
                raise ResourceNotFoundError

            rows = (
                await session.execute(
                    select(
                        SQLGroup.id,
                        SQLGroup.legacy_id,
                        SQLGroup.name,
                        SQLReferenceGroup.build,
                        SQLReferenceGroup.modify,
                        SQLReferenceGroup.modify_otu,
                    )
                    .join(SQLGroup, SQLGroup.id == SQLReferenceGroup.group_id)
                    .where(SQLReferenceGroup.reference_id == reference.id)
                    .order_by(SQLReferenceGroup.group_id),
                )
            ).all()

        return [
            ReferenceGroup(
                id=row.id,
                legacy_id=row.legacy_id,
                name=row.name,
                build=row.build,
                modify=row.modify,
                modify_otu=row.modify_otu,
                created_at=reference.created_at,
            )
            for row in rows
        ]

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
        rights = {
            "build": data.build or False,
            "modify": data.modify or False,
            "modify_otu": data.modify_otu or False,
        }

        async with AsyncSession(self._pg) as session:
            reference_pk = await session.scalar(
                select(SQLReference.id).where(
                    compose_legacy_id_single_expression(SQLReference, ref_id),
                ),
            )

            if reference_pk is None:
                raise ResourceNotFoundError()

            group = await session.get(SQLGroup, data.group_id)

            if group is None:
                raise ResourceConflictError("Group does not exist")

            if await session.get(SQLReferenceGroup, (reference_pk, group.id)):
                raise ResourceConflictError("Group already exists")

            await self._upsert_reference_rights(
                session,
                SQLReferenceGroup,
                "group_id",
                reference_pk,
                group.id,
                rights,
            )

            await session.commit()

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
        for group in await self.list_groups(ref_id):
            if group_id in (group.id, group.legacy_id):
                return group

        raise ResourceNotFoundError

    async def update_group(
        self,
        ref_id: str,
        group_id: int | str,
        data: ReferenceRightsRequest,
    ) -> ReferenceGroup:
        data = data.dict(exclude_unset=True)

        async with AsyncSession(self._pg) as session:
            reference_pk = await session.scalar(
                select(SQLReference.id).where(
                    compose_legacy_id_single_expression(SQLReference, ref_id),
                ),
            )

            if reference_pk is None:
                raise ResourceNotFoundError()

            group = (
                await session.execute(
                    select(SQLGroup).where(
                        compose_legacy_id_single_expression(SQLGroup, group_id),
                    ),
                )
            ).scalar_one_or_none()

            if group is None:
                raise ResourceNotFoundError()

            reference_group = await session.get(
                SQLReferenceGroup,
                (reference_pk, group.id),
            )

            if reference_group is None:
                raise ResourceNotFoundError()

            rights = {
                key: data.get(key, getattr(reference_group, key)) for key in RIGHTS
            }

            await self._upsert_reference_rights(
                session,
                SQLReferenceGroup,
                "group_id",
                reference_pk,
                group.id,
                rights,
            )

            await session.commit()

        emit(
            await self.get(ref_id),
            "references",
            "update_group",
            Operation.UPDATE,
        )

        return await self.get_group(ref_id, group_id)

    async def delete_group(self, ref_id: str, group_id: int | str) -> None:
        async with AsyncSession(self._pg) as session:
            reference_pk = await session.scalar(
                select(SQLReference.id).where(
                    compose_legacy_id_single_expression(SQLReference, ref_id),
                ),
            )

            if reference_pk is None:
                raise ResourceNotFoundError()

            group_pk = await session.scalar(
                select(SQLGroup.id).where(
                    compose_legacy_id_single_expression(SQLGroup, group_id),
                ),
            )

            if group_pk is None:
                raise ResourceNotFoundError()

            reference_group = await session.get(
                SQLReferenceGroup,
                (reference_pk, group_pk),
            )

            if reference_group is None:
                raise ResourceNotFoundError()

            await self._delete_reference_rights(
                session,
                SQLReferenceGroup,
                "group_id",
                reference_pk,
                group_pk,
            )

            await session.commit()

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
        rights = {
            "build": data.build or False,
            "modify": data.modify or False,
            "modify_otu": data.modify_otu or False,
        }

        async with AsyncSession(self._pg) as session:
            reference_pk = await session.scalar(
                select(SQLReference.id).where(
                    compose_legacy_id_single_expression(SQLReference, ref_id),
                ),
            )

            if reference_pk is None:
                raise ResourceNotFoundError()

            user = await session.get(SQLUser, data.user_id)

            if user is None:
                raise ResourceConflictError("User does not exist")

            if await session.get(SQLReferenceUser, (reference_pk, user.id)):
                raise ResourceConflictError("User already exists")

            await self._upsert_reference_rights(
                session,
                SQLReferenceUser,
                "user_id",
                reference_pk,
                user.id,
                rights,
            )

            await session.commit()

        reference = await self.get(ref_id)

        emit(reference, "references", "create_user", Operation.UPDATE)

        for user in reference.users:
            if user.id == data.user_id:
                return user

        raise ValueError("Reference does not contain expected user.")

    async def update_user(
        self,
        ref_id: str,
        user_id: int,
        data: ReferenceRightsRequest,
    ) -> ReferenceUser:
        """Update a reference user."""
        data = data.dict(exclude_unset=True)

        async with AsyncSession(self._pg) as session:
            reference_pk = await session.scalar(
                select(SQLReference.id).where(
                    compose_legacy_id_single_expression(SQLReference, ref_id),
                ),
            )

            if reference_pk is None:
                raise ResourceNotFoundError()

            reference_user = await session.get(
                SQLReferenceUser,
                (reference_pk, user_id),
            )

            if reference_user is None:
                raise ResourceNotFoundError()

            rights = {
                key: data.get(key, getattr(reference_user, key)) for key in RIGHTS
            }

            await self._upsert_reference_rights(
                session,
                SQLReferenceUser,
                "user_id",
                reference_pk,
                user_id,
                rights,
            )

            await session.commit()

        reference = await self.get(ref_id)

        emit(reference, "references", "update_user", Operation.UPDATE)

        for user in reference.users:
            if user.id == user_id:
                return user

        raise ResourceNotFoundError()

    async def delete_user(self, ref_id: str, user_id: int) -> None:
        """Delete a reference user.

        :param ref_id: the id of the reference
        :param user_id: the id of the user to delete

        """
        async with AsyncSession(self._pg) as session:
            reference_pk = await session.scalar(
                select(SQLReference.id).where(
                    compose_legacy_id_single_expression(SQLReference, ref_id),
                ),
            )

            if reference_pk is None:
                raise ResourceNotFoundError()

            reference_user = await session.get(
                SQLReferenceUser,
                (reference_pk, user_id),
            )

            if reference_user is None:
                raise ResourceNotFoundError()

            await self._delete_reference_rights(
                session,
                SQLReferenceUser,
                "user_id",
                reference_pk,
                user_id,
            )

            await session.commit()

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

        created_at = await self._get_created_at(ref_id)

        otus = []

        for source_otu_id, version in manifest.items():
            _, patched = await patch_to_version(
                self._pg,
                source_otu_id,
                version,
            )

            otus.append(patched)

            await tracker.add(1)

        await populate_insert_only_reference(
            created_at,
            HistoryMethod.clone,
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
        created_at = await self._get_created_at(ref_id)

        tracker = AccumulatingProgressHandlerWrapper(
            progress_handler,
            2,
        )

        async with AsyncSession(self._pg) as session:
            await session.execute(
                update(SQLReference)
                .where(compose_legacy_id_single_expression(SQLReference, ref_id))
                .values(organism=data.organism),
            )
            await session.commit()

        await tracker.add(1)

        await populate_insert_only_reference(
            created_at,
            HistoryMethod.import_otu,
            self._pg,
            [otu.dict(by_alias=True) for otu in data.otus],
            ref_id,
            user_id,
        )

        await tracker.add(1)

        emit(
            await self.get(ref_id),
            "references",
            "populate_imported_reference",
            Operation.UPDATE,
        )
