import asyncio

from aiohttp.web_response import Response
from virtool_core.models.roles import AdministratorRole
from virtool_core.models.user import User
from virtool_core.utils import document_enum

from virtool.administrators.oas import (
    AdministratorRoleUpdateRequest,
    ListAdministratorResponse,
    ListRolesResponse,
    RunActionRequest,
    UserResponse,
    UserUpdateRequest,
)
from virtool.api.custom_json import json_response
from virtool.api.errors import APIBadRequest, APIForbidden, APINotFound
from virtool.api.policy import AdministratorRoutePolicy, policy
from virtool.api.routes import Routes
from virtool.api.status import R200, R201, R202, R400, R403, R404
from virtool.api.view import APIView
from virtool.authorization.client import (
    AuthorizationClient,
    get_authorization_client_from_req,
)
from virtool.data.errors import (
    ResourceConflictError,
    ResourceError,
    ResourceNotFoundError,
)
from virtool.flags import FlagName, flag
from virtool.users.checks import check_password_length
from virtool.users.oas import CreateUserRequest
from virtool.validation import is_set

routes = Routes()

AVAILABLE_ROLES = [
    {"id": role, "name": role.capitalize(), "description": role.__doc__}
    for role in document_enum(AdministratorRole)
]


@routes.web.view("/admin/roles")
@flag(FlagName.ADMINISTRATOR_ROLES)
class RolesView(APIView):
    @policy(AdministratorRoutePolicy(AdministratorRole.BASE))
    async def get(self) -> R200[ListRolesResponse]:
        """List administrator roles.

        Status Codes:
            200: Successful operation
        """
        return json_response(AVAILABLE_ROLES)


@routes.web.view("/admin/users")
class AdminUsersView(APIView):
    @policy(AdministratorRoutePolicy(AdministratorRole.USERS))
    async def get(
        self,
        active: bool = True,
        administrator: bool | None = None,
        term: str | None = None,
    ) -> R200[ListAdministratorResponse]:
        """Find users.

        Returns a paginated list of users.

        Status Codes:
            200: Successful operation
        """
        url_query = self.request.query

        try:
            page = int(url_query["page"])
        except (KeyError, ValueError):
            page = 1

        try:
            per_page = int(url_query["per_page"])
        except (KeyError, ValueError):
            per_page = 25

        return json_response(
            await self.data.users.find(
                page,
                per_page,
                active,
                administrator,
                term,
            ),
        )

    @policy(AdministratorRoutePolicy(AdministratorRole.USERS))
    async def post(self, data: CreateUserRequest) -> R201[User] | R400 | R403:
        """Create a user.

        Creates a new user.

        Status Codes:
            201: Successful operation
            400: User already exists
            400: Password does not meet length requirement
            403: Not permitted
        """
        if data.handle == "virtool":
            raise APIBadRequest("Reserved user name: virtool")

        if error := await check_password_length(self.request, password=data.password):
            raise APIBadRequest(error)

        try:
            user = await self.data.users.create(
                data.handle,
                data.password,
                data.force_reset,
            )
        except ResourceConflictError as err:
            raise APIBadRequest(str(err))

        return json_response(
            user,
            headers={"Location": f"/admin/users/{user.id}"},
            status=201,
        )


@routes.web.view("/admin/users/{user_id}")
class AdminUserView(APIView):
    @policy(AdministratorRoutePolicy(AdministratorRole.USERS))
    async def get(self, user_id: str, /) -> R200[UserResponse] | R404:
        """Get a user.

        Fetches the details of a user.

        Status Codes:
            200: Successful operation
            404: User not found
        """
        try:
            user = await self.data.users.get(user_id)
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(user)

    @policy(AdministratorRoutePolicy(AdministratorRole.USERS))
    async def patch(
        self,
        user_id: str,
        /,
        data: UserUpdateRequest,
    ) -> R200[UserResponse] | R404:
        """Update a user.

        Status Codes:
            200: Successful operation
            404: User not found
        """
        if not await check_administrator_can_update_user(
            get_authorization_client_from_req(self.request),
            self.request["client"].user_id,
            user_id,
        ):
            raise APIForbidden(
                "Insufficient privileges",
                error_id="insufficient_privileges",
            )

        if is_set(data.password) and (
            error := await check_password_length(self.request, password=data.password)
        ):
            raise APIBadRequest(error)

        try:
            user = await self.data.users.update(user_id, data)
        except ResourceNotFoundError:
            raise APINotFound()
        except ResourceConflictError as err:
            raise APIBadRequest(str(err))

        return json_response(user)


@routes.web.view("/admin/users/{user_id}/role")
class AdminRoleView(APIView):
    @policy(AdministratorRoutePolicy(AdministratorRole.FULL))
    async def put(
        self,
        user_id: str,
        /,
        data: AdministratorRoleUpdateRequest,
    ) -> R200[UserResponse] | R404:
        """Set administrator role.

        Updates the user's administrator role.

        Status Codes:
            201: Successful operation
            404: User not found
        """
        if user_id == self.request["client"].user_id:
            raise APIBadRequest("Administrators cannot change their own role.")

        try:
            if is_set(data.role):
                user = await self.data.users.set_administrator_role(
                    user_id,
                    data.role,
                )
            else:
                user = await self.data.users.get(user_id)

        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(user, status=200)


@routes.web.view("/admin/actions")
class AdminActionsView(APIView):
    @policy(AdministratorRoutePolicy(AdministratorRole.FULL))
    async def put(self, data: RunActionRequest) -> R202 | R400:
        """Initiate an action.

        Starts an action with the given name.

        Status Codes:
            200: Successful operation
            404: User not found
        """
        try:
            await self.data.administrators.run_action(data.name)
        except ResourceError:
            raise APIBadRequest("Invalid action name")

        return Response(status=202)


async def check_administrator_can_update_user(
    authorization_client: AuthorizationClient,
    req_user_id: str,
    user_id: str,
) -> bool:
    """Check if an administrator user has sufficient permissions to update another user.

    Returns True if the user to be edited is not an administrator or if the requesting
    user is a full administrator.

    :param authorization_client: the authorization client
    :param req_user_id: the requesting user id
    :param user_id: the id of the user being updated

    """
    admin_tuple, req_admin_tuple = await asyncio.gather(
        authorization_client.get_administrator(user_id),
        authorization_client.get_administrator(req_user_id),
    )

    if admin_tuple[1] is None:
        return True

    if req_admin_tuple[1] == AdministratorRole.FULL:
        return True

    return False
