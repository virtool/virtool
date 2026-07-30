import asyncio
from datetime import datetime
from pathlib import Path

from aiohttp import ClientSession
from pydantic import ValidationError
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.config import Config
from virtool.data.domain import DataLayerDomain
from virtool.data.errors import (
    ResourceNotFoundError,
)
from virtool.data.events import Operation, emit, emits
from virtool.data.topg import (
    compose_legacy_id_single_expression,
)
from virtool.data.transforms import apply_transforms
from virtool.history.db import (
    patch_to_version,
)
from virtool.models.enums import HistoryMethod
from virtool.references.db import (
    get_cloned_from_lookup,
    get_contributors,
    get_latest_builds,
    get_otu_count,
    get_reference_groups,
    get_reference_users,
    get_unbuilt_count,
    map_reference_minimal,
    populate_insert_only_reference,
)
from virtool.references.imports import load_json_import, load_sqlite_import
from virtool.references.models import (
    Reference,
)
from virtool.references.sql import (
    SQLReference,
    SQLReferenceGroup,
    SQLReferenceUser,
)
from virtool.references.transforms import AttachImportedFromTransform
from virtool.references.utils import ReferenceSourceData
from virtool.storage.protocol import StorageBackend
from virtool.tasks.progress import (
    AbstractProgressHandler,
    AccumulatingProgressHandlerWrapper,
    TaskProgressHandler,
)
from virtool.tasks.transforms import AttachTaskTransform
from virtool.uploads.utils import upload_file_key
from virtool.users.transforms import AttachUserTransform


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
        ref_id: int,
        user_id: int,
        data: ReferenceSourceData,
        progress_handler: AbstractProgressHandler,
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

    async def import_reference(
        self,
        name_on_disk: str,
        ref_id: int,
        user_id: int,
        temp_path: Path,
        progress_handler: AbstractProgressHandler,
    ) -> None:
        """Import a reference from an uploaded JSON or SQLite artifact."""
        key = upload_file_key(name_on_disk)

        if name_on_disk.endswith(".json.gz"):
            import_data = await load_json_import(
                self._storage,
                key,
                progress_handler,
            )
        elif name_on_disk.endswith(".v1.sqlite"):
            import_data = await load_sqlite_import(
                self._storage,
                key,
                temp_path,
                progress_handler,
                ref_id,
            )
        else:
            await progress_handler.set_error(
                "Unsupported reference file name; expected a .json.gz or "
                ".v1.sqlite suffix"
            )
            return

        if import_data is None:
            return

        try:
            data = ReferenceSourceData.parse_obj(import_data)
        except ValidationError as err:
            await progress_handler.set_error(f"Invalid reference data: {err}")
            return

        await self.populate_imported_reference(
            ref_id,
            user_id,
            data,
            progress_handler,
        )
