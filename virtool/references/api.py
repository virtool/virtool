"""Request handlers for the API endpoints that deal with references.

TODO: Drop support for string group ids when we fully migrate to SQL.
"""

from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import (
    r200,
    r201,
    r204,
    r400,
    r403,
    r404,
    r409,
)
from pydantic import Field

from virtool.api.custom_json import json_response
from virtool.api.errors import (
    APIBadRequest,
    APIConflict,
    APIInsufficientRights,
    APINoContent,
    APINotFound,
)
from virtool.api.pagination import Page, PerPage
from virtool.api.policy import PermissionRoutePolicy, policy
from virtool.api.routes import Routes
from virtool.authorization.permissions import LegacyPermission
from virtool.data.errors import (
    ResourceConflictError,
    ResourceError,
    ResourceNotFoundError,
)
from virtool.data.utils import get_data_from_req
from virtool.history.models import HistorySearchResult
from virtool.indexes.models import IndexMinimal
from virtool.indexes.oas import ListIndexesResponse
from virtool.models.roles import AdministratorRole
from virtool.otus.models import OTU, OTUSearchResult
from virtool.otus.oas import CreateOTURequest
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

routes = Routes()


@routes.view("/references/v1")
class ReferencesView(PydanticView):
    async def get(
        self,
        find: str | None = None,
        page: Page = 1,
        per_page: PerPage = 25,
        archived: bool | None = Field(
            default=None,
            description=(
                "Lifecycle filter. Omit to return both active and archived "
                "references; `true` to return only archived references; "
                "`false` to return only active references."
            ),
        ),
    ) -> r200[ReferenceSearchResult] | r400:
        """Find references.

        Lists references that match the find term.

        Status Codes:
            200: Successful operation
            400: Invalid query
        """
        search_result = await get_data_from_req(self.request).references.find(
            find,
            self.request["client"].user_id,
            self.request["client"].administrator_role == AdministratorRole.FULL,
            self.request["client"].groups,
            page,
            per_page,
            archived,
        )

        return json_response(search_result)

    @policy(PermissionRoutePolicy(LegacyPermission.CREATE_REF))
    async def post(
        self,
        data: CreateReferenceRequest,
    ) -> r200[Reference] | r400 | r403:
        """Create a reference.

        Creates an empty reference.

        Status Codes:
            200: Successful operation
            400: Source reference does not exist
            403: Not permitted
        """
        try:
            reference = await get_data_from_req(self.request).references.create(
                data,
                self.request["client"].user_id,
            )
        except ResourceNotFoundError as err:
            if "Source reference does not exist" in str(err) or "File not found" in str(
                err,
            ):
                raise APIBadRequest(str(err))

            raise

        return json_response(
            reference,
            status=201,
            headers={"Location": f"/references/v1/{reference.id}"},
        )


@routes.view("/references/v1/{ref_id}")
@routes.jobs_api.get("/references/v1/{ref_id}")
class ReferenceView(PydanticView):
    async def get(self, ref_id: int | str, /) -> r200[Reference] | r403 | r404:
        """Get a reference.

        Fetches the details of a reference.

        Status Codes:
            200: Successful operation
            403: Not permitted
            404: Not found

        """
        try:
            reference = await get_data_from_req(self.request).references.get(ref_id)
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(reference)

    async def patch(
        self,
        ref_id: int | str,
        /,
        data: UpdateReferenceRequest,
    ) -> r200[Reference] | r403 | r404:
        """Update a reference.

        Updates an existing reference.

        Status Codes:
            200: Successful operation
            403: Insufficient rights
            404: Not found

        """
        client = self.request["client"]

        try:
            if not await get_data_from_req(self.request).references.check_right(
                ref_id,
                "modify",
                user_id=client.user_id,
                group_ids=client.groups,
                administrator=client.administrator_role == AdministratorRole.FULL,
            ):
                raise APIInsufficientRights()
        except ResourceNotFoundError:
            raise APINotFound

        try:
            reference = await get_data_from_req(self.request).references.update(
                ref_id,
                data,
            )
        except ResourceNotFoundError:
            raise APINotFound()
        except ResourceConflictError as err:
            raise APIConflict(str(err))

        return json_response(reference)


@routes.view("/references/v1/{ref_id}/archive")
class ReferenceArchiveView(PydanticView):
    async def post(self, ref_id: int | str, /) -> r200[Reference] | r403 | r404 | r409:
        """Archive a reference.

        Marks a reference as archived. Archiving the official plant viruses
        reference is not allowed.

        Status Codes:
            200: Successful operation
            403: Insufficient rights
            404: Not found
            409: Cannot archive the official plant viruses reference
        """
        client = self.request["client"]

        try:
            if not await get_data_from_req(self.request).references.check_right(
                ref_id,
                "modify",
                user_id=client.user_id,
                group_ids=client.groups,
                administrator=client.administrator_role == AdministratorRole.FULL,
            ):
                raise APIInsufficientRights()
        except ResourceNotFoundError:
            raise APINotFound

        try:
            reference = await get_data_from_req(self.request).references.archive(
                ref_id,
            )
        except ResourceNotFoundError:
            raise APINotFound()
        except ResourceConflictError as err:
            raise APIConflict(str(err))

        return json_response(reference)


@routes.view("/references/v1/{ref_id}/unarchive")
class ReferenceUnarchiveView(PydanticView):
    async def post(self, ref_id: int | str, /) -> r200[Reference] | r403 | r404:
        """Unarchive a reference.

        Marks a reference as not archived.

        Status Codes:
            200: Successful operation
            403: Insufficient rights
            404: Not found
        """
        client = self.request["client"]

        try:
            if not await get_data_from_req(self.request).references.check_right(
                ref_id,
                "modify",
                user_id=client.user_id,
                group_ids=client.groups,
                administrator=client.administrator_role == AdministratorRole.FULL,
            ):
                raise APIInsufficientRights()
        except ResourceNotFoundError:
            raise APINotFound

        try:
            reference = await get_data_from_req(self.request).references.unarchive(
                ref_id,
            )
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(reference)


@routes.view("/references/v1/{ref_id}/otus")
class ReferenceOTUsView(PydanticView):
    async def get(
        self,
        ref_id: int | str,
        /,
        find: str | None,
        verified: bool | None,
        page: Page = 1,
        per_page: PerPage = 25,
    ) -> r200[OTUSearchResult] | r400 | r404:
        """Find OTUs.

        Lists OTUs by name or abbreviation. Results are paginated.

        Status Codes:
            200: Successful operation
            400: Invalid query
            404: Not found
        """
        try:
            data = await get_data_from_req(self.request).references.find_otus(
                find,
                verified,
                ref_id,
                page,
                per_page,
            )
        except ResourceNotFoundError:
            raise APINotFound()
        return json_response(data)

    async def post(
        self,
        ref_id: int | str,
        /,
        data: CreateOTURequest,
    ) -> r201[OTU] | r400 | r403 | r404:
        """Create OTU.

        Creates an OTU.
        """
        client = self.request["client"]

        try:
            if not await get_data_from_req(self.request).references.check_right(
                ref_id,
                "modify_otu",
                user_id=client.user_id,
                group_ids=client.groups,
                administrator=client.administrator_role == AdministratorRole.FULL,
            ):
                raise APIInsufficientRights()
        except ResourceNotFoundError:
            raise APINotFound()

        try:
            otu = await get_data_from_req(self.request).references.create_otu(
                ref_id,
                data,
                client.user_id,
            )
        except ResourceNotFoundError:
            raise APINotFound()
        except ResourceConflictError as e:
            raise APIConflict(str(e))
        except ResourceError as e:
            raise APIBadRequest(str(e))

        return json_response(otu, status=201, headers={"Location": f"/otus/{otu.id}"})


@routes.view("/references/v1/{ref_id}/history")
class ReferenceHistoryView(PydanticView):
    async def get(
        self,
        ref_id: int | str,
        /,
        unbuilt: bool | None = Field(
            default=None,
            description="Filter by build status",
        ),
        page: Page = 1,
        per_page: PerPage = 25,
    ) -> r200[HistorySearchResult] | r400 | r404:
        """List history.

        Lists changes made to OTUs in the reference.

        Status Codes:
            200: Successful operation
            400: Invalid query
            404: Not found
        """
        try:
            data = await get_data_from_req(self.request).references.find_history(
                ref_id,
                unbuilt,
                page,
                per_page,
            )
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(data)


@routes.view("/references/v1/{ref_id}/indexes")
class ReferenceIndexesView(PydanticView):
    async def get(
        self,
        ref_id: int | str,
        /,
        page: Page = 1,
        per_page: PerPage = 25,
    ) -> r200[ListIndexesResponse] | r400 | r404:
        """List indexes.

        Lists indexes that have been created for the reference.

        Status Codes:
            200: Successful operation
            400: Invalid query
            404: Not found
        """
        try:
            data = await get_data_from_req(self.request).references.find_indexes(
                ref_id,
                page,
                per_page,
            )
        except ResourceNotFoundError:
            raise APINotFound

        return json_response(data)

    async def post(
        self,
        ref_id: int | str,
        /,
    ) -> r201[IndexMinimal] | r403 | r404:
        """Create an index.

        Starts a job to rebuild the otus Bowtie2 index on disk.

        Does a check to make sure there are no unverified OTUs in the collection
        and updates otu history to show the version and id of the new index.

        Status Codes:
            201: Successful operation
            403: Insufficient rights
            404: Not found

        """
        client = self.request["client"]

        try:
            if not await get_data_from_req(self.request).references.check_right(
                ref_id,
                "build",
                user_id=client.user_id,
                group_ids=client.groups,
                administrator=client.administrator_role == AdministratorRole.FULL,
            ):
                raise APIInsufficientRights()
        except ResourceNotFoundError:
            raise APINotFound()

        try:
            document = await get_data_from_req(self.request).references.create_index(
                ref_id,
                client.user_id,
            )
        except ResourceConflictError as err:
            raise APIConflict(str(err))
        except ResourceNotFoundError:
            raise APINotFound()
        except ResourceError as err:
            raise APIBadRequest(str(err))

        return json_response(
            document,
            status=201,
            headers={"Location": f"/indexes/{document.id}"},
        )


@routes.view("/references/v1/{ref_id}/groups")
class ReferenceGroupsView(PydanticView):
    async def get(self, ref_id: int | str, /) -> r200[ReferenceGroup] | r404:
        """List groups.

        Lists all groups that have access to the reference.

        Status Codes:
            200: Successful operation
            404: Not found
        """
        try:
            groups = await get_data_from_req(self.request).references.list_groups(
                ref_id,
            )
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(groups)

    async def post(
        self,
        ref_id: int | str,
        /,
        data: CreateReferenceGroupRequest,
    ) -> r201[ReferenceGroup] | r400 | r403 | r404:
        """Add a group.

        Adds a group to the reference. Groups can view, use, and modify the reference.

        Status Codes:
            201: Successful operation
            400: Bad request
            403: Insufficient rights
            404: Not found
        """
        try:
            group = await get_data_from_req(self.request).references.create_group(
                ref_id,
                data,
            )
        except ResourceNotFoundError:
            raise APINotFound()
        except ResourceConflictError as err:
            raise APIBadRequest(str(err))

        return json_response(
            group,
            status=201,
            headers={"Location": f"/references/v1/{ref_id}/groups/{group.id}"},
        )


@routes.view("/references/v1/{ref_id}/groups/{group_id}")
class ReferenceGroupView(PydanticView):
    async def get(
        self,
        ref_id: int | str,
        group_id: int | str,
        /,
    ) -> r200[ReferenceGroup] | r404:
        """Get a group.

        Fetches the details of a group that has access to the reference.

        Status Codes:
            200: Successful operation
            404: Not found
        """
        try:
            group = await get_data_from_req(self.request).references.get_group(
                ref_id,
                group_id,
            )
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(group)

    async def patch(
        self,
        ref_id: int | str,
        group_id: int | str,
        /,
        data: ReferenceRightsRequest,
    ) -> r200[ReferenceGroup] | r403 | r404:
        """Update a group.

        Updates the access rights a group has on the reference.

        Status Codes:
            200: Successful operation
            403: Insufficient rights
            404: Not found
        """
        client = self.request["client"]

        try:
            if not await get_data_from_req(self.request).references.check_right(
                ref_id,
                "modify",
                user_id=client.user_id,
                group_ids=client.groups,
                administrator=client.administrator_role == AdministratorRole.FULL,
            ):
                raise APIInsufficientRights()
        except ResourceNotFoundError:
            raise APINotFound()

        try:
            group = await get_data_from_req(self.request).references.update_group(
                ref_id,
                group_id,
                data,
            )
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(group)

    async def delete(
        self, ref_id: int | str, group_id: int | str, /
    ) -> r204 | r403 | r404:
        """Delete a group.

        Deletes a group from the reference.

        Status Codes:
            204: No content
            403: Insufficient rights
            404: Not found
        """
        client = self.request["client"]

        try:
            if not await get_data_from_req(self.request).references.check_right(
                ref_id,
                "modify",
                user_id=client.user_id,
                group_ids=client.groups,
                administrator=client.administrator_role == AdministratorRole.FULL,
            ):
                raise APIInsufficientRights()
        except ResourceNotFoundError:
            raise APINotFound()

        try:
            await get_data_from_req(self.request).references.delete_group(
                ref_id,
                group_id,
            )
        except ResourceNotFoundError:
            raise APINotFound()

        raise APINoContent()


@routes.view("/references/v1/{ref_id}/users")
class ReferenceUsersView(PydanticView):
    async def post(
        self,
        ref_id: int | str,
        /,
        data: CreateReferenceUserRequest,
    ) -> r201[list[ReferenceUser]] | r400 | r403 | r404:
        """Add a user.

        Adds a user to the reference. Users can view, use, and modify the reference.

        Status Codes:
            201: Successful operation
            400: Bad request
            403: Insufficient rights
            404: Not found

        """
        client = self.request["client"]

        try:
            if not await get_data_from_req(self.request).references.check_right(
                ref_id,
                "modify",
                user_id=client.user_id,
                group_ids=client.groups,
                administrator=client.administrator_role == AdministratorRole.FULL,
            ):
                raise APIInsufficientRights()
        except ResourceNotFoundError:
            raise APINotFound()

        try:
            user = await get_data_from_req(self.request).references.create_user(
                ref_id,
                data,
            )
        except ResourceNotFoundError:
            raise APINotFound()
        except ResourceConflictError as err:
            raise APIBadRequest(str(err))

        return json_response(
            user,
            status=201,
            headers={"Location": f"/references/v1/{ref_id}/users/{user.id}"},
        )


@routes.view("/references/v1/{ref_id}/users/{user_id}")
class ReferenceUserView(PydanticView):
    async def patch(
        self,
        ref_id: int | str,
        user_id: int,
        /,
        data: ReferenceRightsRequest,
    ) -> r200[ReferenceUser] | r403 | r404:
        """Update a user.

        Updates the access rights a user has on the reference.

        Status Codes:
            200: Successful operation
            403: Insufficient rights
            404: Not found
        """
        client = self.request["client"]

        try:
            if not await get_data_from_req(self.request).references.check_right(
                ref_id,
                "modify",
                user_id=client.user_id,
                group_ids=client.groups,
                administrator=client.administrator_role == AdministratorRole.FULL,
            ):
                raise APIInsufficientRights()
        except ResourceNotFoundError:
            raise APINotFound()

        try:
            user = await get_data_from_req(self.request).references.update_user(
                ref_id,
                user_id,
                data,
            )
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(user)

    async def delete(self, ref_id: int | str, user_id: int, /) -> r204 | r403 | r404:
        """Remove a user.

        Removes a user from the reference.

        Status Codes:
            204: No content
            403: Insufficient rights
            404: Not found
        """
        client = self.request["client"]

        try:
            if not await get_data_from_req(self.request).references.check_right(
                ref_id,
                "modify",
                user_id=client.user_id,
                group_ids=client.groups,
                administrator=client.administrator_role == AdministratorRole.FULL,
            ):
                raise APIInsufficientRights()
        except ResourceNotFoundError:
            raise APINotFound()

        try:
            await get_data_from_req(self.request).references.delete_user(
                ref_id,
                user_id,
            )
        except ResourceNotFoundError:
            raise APINotFound()

        raise APINoContent()
