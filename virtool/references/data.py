import asyncio
from datetime import datetime, timedelta
from typing import List, Optional, Union

import aiohttp
import arrow
from aiohttp import ClientSession
from aiohttp.web_exceptions import (
    HTTPNoContent,
)
from multidict import MultiDictProxy
from semver import VersionInfo
from sqlalchemy.ext.asyncio import AsyncEngine
from virtool_core.models.enums import HistoryMethod
from virtool_core.models.history import HistorySearchResult
from virtool_core.models.index import IndexSearchResult, IndexMinimal
from virtool_core.models.otu import OTUSearchResult, OTU
from virtool_core.models.reference import (
    ReferenceSearchResult,
    Reference,
    ReferenceUser,
    ReferenceRelease,
    ReferenceInstalled,
    ReferenceGroup,
)

import virtool.history.db
import virtool.indexes.db
import virtool.otus.db
import virtool.utils
from virtool.api.response import NotFound, InsufficientRights
from virtool.api.utils import compose_regex_query, paginate
from virtool.config import Config
from virtool.data.errors import (
    ResourceConflictError,
    ResourceNotFoundError,
    ResourceRemoteError,
    ResourceError,
)
from virtool.data.piece import DataLayerPiece
from virtool.errors import DatabaseError, GitHubError
from virtool.github import format_release, create_update_subdocument
from virtool.history.db import patch_to_version
from virtool.jobs.utils import JobRights
from virtool.mongo.transforms import apply_transforms
from virtool.mongo.utils import get_new_id, get_one_field
from virtool.otus.db import join
from virtool.otus.oas import CreateOTURequest
from virtool.pg.utils import get_row
from virtool.references.bulk import DBBulkUpdater, BulkOTUUpdater
from virtool.references.db import (
    compose_base_find_query,
    attach_computed,
    get_manifest,
    insert_joined_otu,
    insert_change,
    prepare_update_joined_otu,
    prepare_insert_otu,
    prepare_remove_otu,
)
from virtool.references.oas import (
    CreateReferenceRequest,
    UpdateReferenceRequest,
    CreateReferenceGroupsSchema,
    ReferenceRightsRequest,
    CreateReferenceUsersRequest,
)
from virtool.references.tasks import (
    CloneReferenceTask,
    ImportReferenceTask,
    RemoteReferenceTask,
    UpdateRemoteReferenceTask,
)
from virtool.references.transforms import ImportedFromTransform
from virtool.references.utils import ReferenceSourceData
from virtool.tasks.progress import (
    TaskProgressHandler,
    AccumulatingProgressHandlerWrapper,
)
from virtool.types import Document
from virtool.uploads.models import Upload as SQLUpload
from virtool.users.db import (
    AttachUserTransform,
    extend_user,
)
from virtool.utils import chunk_list


class ReferencesData(DataLayerPiece):
    def __init__(self, mongo, pg: AsyncEngine, config: Config, client: ClientSession):
        self._mongo = mongo
        self._pg = pg
        self._config = config
        self._client = client

    async def find(
        self,
        find: str,
        user_id: str,
        administrator: bool,
        groups: List,
        query: MultiDictProxy,
    ) -> ReferenceSearchResult:
        """
        Find references.

        """

        db_query = {}

        if find:
            db_query = compose_regex_query(find, ["name", "data_type"])

        base_query = compose_base_find_query(
            user_id,
            administrator,
            groups,
        )

        data = await paginate(
            self._mongo.references,
            db_query,
            query,
            sort="name",
            base_query=base_query,
            projection=virtool.references.db.PROJECTION,
        )

        documents, remote_slug_count = await asyncio.gather(
            apply_transforms(
                data["documents"],
                [
                    AttachUserTransform(self._mongo),
                    ImportedFromTransform(self._mongo, self._pg),
                ],
            ),
            self._mongo.references.count_documents(
                {"remotes_from.slug": "virtool/ref-plant-viruses"}
            ),
        )

        return ReferenceSearchResult(
            **{
                **data,
                "documents": documents,
                "official_installed": remote_slug_count > 0,
            }
        )

    async def create(self, data: CreateReferenceRequest, user_id: str) -> Reference:
        settings = await self.data.settings.get_all()

        if data.clone_from:
            if not await self._mongo.references.count_documents(
                {"_id": data.clone_from}
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
                self._pg, SQLUpload, ("name_on_disk", data.import_from)
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

            except aiohttp.ClientConnectionError:
                raise ResourceRemoteError("Could not reach GitHub")

            except GitHubError as err:
                if "404" in str(err):
                    raise ResourceRemoteError(
                        "Could not retrieve latest GitHub release"
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
        """
        Get a reference.
        """
        document = await self._mongo.references.find_one(ref_id)

        if not document:
            raise ResourceNotFoundError()

        document = await attach_computed(self._mongo, document)
        document = await apply_transforms(document, [AttachUserTransform(self._mongo)])

        try:
            installed = document.pop("updates")[-1]
        except (KeyError, IndexError):
            installed = None

        if installed:
            installed = await apply_transforms(
                installed, [AttachUserTransform(self._mongo)]
            )

        document["installed"] = installed

        imported_from = document.get("imported_from")

        if imported_from:
            imported_from = await apply_transforms(
                imported_from, [AttachUserTransform(self._mongo)]
            )

        document["imported_from"] = imported_from

        for user in document["users"]:
            if "created_at" not in user:
                user["created_at"] = document["created_at"]

        return Reference(**document)

    async def update(self, ref_id: str, data: UpdateReferenceRequest) -> Reference:
        """
        Update a reference.

        """

        data = data.dict(exclude_unset=True)

        if not await virtool.mongo.utils.id_exists(self._mongo.references, ref_id):
            raise ResourceNotFoundError()

        await self.data.references.update_reference(ref_id, data)

        return await self.get(ref_id)

    async def remove(self, ref_id: str, user_id: str, req):

        if not await virtool.mongo.utils.id_exists(self._mongo.references, ref_id):
            raise ResourceNotFoundError()

        if not await virtool.references.db.check_right(req, ref_id, "remove"):
            raise InsufficientRights()

        await self._mongo.references.delete_one({"_id": ref_id})

    async def get_release(self, ref_id: str, app) -> ReferenceRelease:

        if not await virtool.mongo.utils.id_exists(self._mongo.references, ref_id):
            raise ResourceNotFoundError()

        if not await self._mongo.references.count_documents(
            {"_id": ref_id, "remotes_from": {"$exists": True}}
        ):
            raise ResourceConflictError("Not a remote reference")
        try:
            release = await virtool.references.db.fetch_and_update_release(app, ref_id)
        except aiohttp.ClientConnectorError:
            raise ResourceRemoteError("Could not reach GitHub")

        if release is None:
            raise ResourceRemoteError("Release repository does not exist on GitHub")

        return ReferenceRelease(**release)

    async def get_updates(self, ref_id: str) -> List[ReferenceInstalled]:

        if not await virtool.mongo.utils.id_exists(self._mongo.references, ref_id):
            raise ResourceNotFoundError()

        updates = await virtool.mongo.utils.get_one_field(
            self._mongo.references, "updates", ref_id
        )

        if updates is not None:
            updates.reverse()
            return [ReferenceInstalled(**update) for update in updates]

        return []

    async def create_update(self, ref_id: str, user_id: str, req) -> ReferenceRelease:

        if not await virtool.mongo.utils.id_exists(self._mongo.references, ref_id):
            raise ResourceNotFoundError()

        if not await virtool.references.db.check_right(req, ref_id, "modify"):
            raise InsufficientRights()

        release = await virtool.mongo.utils.get_one_field(
            self._mongo.references, "release", ref_id
        )

        if release is None:
            raise ResourceError("Target release does not exist")

        created_at = virtool.utils.timestamp()

        context = {
            "created_at": created_at,
            "ref_id": ref_id,
            "release": await virtool.mongo.utils.get_one_field(
                self._mongo.references, "release", ref_id
            ),
            "user_id": user_id,
        }

        task = await self.data.tasks.create(UpdateRemoteReferenceTask, context=context)

        release, update_subdocument = await asyncio.shield(
            virtool.references.db.update(
                req, created_at, task.id, ref_id, release, user_id
            )
        )

        return ReferenceRelease(**{**release, **update_subdocument})

    async def get_otus(
        self,
        term: Optional[str],
        verified: Optional[bool],
        names: Optional[Union[bool, str]],
        ref_id: Optional[str],
        query,
    ) -> OTUSearchResult:

        if not await virtool.mongo.utils.id_exists(self._mongo.references, ref_id):
            raise ResourceNotFoundError()

        data = await virtool.otus.db.find(
            self._mongo, names, term, query, verified, ref_id
        )

        return OTUSearchResult(**data)

    async def create_otus(
        self, ref_id: str, data: CreateOTURequest, req, user_id: str
    ) -> OTU:

        reference = await self._mongo.references.find_one(ref_id, ["groups", "users"])

        if reference is None:
            raise ResourceNotFoundError()

        if not await virtool.references.db.check_right(req, reference, "modify_otu"):
            raise InsufficientRights()

        # Check if either the name or abbreviation are already in use. Send a ``400`` if
        # they are.
        if message := await virtool.otus.db.check_name_and_abbreviation(
            self._mongo, ref_id, data.name, data.abbreviation
        ):
            raise ResourceError(message)

        otu = await self.data.otus.create(ref_id, data, user_id=user_id)

        return otu

    async def get_history(
        self, ref_id: str, unbuilt: str, query
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

    async def create_index(self, ref_id: str, req, user_id: str) -> IndexMinimal:

        reference = await self._mongo.references.find_one(ref_id, ["groups", "users"])

        if reference is None:
            raise ResourceNotFoundError()

        if not await virtool.references.db.check_right(req, reference, "build"):
            raise InsufficientRights()

        if await self._mongo.indexes.count_documents(
            {"reference.id": ref_id, "ready": False}, limit=1
        ):
            raise ResourceConflictError("Index build already in progress")

        if await self._mongo.otus.count_documents(
            {"reference.id": ref_id, "verified": False}, limit=1
        ):
            raise ResourceError("There are unverified OTUs")

        if not await self._mongo.history.count_documents(
            {"reference.id": ref_id, "index.id": "unbuilt"}, limit=1
        ):
            raise ResourceError("There are no unbuilt changes")

        job_id = await get_new_id(self._mongo.jobs)

        document = await virtool.indexes.db.create(self._mongo, ref_id, user_id, job_id)

        rights = JobRights()
        rights.indexes.can_modify(document["_id"])
        rights.references.can_read(ref_id)

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
            rights,
            job_id=job_id,
        )

        document = await virtool.indexes.db.processor(self._mongo, document)

        return IndexMinimal(**document)

    async def list_groups(self, ref_id: str) -> List[ReferenceGroup]:
        """
        List all groups that have access to the reference.

        :param ref_id: the id of the reference
        :return: a list of reference users
        """
        groups = await virtool.mongo.utils.get_one_field(
            self._mongo.references, "groups", ref_id
        )

        if groups:
            return [ReferenceGroup(**group) for group in groups]

        raise ResourceNotFoundError

    async def create_group(
        self, ref_id: str, data: CreateReferenceGroupsSchema, req
    ) -> ReferenceGroup:

        data = data.dict(exclude_none=True)

        document = await self._mongo.references.find_one(ref_id, ["groups", "users"])

        if document is None:
            raise ResourceNotFoundError()

        if not await virtool.references.db.check_right(req, document, "modify"):
            raise InsufficientRights()

        try:
            subdocument = await virtool.references.db.add_group_or_user(
                self._mongo, ref_id, "groups", data
            )
        except DatabaseError as err:
            if "already exists" in str(err):
                raise ResourceConflictError("Group already exists")

            if "does not exist" in str(err):
                raise ResourceConflictError("Group does not exist")

            raise

        return ReferenceGroup(**subdocument)

    async def get_group(self, ref_id: str, group_id: str) -> ReferenceGroup:

        document = await self._mongo.references.find_one(
            {"_id": ref_id, "groups.id": group_id}, ["groups", "users"]
        )

        if document is None:
            raise ResourceNotFoundError()

        if document is not None:
            for group in document.get("groups", []):
                if group["id"] == group_id:
                    return ReferenceGroup(**group)

    async def update_group(
        self, data: ReferenceRightsRequest, ref_id: str, group_id: str, req
    ) -> ReferenceGroup:

        data = data.dict(exclude_unset=True)

        document = await self._mongo.references.find_one(
            {"_id": ref_id, "groups.id": group_id}, ["groups", "users"]
        )

        if document is None:
            raise ResourceNotFoundError()

        if not await virtool.references.db.check_right(req, ref_id, "modify"):
            raise InsufficientRights()

        subdocument = await virtool.references.db.edit_group_or_user(
            self._mongo, ref_id, group_id, "groups", data
        )

        return ReferenceGroup(**subdocument)

    async def delete_group(self, ref_id: str, group_id: str, req):

        document = await self._mongo.references.find_one(
            {"_id": ref_id, "groups.id": group_id}, ["groups", "users"]
        )

        if document is None:
            raise ResourceNotFoundError()

        if not await virtool.references.db.check_right(req, ref_id, "modify"):
            raise InsufficientRights()

        await virtool.references.db.delete_group_or_user(
            self._mongo, ref_id, group_id, "groups"
        )

        raise HTTPNoContent

    async def create_user(
        self, data: CreateReferenceUsersRequest, ref_id: str, req
    ) -> ReferenceUser:

        data = data.dict(exclude_none=True)

        document = await self._mongo.references.find_one(ref_id, ["groups", "users"])

        if document is None:
            raise NotFound()

        if not await virtool.references.db.check_right(req, ref_id, "modify"):
            raise InsufficientRights()

        try:
            subdocument = await virtool.references.db.add_group_or_user(
                self._mongo, ref_id, "users", data
            )
        except DatabaseError as err:
            if "already exists" in str(err):
                raise ResourceConflictError("User already exists")

            if "does not exist" in str(err):
                raise ResourceConflictError("User does not exist")

            raise

        return ReferenceUser(**await extend_user(self._mongo, subdocument))

    async def update_user(
        self, data: ReferenceRightsRequest, ref_id: str, user_id: str, req
    ) -> ReferenceUser:

        data = data.dict(exclude_unset=True)

        document = await self._mongo.references.find_one(
            {"_id": ref_id, "users.id": user_id}, ["groups", "users"]
        )

        if document is None:
            raise ResourceNotFoundError()

        if not await virtool.references.db.check_right(req, ref_id, "modify"):
            raise InsufficientRights()

        subdocument = await virtool.references.db.edit_group_or_user(
            self._mongo, ref_id, user_id, "users", data
        )

        if subdocument is None:
            raise ResourceNotFoundError()

        return ReferenceUser(**await extend_user(self._mongo, subdocument))

    async def delete_user(self, ref_id: str, user_id: str, req):
        document = await self._mongo.references.find_one(
            {"_id": ref_id, "users.id": user_id}, ["groups", "users"]
        )

        if document is None:
            raise ResourceNotFoundError()

        if not await virtool.references.db.check_right(req, ref_id, "modify"):
            raise InsufficientRights()

        await virtool.references.db.delete_group_or_user(
            self._mongo, ref_id, user_id, "users"
        )

        raise HTTPNoContent

    async def update_reference(self, ref_id: str, data: dict) -> dict:
        """
        Update an existing reference using the passed update data.
        """
        document = await self._mongo.references.find_one(ref_id)

        if document["data_type"] != "barcode":
            data.pop("targets", None)

        document = await self._mongo.references.find_one_and_update(
            {"_id": ref_id}, {"$set": data}
        )

        document = await attach_computed(self._mongo, document)

        if "name" in data:
            await self._mongo.analyses.update_many(
                {"reference.id": ref_id}, {"$set": {"reference.name": document["name"]}}
            )

        return document

    async def populate_cloned_reference(
        self,
        manifest,
        ref_id,
        user_id,
        progress_handler: TaskProgressHandler,
    ):
        """


        :param manifest:
        :param ref_id:
        :param user_id:
        :param progress_handler:
        :return:
        """
        tracker = AccumulatingProgressHandlerWrapper(progress_handler, len(manifest))

        cloned_reference = await self._mongo.references.find_one(ref_id)

        async with self._mongo.create_session() as session:
            for source_otu_id, version in manifest.items():
                _, patched, _ = await patch_to_version(
                    self._config.data_path, self._mongo, source_otu_id, version
                )

                otu_id = await insert_joined_otu(
                    self._mongo,
                    patched,
                    cloned_reference["created_at"],
                    ref_id,
                    user_id,
                    session,
                )

                await insert_change(
                    self._config.data_path,
                    self._mongo,
                    otu_id,
                    HistoryMethod.clone,
                    user_id,
                    session,
                )

                await tracker.add(1)

    async def populate_imported_reference(
        self,
        ref_id: str,
        user_id: str,
        data: ReferenceSourceData,
        progress_handler: TaskProgressHandler,
    ):
        created_at = await get_one_field(self._mongo.references, "created_at", ref_id)

        tracker = AccumulatingProgressHandlerWrapper(
            progress_handler, (len(data.otus) * 2)
        )

        inserted_otu_ids = []

        async with self._mongo.create_session() as session:
            await self._mongo.references.update_one(
                {"_id": ref_id},
                {
                    "$set": {
                        "data_type": data.data_type,
                        "organism": data.organism,
                        "targets": data.targets,
                    }
                },
            )

            for chunk in chunk_list(data.otus, 10):
                chunk_otu_ids = await asyncio.gather(
                    *[
                        insert_joined_otu(
                            self._mongo, otu, created_at, ref_id, user_id, session
                        )
                        for otu in chunk
                    ]
                )
                inserted_otu_ids.extend(chunk_otu_ids)
                await tracker.add(len(chunk))

            for chunk in chunk_list(inserted_otu_ids, 10):
                await asyncio.gather(
                    *[
                        insert_change(
                            self._config.data_path,
                            self._mongo,
                            otu_id,
                            HistoryMethod.import_otu,
                            user_id,
                            session,
                        )
                        for otu_id in chunk
                    ]
                )
                await tracker.add(len(chunk))

    async def populate_remote_reference(
        self,
        ref_id: str,
        data: ReferenceSourceData,
        user_id: str,
        release: Document,
        progress_handler: TaskProgressHandler,
    ):
        tracker = AccumulatingProgressHandlerWrapper(progress_handler, len(data.otus))

        created_at: datetime = await get_one_field(
            self._mongo.references, "created_at", ref_id
        )

        async with self._mongo.create_session() as session:
            await self._mongo.references.update_one(
                {"_id": ref_id},
                {
                    "$set": {
                        "data_type": data.data_type.value,
                        "organism": data.organism,
                        "targets": data.targets,
                    }
                },
                session=session,
            )

            for otu in data.otus:
                otu_id = await insert_joined_otu(
                    self._mongo, otu, created_at, ref_id, user_id, session
                )

                await insert_change(
                    self._config.data_path,
                    self._mongo,
                    otu_id,
                    HistoryMethod.remote,
                    user_id,
                    session,
                )

                await tracker.add(1)

            await self._mongo.references.update_one(
                {
                    "_id": ref_id,
                    "updates.id": release["id"],
                },
                {
                    "$set": {
                        "installed": create_update_subdocument(release, True, user_id),
                        "updates.$.ready": True,
                        "updating": False,
                    }
                },
                session=session,
            )

    async def update_remote_reference(
        self,
        ref_id: str,
        data: ReferenceSourceData,
        release: Document,
        user_id: str,
        progress_handler,
    ):
        """
        Update a remote reference to a newer version.

        * Update reference metadata.
        * Insert new OTUs.
        * Update existing OTUs that have changed.
        * Delete OTUs in the database that don't exist in the update.
        * Create history.

        """
        created_at: datetime = await get_one_field(
            self._mongo.references, "created_at", ref_id
        )

        to_delete = await self._mongo.otus.distinct(
            "_id",
            {
                "reference.id": ref_id,
                "remote.id": {"$nin": list({otu["_id"] for otu in data.otus})},
            },
        )

        tracker = AccumulatingProgressHandlerWrapper(
            progress_handler, len(data.otus) + len(to_delete)
        )
        print(len(data.otus) + len(to_delete))
        total_changes = 0
        iterat = 0
        updates = 0
        inserts = 0
        deletes = 0
        async with self._mongo.create_session() as session:
            await self._mongo.references.update_one(
                {"_id": ref_id},
                {
                    "$set": {
                        "organism": data.organism,
                        "targets": data.targets,
                    }
                },
                session=session,
            )

            bulk_updater = BulkOTUUpdater(
                ref_id, user_id, self._mongo, tracker, session
            )

            for otu in data.otus:  # chunk this out
                iterat += 1
                old = await join(
                    self._mongo, {"reference.id": ref_id, "remote.id": otu["_id"]}
                )
                if old:
                    bulk_updater.update(otu, old)
                else:
                    bulk_updater.insert(otu, created_at)

            for otu_id in to_delete:
                iterat += 1
                await bulk_updater.delete(otu_id)
            print("All update objects created")
            await bulk_updater.finish()
            print(
                f"predicting {len(data.otus) + len(to_delete)} got {iterat} iterations. predicting {total_changes} history updates, got {tracker._accumulated}"
            )
            print(
                f"deletes {deletes}, updates {updates}, inserts{inserts}, total {deletes + inserts + updates}"
            )

            # await self._mongo.references.update_one(
            #     {"_id": ref_id},
            #     {
            #         "$set": {
            #             "installed": create_update_subdocument(release, True, user_id),
            #             "updates.$.ready": True,
            #             "updating": False,
            #         }
            #     },
            #     session=session,
            # )

        print("Done!!!!!!!!!!!!")

    async def clean_all(self):
        """
        Clean corrupt updates from reference update lists.

        If the installed version is earlier than the last update, the last update is
        removed.

        """
        async with self._mongo.create_session() as session:
            async for reference in self._mongo.references.find(
                {"remotes_from": {"$exists": True}},
                ["installed", "task", "updates"],
                session=session,
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

                latest_update_version = VersionInfo.parse(
                    latest_update["name"].lstrip("v")
                )

                if latest_update_version <= installed_version:
                    continue

                if arrow.utcnow() - arrow.get(latest_update["created_at"]) > timedelta(
                    minutes=15
                ):
                    await self._mongo.references.update_one(
                        {"_id": reference["_id"]},
                        {"$pop": {"updates": -1}, "$set": {"updating": False}},
                        session=session,
                    )
