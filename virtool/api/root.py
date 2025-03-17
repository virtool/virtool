from contextlib import suppress

from virtool.api.custom_json import json_response
from virtool.api.policy import PublicRoutePolicy, policy
from virtool.api.routes import Routes
from virtool.api.status import R200
from virtool.api.view import APIView
from virtool.config import get_config_from_req

API_URL_ROOT = "https://www.virtool.ca/docs/api"

routes = Routes()


@routes.job.view("/")
@routes.web.view("/")
class RootView(APIView):
    @policy(PublicRoutePolicy)
    async def get(self) -> R200:
        """Get general API information.

        Returns endpoints, API version, and other general information.
        """
        first_user = not await self.data.users.check_users_exist()

        app_data = {
            "dev": get_config_from_req(self.request).dev,
            "first_user": first_user,
            "endpoints": {
                "authentication": {
                    "url": "/overview/authentication",
                    "doc": f"{API_URL_ROOT}/overview/authentication",
                },
                "errors": {
                    "url": "/overview/errors",
                    "doc": f"{API_URL_ROOT}/overview/errors",
                },
                "account": {"url": "/account", "doc": f"{API_URL_ROOT}/account"},
                "admin": {"url": "/admin", "doc": f"{API_URL_ROOT}/admin"},
                "analyses": {"url": "/analyses", "doc": f"{API_URL_ROOT}/analyses"},
                "groups": {"url": "/groups", "doc": f"{API_URL_ROOT}/groups"},
                "history": {"url": "/history", "doc": f"{API_URL_ROOT}/history"},
                "hmms": {"url": "/hmms", "doc": f"{API_URL_ROOT}/hmms"},
                "indexes": {"url": "/indexes", "doc": f"{API_URL_ROOT}/indexes"},
                "instance_message": {
                    "url": "/instance_message",
                    "doc": f"{API_URL_ROOT}/instance_message",
                },
                "jobs": {"url": "/jobs", "doc": f"{API_URL_ROOT}/jobs"},
                "labels": {"url": "/labels", "doc": f"{API_URL_ROOT}/labels"},
                "ml": {"url": "/ml", "doc": f"{API_URL_ROOT}/ml"},
                "otus": {"url": "/otus", "doc": f"{API_URL_ROOT}/otus"},
                "references": {"url": "/references", "doc": f"{API_URL_ROOT}/refs"},
                "samples": {"url": "/samples", "doc": f"{API_URL_ROOT}/samples"},
                "settings": {"url": "/settings", "doc": f"{API_URL_ROOT}/settings"},
                "spaces": {"url": "/spaces", "doc": f"{API_URL_ROOT}/spaces"},
                "subtraction": {
                    "url": "/subtraction",
                    "doc": f"{API_URL_ROOT}/subtraction",
                },
                "tasks": {"url": "/tasks", "doc": f"{API_URL_ROOT}/tasks"},
                "uploads": {"url": "/uploads", "doc": f"{API_URL_ROOT}/uploads"},
                "users": {"url": "/users", "doc": f"{API_URL_ROOT}/users"},
            },
        }

        with suppress(KeyError):
            app_data["version"] = self.request.app["version"]

        return json_response(app_data)
