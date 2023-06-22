from typing import List, Callable
from enum import Enum
from aiohttp import web
from aiohttp.web_exceptions import HTTPNotFound
from aiohttp.web import Request


class FlagName(Enum):
    SPACES = "SPACES"
    ML_MODELS = "ML_MODELS"
    ADMINISTRATOR_ROLES = "ADMINISTRATOR_ROLES"


class FeatureFlags:
    """
    Class contains the derived value of the feature flags.
    """

    def __init__(self, cli_flags: List[FlagName]):
        self.constants = {
            FlagName.ADMINISTRATOR_ROLES: True,
            FlagName.ML_MODELS: False,
            FlagName.SPACES: False,
        }
        self.set_derived_flag_values(cli_flags)

    def set_derived_flag_values(self, cli_flags: List[FlagName]):
        """
        :param cli_flags:
        """
        for attr_name, constant_value in self.constants.items():
            setattr(
                self,
                attr_name.name,
                constant_value if attr_name not in cli_flags else True,
            )

    def check_flag_enabled(self, feature_flag: FlagName):
        if feature_flag is None:
            return None
        return getattr(self, feature_flag.name)


def flag(feature_flag: FlagName):
    """
    Sets the feature flag attribute for the route.
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

    if req.app["flags"].check_flag_enabled(feature_flag) is False:
        raise HTTPNotFound

    return await handler(req)
