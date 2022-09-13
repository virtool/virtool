import asyncio
from asyncio.tasks import gather
from typing import Union, List

import aiohttp
from aiohttp.web_exceptions import HTTPBadGateway, HTTPBadRequest, HTTPNoContent
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r201, r202, r204, r400, r403, r404, r502
from virtool_core.models.enums import Permission

import virtool.history.db
import virtool.indexes.db
import virtool.mongo.utils
import virtool.otus.db
import virtool.references.db
import virtool.utils
from virtool.api.response import InsufficientRights, NotFound, json_response
from virtool.api.utils import compose_regex_query, paginate
from virtool.data.utils import get_data_from_req
from virtool.errors import DatabaseError, GitHubError
from virtool.github import format_release
from virtool.history.oas import GetHistoryResponse
from virtool.http.routes import Routes
from virtool.http.policy import policy, PermissionsRoutePolicy
from virtool.mongo.transforms import apply_transforms
from virtool.pg.utils import get_row
from virtool.references.db import (
    attach_computed,
    compose_base_find_query,
    create_clone,
    create_document,
    create_import,
    create_remote,
    get_manifest,
    get_official_installed,
)
from virtool.references.tasks import (
    CloneReferenceTask,
    DeleteReferenceTask,
    ImportReferenceTask,
    RemoteReferenceTask,
    UpdateRemoteReferenceTask,
)
from virtool.references.oas import (
    CreateReferenceSchema,
    EditReferenceSchema,
    CreateReferenceGroupsSchema,
    ReferenceRightsSchema,
    CreateReferenceUsersSchema,
    CreateReferenceResponse,
    GetReferencesResponse,
    ReferenceResponse,
    ReferenceReleaseResponse,
    CreateReferenceUpdateResponse,
    GetReferenceUpdateResponse,
    ReferenceOTUResponse,
    ReferenceIndexResponse,
    ReferenceGroupsResponse,
    CreateReferenceGroupResponse,
    ReferenceGroupResponse,
    ReferenceUsersSchema,
)
from virtool.uploads.models import Upload
from virtool.users.db import AttachUserTransform, extend_user

routes = Routes()

RIGHTS_SCHEMA = {
    "build": {"type": "boolean"},
    "modify": {"type": "boolean"},
    "modify_otu": {"type": "boolean"},
    "remove": {"type": "boolean"},
}


@routes.view("/refs")
class ReferencesView(PydanticView):
    async def get(self) -> r200[GetReferencesResponse]:
        """
        Find references.

        Status Codes:
            200: Successful operation
        """
        db = self.request.app["db"]

        term = self.request.query.get("find")

        db_query = {}

        if term:
            db_query = compose_regex_query(term, ["name", "data_type"])

        base_query = compose_base_find_query(
            self.request["client"].user_id,
            self.request["client"].administrator,
            self.request["client"].groups,
        )

        data = await paginate(
            db.references,
            db_query,
            self.request.query,
            sort="name",
            base_query=base_query,
            projection=virtool.references.db.PROJECTION,
        )

        await apply_transforms(data["documents"], [AttachUserTransform(db)])

        documents, official_installed = await gather(
            gather(
                *[virtool.references.db.processor(db, d) for d in data["documents"]]
            ),
            get_official_installed(db),
        )

        return json_response(
            {**data, "documents": documents, "official_installed": official_installed}
        )

    @policy(PermissionsRoutePolicy(Permission.create_ref))
    async def post(
        self, data: CreateReferenceSchema
    ) -> Union[r200[CreateReferenceResponse], r400, r403, r502]:
        """
        Create a reference.

        Creates an empty reference.

        Status Codes:
            200: Successful operation
            400: Source reference does not exist
            403: Not permitted
            502: Could not reach GitHub
        """
        db = self.request.app["db"]
        pg = self.request.app["pg"]

        settings = await get_data_from_req(self.request).settings.get_all()

        user_id = self.request["client"].user_id

        if data.clone_from:
            if not await db.references.count_documents({"_id": data.clone_from}):
                raise HTTPBadRequest(text="Source reference does not exist")

            manifest = await get_manifest(db, data.clone_from)

            document = await create_clone(
                db, settings, data.name, data.clone_from, data.description, user_id
            )

            context = {
                "created_at": document["created_at"],
                "manifest": manifest,
                "ref_id": document["_id"],
                "user_id": user_id,
            }

            task = await get_data_from_req(self.request).tasks.create(CloneReferenceTask, context=context)

            document["task"] = {"id": task["id"]}

        elif data.import_from:
            if not await get_row(pg, Upload, ("name_on_disk", data.import_from)):
                raise NotFound("File not found")

            path = self.request.app["config"].data_path / "files" / data.import_from

            document = await create_import(
                db, pg, settings, data.name, data.description, data.import_from, user_id
            )

            context = {
                "created_at": document["created_at"],
                "path": str(path),
                "ref_id": document["_id"],
                "user_id": user_id,
            }

            task = await get_data_from_req(self.request).tasks.create(ImportReferenceTask, context=context)

            document["task"] = {"id": task.id}

        elif data.remote_from:
            try:
                release = await virtool.github.get_release(
                    self.request.app["config"],
                    self.request.app["client"],
                    data.remote_from,
                    release_id=data.release_id,
                )

            except aiohttp.ClientConnectionError:
                raise HTTPBadGateway(text="Could not reach GitHub")

            except GitHubError as err:
                if "404" in str(err):
                    raise HTTPBadGateway(
                        text="Could not retrieve latest GitHub release"
                    )

                raise

            release = format_release(release)

            document = await create_remote(
                db, settings, release, data.remote_from, user_id
            )

            context = {
                "release": release,
                "ref_id": document["_id"],
                "created_at": document["created_at"],
                "user_id": user_id,
            }

            task = await get_data_from_req(self.request).tasks.create(RemoteReferenceTask, context=context)

            document["task"] = {"id": task["id"]}

        else:
            document = await create_document(
                db,
                settings,
                data.name,
                data.organism,
                data.description,
                data.data_type,
                user_id=self.request["client"].user_id,
            )

        await db.references.insert_one(document)

        headers = {"Location": f"/refs/{document['_id']}"}

        return json_response(
            await attach_computed(db, document), headers=headers, status=201
        )


@routes.view("/refs/{ref_id}")
@routes.jobs_api.get("/refs/{ref_id}")
class ReferenceView(PydanticView):
    async def get(self) -> Union[r200[ReferenceResponse], r403, r404]:
        """
        Get a reference.

        Retrieves the details of a reference.

        Status Codes:
            200: Successful operation
            403: Not permitted
            404: Not found

        """
        db = self.request.app["db"]

        ref_id = self.request.match_info["ref_id"]

        document = await db.references.find_one(ref_id)

        if not document:
            raise NotFound()

        return json_response(await attach_computed(db, document))

    async def patch(
        self, data: EditReferenceSchema
    ) -> Union[r200[ReferenceResponse], r403, r404]:
        """
        Update a reference.

        Updates an existing reference.

        Status Codes:
            200: Successful operation
            403: Insufficient rights
            404: Not found

        """
        db = self.request.app["db"]

        data = data.dict(exclude_unset=True)

        ref_id = self.request.match_info["ref_id"]

        if not await virtool.mongo.utils.id_exists(db.references, ref_id):
            raise NotFound()

        if not await virtool.references.db.check_right(self.request, ref_id, "modify"):
            raise InsufficientRights()

        targets = data.get("targets")

        if targets:
            names = [t["name"] for t in targets]

            if len(names) != len(set(names)):
                raise HTTPBadRequest(
                    text="The targets field may not contain duplicate names"
                )

        document = await virtool.references.db.edit(db, ref_id, data)

        return json_response(document)

    async def delete(self) -> Union[r202, r403, r404]:
        """
        Delete a reference.

        Deletes a reference and its associated OTUs, history, and indexes. Deleting a
        reference does not break dependent analyses and other resources.

        Status Codes:
            202: Accepted
            403: Insufficient rights
            404: Not found

        """
        db = self.request.app["db"]

        ref_id = self.request.match_info["ref_id"]

        if not await virtool.mongo.utils.id_exists(db.references, ref_id):
            raise NotFound()

        if not await virtool.references.db.check_right(self.request, ref_id, "remove"):
            raise InsufficientRights()

        user_id = self.request["client"].user_id

        context = {"ref_id": ref_id, "user_id": user_id}

        task = await get_data_from_req(self.request).tasks.create(DeleteReferenceTask, context=context)

        await db.references.delete_one({"_id": ref_id})

        headers = {"Content-Location": f"/tasks/{task['id']}"}

        return json_response(task, 202, headers)


@routes.view("/refs/{ref_id}/release")
class ReferenceReleaseView(PydanticView):
    async def get(self) -> r200[ReferenceReleaseResponse]:
        """
        Get latest update.

        Retrieves the latest remote reference update from GitHub.

        Also updates the reference document. This is the only way of doing so without
        waiting for an automatic refresh every 10 minutes.

        Status Codes:
            200: Successful operation

        """
        db = self.request.app["db"]
        ref_id = self.request.match_info["ref_id"]

        if not await virtool.mongo.utils.id_exists(db.references, ref_id):
            raise NotFound()

        if not await db.references.count_documents(
            {"_id": ref_id, "remotes_from": {"$exists": True}}
        ):
            raise HTTPBadRequest(text="Not a remote reference")

        try:
            release = await virtool.references.db.fetch_and_update_release(
                self.request.app, ref_id
            )
        except aiohttp.ClientConnectorError:
            raise HTTPBadGateway(text="Could not reach GitHub")

        if release is None:
            raise HTTPBadGateway(text="Release repository does not exist on GitHub")

        return json_response(release)


@routes.view("/refs/{ref_id}/updates")
class ReferenceUpdatesView(PydanticView):
    async def get(self) -> r200[GetReferenceUpdateResponse]:
        """
        List updates.

        Lists all updates made to the reference.

        Status Codes:
            200: Successful operation
        """
        db = self.request.app["db"]
        ref_id = self.request.match_info["ref_id"]

        if not await virtool.mongo.utils.id_exists(db.references, ref_id):
            raise NotFound()

        updates = await virtool.mongo.utils.get_one_field(
            db.references, "updates", ref_id
        )

        if updates is not None:
            updates.reverse()

        return json_response(updates or [])

    async def post(self) -> Union[r201[CreateReferenceUpdateResponse], r403, r404]:
        """
        Update a reference.

        Updates the reference to the last version of the linked remote reference.

        Status Codes:
            201: Successful operation
            403: Insufficient rights
            404: Not found
        """
        db = self.request.app["db"]

        ref_id = self.request.match_info["ref_id"]
        user_id = self.request["client"].user_id

        if not await virtool.mongo.utils.id_exists(db.references, ref_id):
            raise NotFound()

        if not await virtool.references.db.check_right(self.request, ref_id, "modify"):
            raise InsufficientRights()

        release = await virtool.mongo.utils.get_one_field(
            db.references, "release", ref_id
        )

        if release is None:
            raise HTTPBadRequest(text="Target release does not exist")

        created_at = virtool.utils.timestamp()

        context = {
            "created_at": created_at,
            "ref_id": ref_id,
            "release": await virtool.mongo.utils.get_one_field(
                db.references, "release", ref_id
            ),
            "user_id": user_id,
        }

        task = await get_data_from_req(self.request).tasks.create(UpdateRemoteReferenceTask, context=context)

        release, update_subdocument = await asyncio.shield(
            virtool.references.db.update(
                self.request, created_at, task["id"], ref_id, release, user_id
            )
        )

        return json_response(update_subdocument, status=201)


@routes.view("/refs/{ref_id}/otus")
class ReferenceOtusView(PydanticView):
    async def get(self) -> Union[r200[ReferenceOTUResponse], r404]:
        """
        Find OTUs.

        Finds OTUs by name or abbreviation. Results are paginated.

        Status Codes:
            200: Successful operation
            404: Not found
        """
        db = self.request.app["db"]

        ref_id = self.request.match_info["ref_id"]

        if not await virtool.mongo.utils.id_exists(db.references, ref_id):
            raise NotFound()

        term = self.request.query.get("find")
        verified = self.request.query.get("verified")
        names = self.request.query.get("names", False)

        data = await virtool.otus.db.find(
            db, names, term, self.request.query, verified, ref_id
        )

        return json_response(data)


@routes.view("/refs/{ref_id}/history")
class ReferenceHistoryView(PydanticView):
    async def get(self) -> Union[r200[GetHistoryResponse], r404]:
        """
        List history.

        Retrieves a paginated list of changes made to OTUs in the reference.

        Status Codes:
            200: Successful operation
            404: Not found
        """
        db = self.request.app["db"]

        ref_id = self.request.match_info["ref_id"]

        if not await db.references.count_documents({"_id": ref_id}):
            raise NotFound()

        base_query = {"reference.id": ref_id}

        unbuilt = self.request.query.get("unbuilt")

        if unbuilt == "true":
            base_query["index.id"] = "unbuilt"

        elif unbuilt == "false":
            base_query["index.id"] = {"$ne": "unbuilt"}

        data = await virtool.history.db.find(db, self.request.query, base_query)

        return json_response(data)


@routes.view("/refs/{ref_id}/indexes")
class ReferenceIndexesView(PydanticView):
    async def get(self) -> Union[r200[ReferenceIndexResponse], r404]:
        """
        List indexes.

        Retrieves a paginated list of indexes that have been created for the reference.

        Status Codes:
            200: Successful operation
            404: Not found
        """

        db = self.request.app["db"]

        ref_id = self.request.match_info["ref_id"]

        if not await virtool.mongo.utils.id_exists(db.references, ref_id):
            raise NotFound()

        data = await virtool.indexes.db.find(db, self.request.query, ref_id=ref_id)

        return json_response(data)


@routes.view("/refs/{ref_id}/groups")
class ReferenceGroupsView(PydanticView):
    async def get(self) -> Union[r200[ReferenceGroupsResponse], r404]:
        """
        List groups.

        Lists all groups that have access to the reference.

        Status Codes:
            200: Successful operation
            404: Not found
        """
        db = self.request.app["db"]
        ref_id = self.request.match_info["ref_id"]

        if not await db.references.count_documents({"_id": ref_id}):
            raise NotFound()

        groups = await virtool.mongo.utils.get_one_field(
            db.references, "groups", ref_id
        )

        return json_response(groups)

    async def post(
        self, data: CreateReferenceGroupsSchema
    ) -> Union[r201[CreateReferenceGroupResponse], r400, r403, r404]:
        """
        Add a group.

        Adds a group to the reference. Groups can view, use, and modify the reference.

        Status Codes:
            201: Successful operation
            400: Bad request
            403: Insufficient rights
            404: Not found
        """
        db = self.request.app["db"]
        ref_id = self.request.match_info["ref_id"]
        data = data.dict(exclude_none=True)

        document = await db.references.find_one(ref_id, ["groups", "users"])

        if document is None:
            raise NotFound()

        if not await virtool.references.db.check_right(
            self.request, document, "modify"
        ):
            raise InsufficientRights()

        try:
            subdocument = await virtool.references.db.add_group_or_user(
                db, ref_id, "groups", data
            )
        except DatabaseError as err:
            if "already exists" in str(err):
                raise HTTPBadRequest(text="Group already exists")

            if "does not exist" in str(err):
                raise HTTPBadRequest(text="Group does not exist")

            raise

        headers = {"Location": f"/refs/{ref_id}/groups/{subdocument['id']}"}

        return json_response(subdocument, headers=headers, status=201)


@routes.view("/refs/{ref_id}/groups/{group_id}")
class ReferenceGroupView(PydanticView):
    async def get(self) -> Union[r200[ReferenceGroupResponse], r404]:
        """
        Get a group.

        Retrieves the details of a group that has access to the reference.

        Status Codes:
            200: Successful operation
            404: Not found
        """
        db = self.request.app["db"]
        ref_id = self.request.match_info["ref_id"]
        group_id = self.request.match_info["group_id"]

        document = await db.references.find_one(
            {"_id": ref_id, "groups.id": group_id}, ["groups", "users"]
        )

        if document is None:
            raise NotFound()

        if document is not None:
            for group in document.get("groups", []):
                if group["id"] == group_id:
                    return json_response(group)

    async def patch(
        self, data: ReferenceRightsSchema
    ) -> Union[r200[ReferenceGroupResponse], r403, r404]:
        """
        Update a group.

        Updates the access rights a group has on the reference.

        Status Codes:
            200: Successful operation
            403: Insufficient rights
            404: Not found
        """
        db = self.request.app["db"]
        data = data.dict(exclude_unset=True)
        ref_id = self.request.match_info["ref_id"]
        group_id = self.request.match_info["group_id"]

        document = await db.references.find_one(
            {"_id": ref_id, "groups.id": group_id}, ["groups", "users"]
        )

        if document is None:
            raise NotFound()

        if not await virtool.references.db.check_right(self.request, ref_id, "modify"):
            raise InsufficientRights()

        subdocument = await virtool.references.db.edit_group_or_user(
            db, ref_id, group_id, "groups", data
        )

        return json_response(subdocument)

    async def delete(self) -> Union[r204, r403, r404]:
        """
        Remove a group.

        Removes a group from the reference.

        Status Codes:
            204: No content
            403: Insufficient rights
            404: Not found
        """
        db = self.request.app["db"]
        ref_id = self.request.match_info["ref_id"]
        group_id = self.request.match_info["group_id"]

        document = await db.references.find_one(
            {"_id": ref_id, "groups.id": group_id}, ["groups", "users"]
        )

        if document is None:
            raise NotFound()

        if not await virtool.references.db.check_right(self.request, ref_id, "modify"):
            raise InsufficientRights()

        await virtool.references.db.delete_group_or_user(db, ref_id, group_id, "groups")

        raise HTTPNoContent


@routes.view("/refs/{ref_id}/users")
class ReferenceUsersView(PydanticView):
    async def post(
        self, data: CreateReferenceUsersSchema
    ) -> Union[r201[List[ReferenceUsersSchema]], r400, r403, r404]:
        """
        Add a user.

        Adds a user to the reference. Users can view, use, and modify the reference.

        Status Codes:
            201: Successful operation
            400: Bad request
            403: Insufficient rights
            404: Not found
        """
        db = self.request.app["db"]
        data = data.dict(exclude_none=True)
        ref_id = self.request.match_info["ref_id"]

        document = await db.references.find_one(ref_id, ["groups", "users"])

        if document is None:
            raise NotFound()

        if not await virtool.references.db.check_right(self.request, ref_id, "modify"):
            raise InsufficientRights()

        try:
            subdocument = await virtool.references.db.add_group_or_user(
                db, ref_id, "users", data
            )
        except DatabaseError as err:
            if "already exists" in str(err):
                raise HTTPBadRequest(text="User already exists")

            if "does not exist" in str(err):
                raise HTTPBadRequest(text="User does not exist")

            raise

        headers = {"Location": f"/refs/{ref_id}/users/{subdocument['id']}"}

        return json_response(
            await extend_user(db, subdocument), headers=headers, status=201
        )


@routes.view("/refs/{ref_id}/users/{user_id}")
class ReferenceUserView(PydanticView):
    async def patch(
        self, data: ReferenceRightsSchema
    ) -> Union[r200[ReferenceGroupResponse], r403, r404]:
        """
        Update a user.

        Updates the access rights a user has on the reference.

        Status Codes:
            200: Successful operation
            403: Insufficient rights
            404: Not found
        """
        db = self.request.app["db"]
        data = data.dict(exclude_unset=True)
        ref_id = self.request.match_info["ref_id"]
        user_id = self.request.match_info["user_id"]

        document = await db.references.find_one(
            {"_id": ref_id, "users.id": user_id}, ["groups", "users"]
        )

        if document is None:
            raise NotFound()

        if not await virtool.references.db.check_right(self.request, ref_id, "modify"):
            raise InsufficientRights()

        subdocument = await virtool.references.db.edit_group_or_user(
            db, ref_id, user_id, "users", data
        )

        if subdocument is None:
            raise NotFound()

        return json_response(await extend_user(db, subdocument))

    async def delete(self) -> Union[r204, r403, r404]:
        """
        Remove a user.

        Removes a user from the reference.

        Status Codes:
            204: No content
            403: Insufficient rights
            404: Not found
        """
        db = self.request.app["db"]
        ref_id = self.request.match_info["ref_id"]
        user_id = self.request.match_info["user_id"]

        document = await db.references.find_one(
            {"_id": ref_id, "users.id": user_id}, ["groups", "users"]
        )

        if document is None:
            raise NotFound()

        if not await virtool.references.db.check_right(self.request, ref_id, "modify"):
            raise InsufficientRights()

        await virtool.references.db.delete_group_or_user(db, ref_id, user_id, "users")

        raise HTTPNoContent
