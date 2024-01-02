from typing import List, Callable
from enum import Enum
from aiohttp import web
from aiohttp.web import Request

from virtool.api.errors import APINotFound


class FlagName(Enum):
    SPACES = "SPACES"
    ML_MODELS = "ML_MODELS"
    ADMINISTRATOR_ROLES = "ADMINISTRATOR_ROLES"


class FeatureFlags:
    """
    Maintains default values for feature flags and can accepts list of enabled flags.
    """

    def __init__(self, overrides: List[FlagName]):
        self._flags = {
            FlagName.ADMINISTRATOR_ROLES: True,
            FlagName.ML_MODELS: False,
            FlagName.SPACES: False,
        }

        for flag_name, flag_value in self._flags.items():
            setattr(
                self,
                flag_name.name,
                flag_value if flag_name not in overrides else True,
            )

    def check_flag_enabled(self, feature_flag: FlagName) -> bool:
        """
        Checks whether the specified feature flag is enabled.
        :param feature_flag: the name of the feature flag
        """
        return getattr(self, feature_flag.name)


def flag(feature_flag: FlagName):
    """
    Prevents access to the decorated request handler if "feature_flag" is not enabled.
    :param feature_flag: feature flag name associated with the route
    """

    def decorator(route):
        route.feature_flag = feature_flag
        return route

    return decorator


@web.middleware
async def feature_flag_middleware(req: Request, handler: Callable):
    """
    Enables or disables routes based on feature flag value.
    """

    feature_flag = getattr(handler, "feature_flag", None)

    if (
        feature_flag is not None
        and req.app["flags"].check_flag_enabled(feature_flag) is False
    ):
        raise APINotFound

    return await handler(req)
