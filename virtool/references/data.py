import asyncio
from datetime import datetime, timedelta

import arrow
from aiohttp import ClientConnectionError, ClientConnectorError, ClientSession
from multidict import MultiDictProxy
from semver import VersionInfo
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from virtool_core.models.enums import HistoryMethod
from virtool_core.models.history import HistorySearchResult
from virtool_core.models.index import IndexMinimal, IndexSearchResult
from virtool_core.models.otu import OTU, OTUSearchResult
from virtool_core.models.reference import (
    Reference,
    ReferenceGroup,
    ReferenceInstalled,
    ReferenceRelease,
    ReferenceSearchResult,
    ReferenceUser,
)

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
    ResourceRemoteError,
)
from virtool.data.events import Operation, emit, emits
from virtool.data.transforms import apply_transforms
from virtool.errors import GitHubError
from virtool.github import create_update_subdocument, format_release
from virtool.groups.pg import SQLGroup
from virtool.history.db import patch_to_version
from virtool.mongo.core import Mongo
from virtool.mongo.utils import get_mongo_from_app, get_new_id, get_one_field, id_exists
from virtool.otus.oas import CreateOTURequest
from virtool.pg.utils import get_row
from virtool.references.alot import prepare_otu_insertion
from virtool.references.bulk import BulkOTUUpdater
from virtool.references.db import (
    compose_base_find_query,
    fetch_and_update_release,
    get_contributors,
    get_internal_control,
    get_latest_build,
    get_manifest,
    get_otu_count,
    get_reference_groups,
    get_reference_users,
    get_unbuilt_count,
    populate_insert_only_reference,
    processor,
)
from virtool.references.oas import (
    CreateReferenceGroupRequest,
    CreateReferenceRequest,
    CreateReferenceUserRequest,
    ReferenceRightsRequest,
    UpdateReferenceRequest,
)
from virtool.references.tasks import (
    CloneReferenceTask,
    ImportReferenceTask,
    RemoteReferenceTask,
    UpdateRemoteReferenceTask,
)
from virtool.references.transforms import AttachImportedFromTransform
from virtool.references.utils import RIGHTS, ReferenceSourceData
from virtool.tasks.progress import (
    AccumulatingProgressHandlerWrapper,
    TaskProgressHandler,
)
from virtool.tasks.transforms import AttachTaskTransform
from virtool.types import Document
from virtool.uploads.models import SQLUpload
from virtool.users.mongo import extend_user
from virtool.users.transforms import AttachUserTransform
from virtool.utils import get_http_session_from_app, get_safely


class ReferencesData(DataLayerDomain):
    name = "references"

    def __init__(
        self,
        mongo: Mongo,
        pg: AsyncEngine,
        config: Config,
        client: ClientSession,
    ):
        self._mongo = mongo
        self._pg = pg
        self._config = config
        self._client = client

    async def find(
        self,
        find: str,
        user_id: str,
        administrator: bool,
        groups: list[int | str],
        query: MultiDictProxy,
    ) -> ReferenceSearchResult:
        """Find references."""
        mongo_query = {}

        if find:
            mongo_query = compose_regex_query(find, ["name", "data_type"])

        base_query = compose_base_find_query(user_id, administrator, groups)

        data = await paginate(
            self._mongo.references,
            mongo_query,
            query,
            sort="name",
            base_query=base_query,
        )

        documents = [
            await processor(self._mongo, document) for document in data["documents"]
        ]

        documents, remote_slug_count = await asyncio.gather(
            apply_transforms(
                documents,
                [
                    AttachUserTransform(self._mongo),
                    AttachImportedFromTransform(self._mongo, self._pg),
                    AttachTaskTransform(self._pg),
                ],
            ),
            self._mongo.references.count_documents(
                {"remotes_from.slug": "virtool/ref-plant-viruses"},
            ),
        )

        return ReferenceSearchResult(
            **{
                **data,
                "documents": documents,
                "official_installed": remote_slug_count > 0,
            },
        )

    @emits(Operation.CREATE)
    async def create(self, data: CreateReferenceRequest, user_id: str) -> Reference:
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
            if not await get_row(
                self._pg,
                SQLUpload,
                ("name_on_disk", data.import_from),
            ):
                raise ResourceNotFoundError("File not found")

            path = self._config.data_path / "files" / data.import_from

            document = await virtool.references.db.create_import(
                self._mongo,
                self._pg,
                settings,
                data.name,
                data.description,
                data.import_from,
                user_id,
                data.data_type,
                data.organism,
            )

            context = {
                "created_at": document["created_at"],
                "path": str(path),
                "ref_id": document["_id"],
                "user_id": user_id,
            }

            task = await self.data.tasks.create(ImportReferenceTask, context=context)

            document["task"] = {"id": task.id}

        elif data.remote_from:
            try:
                release = await virtool.github.get_release(
                    self._client,
                    data.remote_from,
                    release_id=data.release_id,
                )

            except ClientConnectionError:
                raise ResourceRemoteError("Could not reach GitHub")

            except GitHubError as err:
                if "404" in str(err):
                    raise ResourceRemoteError(
                        "Could not retrieve latest GitHub release",
                    )

                raise

            release = format_release(release)
            release["newer"] = False

            document = await virtool.references.db.create_remote(
                self._mongo,
                settings,
                data.name,
                release,
                data.remote_from,
                user_id,
                data.data_type,
            )

            context = {
                "release": release,
                "ref_id": document["_id"],
                "created_at": document["created_at"],
                "user_id": user_id,
            }

            task = await self.data.tasks.create(RemoteReferenceTask, context=context)

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

        document = await self._mongo.references.insert_one(document)

        return await self.get(document["_id"])

    async def get(self, ref_id: str) -> Reference:
        """Get a reference."""
        document = await self._mongo.references.find_one(ref_id)

        if not document:
            raise ResourceNotFoundError

        internal_control_id = get_safely(document, "internal_control", "id")

        (
            contributors,
            internal_control,
            latest_build,
            otu_count,
            groups,
            users,
            unbuilt_count,
        ) = await asyncio.gather(
            get_contributors(self._mongo, ref_id),
            get_internal_control(self._mongo, internal_control_id, ref_id),
            get_latest_build(self._mongo, ref_id),
            get_otu_count(self._mongo, ref_id),
            get_reference_groups(self._pg, document),
            get_reference_users(self._mongo, document),
            get_unbuilt_count(self._mongo, ref_id),
        )

        document.update(
            {
                "contributors": contributors,
                "groups": groups,
                "internal_control": internal_control or None,
                "latest_build": latest_build,
                "otu_count": otu_count,
                "unbuilt_change_count": unbuilt_count,
                "users": users,
            },
        )

        document = await apply_transforms(
            document,
            [AttachUserTransform(self._mongo), AttachTaskTransform(self._pg)],
        )

        try:
            installed: dict | None = document.pop("updates")[-1]
        except (KeyError, IndexError):
            installed = None

        if installed:
            installed = await apply_transforms(
                installed,
                [AttachUserTransform(self._mongo)],
            )

        document["installed"] = installed

        imported_from = document.get("imported_from")

        if imported_from:
            imported_from = await apply_transforms(
                imported_from,
                [AttachUserTransform(self._mongo)],
            )

        document["imported_from"] = imported_from

        for user in document["users"]:
            if "created_at" not in user:
                user["created_at"] = document["created_at"]

        return Reference(**document)

    @emits(Operation.UPDATE)
    async def update(self, ref_id: str, data: UpdateReferenceRequest) -> Reference:
        """Update a reference."""
        document = await self._mongo.references.find_one(ref_id)

        if document is None:
            raise ResourceNotFoundError()

        data = data.dict(exclude_unset=True)

        # Setting targets on a reference that is not barcode data is not allowed.
        if document["data_type"] != "barcode":
            data.pop("targets", None)

        await self._mongo.references.update_one({"_id": ref_id}, {"$set": data})

        return await self.get(ref_id)

    async def remove(self, ref_id: str, req):
        if not await virtool.references.db.check_right(req, ref_id, "remove"):
            raise APIInsufficientRights()

        reference = await self.get(ref_id)

        await self._mongo.references.delete_one({"_id": ref_id})

        emit(reference, "references", "delete", Operation.DELETE)

    async def get_release(self, ref_id: str, app) -> ReferenceRelease:
        if not await virtool.mongo.utils.id_exists(self._mongo.references, ref_id):
            raise ResourceNotFoundError()

        if not await self._mongo.references.count_documents(
            {"_id": ref_id, "remotes_from": {"$exists": True}},
        ):
            raise ResourceConflictError("Not a remote reference")
        try:
            release = await virtool.references.db.fetch_and_update_release(
                get_mongo_from_app(app),
                get_http_session_from_app(app),
                ref_id,
            )
        except ClientConnectorError:
            raise ResourceRemoteError("Could not reach GitHub")

        if release is None:
            raise ResourceRemoteError("Release repository does not exist on GitHub")

        return ReferenceRelease(**release)

    async def get_updates(self, ref_id: str) -> list[ReferenceInstalled]:
        if not await virtool.mongo.utils.id_exists(self._mongo.references, ref_id):
            raise ResourceNotFoundError()

        updates = await virtool.mongo.utils.get_one_field(
            self._mongo.references,
            "updates",
            ref_id,
        )

        if updates is not None:
            updates.reverse()
            return [ReferenceInstalled(**update) for update in updates]

        return []

    async def create_update(
        self,
        ref_id: str,
        user_id: str,
    ) -> ReferenceRelease:
        document = await self._mongo.references.find_one(ref_id, ["release"])

        if document is None:
            raise ResourceNotFoundError()

        if document.get("release") is None:
            raise ResourceError("No release available")

        created_at = virtool.utils.timestamp()

        task = await self.data.tasks.create(
            UpdateRemoteReferenceTask,
            context={
                "created_at": created_at,
                "ref_id": ref_id,
                "release": document["release"],
                "user_id": user_id,
            },
        )

        subdocument = create_update_subdocument(
            document["release"],
            False,
            user_id,
            created_at,
        )

        await self._mongo.references.update_one(
            {"_id": ref_id},
            {
                "$push": {"updates": subdocument},
                "$set": {"task": {"id": task.id}, "updating": True},
            },
        )

        return ReferenceRelease(**{**document["release"], **subdocument})

    async def find_otus(
        self,
        term: str | None,
        verified: bool | None,
        ref_id: str | None,
        query,
    ) -> OTUSearchResult:
        if await virtool.mongo.utils.id_exists(self._mongo.references, ref_id):
            data = await virtool.otus.db.find(
                self._mongo,
                term,
                query,
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
        user_id: str,
    ) -> OTU:
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
        unbuilt: str,
        query,
    ) -> HistorySearchResult:
        if not await self._mongo.references.count_documents({"_id": ref_id}):
            raise ResourceNotFoundError()

        base_query = {"reference.id": ref_id}

        if unbuilt == "true":
            base_query["index.id"] = "unbuilt"

        elif unbuilt == "false":
            base_query["index.id"] = {"$ne": "unbuilt"}

        data = await virtool.history.db.find(self._mongo, query, base_query)

        return HistorySearchResult(**data)

    async def find_indexes(self, ref_id: str, query) -> IndexSearchResult:
        if not await virtool.mongo.utils.id_exists(self._mongo.references, ref_id):
            raise ResourceNotFoundError()

        data = await virtool.indexes.db.find(self._mongo, query, ref_id=ref_id)

        return IndexSearchResult(**data)

    @emits(Operation.CREATE, domain="indexes", name="create")
    async def create_index(self, ref_id: str, req, user_id: str) -> IndexMinimal:
        if not await virtool.references.db.check_right(req, ref_id, "build"):
            raise APIInsufficientRights()

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

        if not await self._mongo.history.count_documents(
            {"reference.id": ref_id, "index.id": "unbuilt"},
            limit=1,
        ):
            raise ResourceError("There are no unbuilt changes")

        job_id = await get_new_id(self._mongo.jobs)

        document = await virtool.indexes.db.create(self._mongo, ref_id, user_id, job_id)

        await self.data.jobs.create(
            "build_index",
            {
                "ref_id": ref_id,
                "user_id": user_id,
                "index_id": document["_id"],
                "index_version": document["version"],
                "manifest": document["manifest"],
            },
            user_id,
            0,
            job_id=job_id,
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

        reference_group = {
            "id": group.id,
            "build": data.build or False,
            "created_at": virtool.utils.timestamp(),
            "legacy_id": group.legacy_id,
            "modify": data.modify or False,
            "modify_otu": data.modify_otu or False,
            "remove": data.remove or False,
        }

        await self._mongo.references.update_one(
            {"_id": ref_id},
            {"$push": {"groups": reference_group}},
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

                await self._mongo.references.update_one(
                    {"_id": ref_id},
                    {"$set": {"groups": document["groups"]}},
                )

                emit(
                    await self.get(ref_id),
                    "references",
                    "update_group",
                    Operation.UPDATE,
                )

                async with AsyncSession(self._pg) as session:
                    result = await session.execute(
                        select(SQLGroup).where(
                            (SQLGroup.id == group_id)
                            if isinstance(group_id, int)
                            else (SQLGroup.legacy_id == group_id),
                        ),
                    )

                    row = result.scalar_one()

                    return ReferenceGroup(
                        **{
                            **group,
                            "id": row.id,
                            "legacy_id": row.legacy_id,
                            "name": row.name,
                        },
                    )

        raise ResourceNotFoundError()

    async def delete_group(self, ref_id: str, group_id: int | str):
        document = await self._mongo.references.find_one(
            {"_id": ref_id, "groups.id": group_id},
            ["groups", "users"],
        )

        if document is None:
            raise ResourceNotFoundError()

        await self._mongo.references.update_one(
            {"_id": ref_id},
            {
                "$set": {
                    "groups": [g for g in document["groups"] if g["id"] != group_id],
                },
            },
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

        if not await id_exists(self._mongo.users, data.user_id):
            raise ResourceConflictError("User does not exist")

        if data.user_id in {u["id"] for u in document["users"]}:
            raise ResourceConflictError("User already exists")

        reference_user = {
            "id": data.user_id,
            "build": data.build or False,
            "created_at": virtool.utils.timestamp(),
            "modify": data.modify or False,
            "modify_otu": data.modify_otu or False,
            "remove": data.remove or False,
        }

        await self._mongo.references.update_one(
            {"_id": ref_id},
            {"$push": {"users": reference_user}},
        )

        emit(await self.get(ref_id), "references", "create_user", Operation.UPDATE)

        return ReferenceUser(**await extend_user(self._mongo, reference_user))

    async def update_user(
        self,
        ref_id: str,
        user_id: str,
        data: ReferenceRightsRequest,
    ) -> ReferenceUser:
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

                await self._mongo.references.update_one(
                    {"_id": ref_id},
                    {"$set": {"users": document["users"]}},
                )

                emit(
                    await self.get(ref_id),
                    "references",
                    "update_user",
                    Operation.UPDATE,
                )

                return ReferenceUser(**await extend_user(self._mongo, user))

        raise ResourceNotFoundError()

    async def delete_user(self, ref_id: str, user_id: str):
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

        # Retain only the users that don't match the passed user_id.
        await self._mongo.references.update_one(
            {"_id": ref_id},
            {"$set": {"users": [u for u in document["users"] if u["id"] != user_id]}},
        )

        emit(await self.get(ref_id), "references", "delete_user", Operation.UPDATE)

    async def populate_cloned_reference(
        self,
        manifest: dict[str, int],
        ref_id: str,
        user_id: str,
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
                self._config.data_path,
                self._mongo,
                source_otu_id,
                version,
            )

            otus.append(patched)

            await tracker.add(1)

        await populate_insert_only_reference(
            created_at,
            HistoryMethod.clone,
            self._mongo,
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
        user_id: str,
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
                    "targets": data.targets,
                },
            },
        )

        await tracker.add(1)

        insertions = [
            prepare_otu_insertion(
                created_at,
                HistoryMethod.import_otu,
                otu,
                ref_id,
                user_id,
            )
            for otu in data.otus
        ]

        await tracker.add(1)

        try:
            sequences = []

            for insertion in insertions:
                sequences.extend(insertion.sequences)

            await asyncio.gather(
                self._mongo.history.insert_many(
                    [insertion.history for insertion in insertions],
                    None,
                ),
                self._mongo.otus.insert_many(
                    [insertion.otu for insertion in insertions],
                    None,
                ),
                self._mongo.sequences.insert_many(
                    sequences,
                    None,
                ),
            )
        except Exception:
            await asyncio.gather(
                self._mongo.otus.delete_many({"reference.id": ref_id}),
                self._mongo.history.delete_many({"reference.id": ref_id}),
                self._mongo.references.delete_one({"_id": ref_id}),
                self._mongo.sequences.delete_many({"reference.id": ref_id}),
            )
            raise

        await tracker.add(1)

        emit(
            await self.get(ref_id),
            "references",
            "populate_imported_reference",
            Operation.UPDATE,
        )

    async def populate_remote_reference(
        self,
        ref_id: str,
        data: ReferenceSourceData,
        user_id: str,
        release: Document,
        progress_handler: TaskProgressHandler,
    ) -> None:
        tracker = AccumulatingProgressHandlerWrapper(progress_handler, len(data.otus))

        created_at: datetime = await get_one_field(
            self._mongo.references,
            "created_at",
            ref_id,
        )

        await self._mongo.references.update_one(
            {"_id": ref_id},
            {
                "$set": {
                    "data_type": data.data_type,
                    "organism": data.organism,
                    "targets": data.targets,
                },
            },
        )

        await populate_insert_only_reference(
            created_at,
            HistoryMethod.remote,
            self._mongo,
            data.otus,
            ref_id,
            user_id,
        )

        await self._mongo.references.update_one(
            {"_id": ref_id, "updates.id": release["id"]},
            {
                "$set": {
                    "updates.$.ready": True,
                    "updating": False,
                },
            },
        )

        emit(
            await self.get(ref_id),
            "references",
            "populate_remote_reference",
            Operation.UPDATE,
        )

    async def update_remote_reference(
        self,
        ref_id: str,
        data: ReferenceSourceData,
        release: Document,
        user_id: str,
        progress_handler,
    ):
        """Update a remote reference to a newer version.

        * Update reference metadata.
        * Insert new OTUs.
        * Update existing OTUs that have changed.
        * Delete OTUs in the database that don't exist in the update.
        * Create history.

        """

        async def func(session):
            created_at: datetime = await get_one_field(
                self._mongo.references,
                "created_at",
                ref_id,
            )

            to_delete = await self._mongo.otus.distinct(
                "_id",
                {
                    "reference.id": ref_id,
                    "remote.id": {"$nin": list({otu["_id"] for otu in data.otus})},
                },
            )

            tracker = AccumulatingProgressHandlerWrapper(
                progress_handler,
                len(data.otus) + len(to_delete),
            )

            await self._mongo.references.update_one(
                {"_id": ref_id},
                {"$set": {"organism": data.organism, "targets": data.targets}},
                session=session,
            )

            bulk_updater = BulkOTUUpdater(
                self._mongo,
                ref_id,
                user_id,
                created_at,
                self._config.data_path,
                tracker,
                session,
            )

            bulk_updater.bulk_upsert(data.otus)

            for otu_id in to_delete:
                await bulk_updater.delete(otu_id)

            await bulk_updater.finish()

            await self._mongo.references.update_one(
                {"_id": ref_id, "updates.id": release["id"]},
                {
                    "$set": {
                        "installed": create_update_subdocument(release, True, user_id),
                        "updates.$.ready": True,
                        "updating": False,
                        "release.newer": False,
                    },
                },
                session=session,
            )

        await self._mongo.with_transaction(func)

        emit(
            await self.get(ref_id),
            "references",
            "update_remote_reference",
            Operation.UPDATE,
        )

    async def clean_all(self):
        """Clean corrupt updates from reference update lists.

        If the installed version is earlier than the last update, the last update is
        removed.

        """
        async for reference in self._mongo.references.find(
            {"remotes_from": {"$exists": True}},
            ["installed", "task", "updates"],
        ):
            if len(reference["updates"]) == 0:
                continue

            latest_update = reference["updates"][-1]

            if latest_update["ready"]:
                continue

            try:
                raw_version = reference["installed"]["name"].lstrip("v")
            except (KeyError, TypeError):
                continue

            installed_version = VersionInfo.parse(raw_version)

            latest_update_version = VersionInfo.parse(latest_update["name"].lstrip("v"))

            if latest_update_version <= installed_version:
                continue

            if arrow.utcnow() - arrow.get(latest_update["created_at"]) > timedelta(
                minutes=15,
            ):
                await self._mongo.references.update_one(
                    {"_id": reference["_id"]},
                    {"$pop": {"updates": -1}, "$set": {"updating": False}},
                )

            emit(
                await self.get(reference["_id"]),
                "references",
                "clean_all",
                Operation.UPDATE,
            )

    async def fetch_and_update_reference_releases(self):
        for ref_id in await self._mongo.references.distinct(
            "_id",
            {"remotes_from": {"$exists": True}},
        ):
            await fetch_and_update_release(
                self._mongo,
                self._client,
                ref_id,
                ignore_errors=True,
            )

            emit(
                await self.get(ref_id),
                "references",
                "fetch_and_update_reference_releases",
                Operation.UPDATE,
            )
