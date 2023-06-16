from typing import List, Callable, Dict
from enum import Enum
from aiohttp import web
from aiohttp.web_exceptions import HTTPNotFound
from aiohttp.web import Request

import virtool.http.routes
from virtool.types import App

routes = virtool.http.routes.Routes()


class FlagName(Enum):
    FF_SPACES = "FF_SPACES"
    FF_ML_MODELS = "FF_ML_MODELS"
    FF_ADMINISTRATOR_ROLES = "FF_ADMINISTRATOR_ROLES "


class FeatureFlags:
    """
    Class contains the derived value of the feature flags and cli flag config.
    """

    def __init__(self):
        self.constants = {
            FlagName.FF_ADMINISTRATOR_ROLES.value: True,
            FlagName.FF_ML_MODELS.value: False,
            FlagName.FF_SPACES.value: False,
        }

    def derive_flag_values(self, cli_flags: List[str]) -> Dict[str, bool]:
        """
        Derives flag values based on the hardcoded values and the cli flags.
        """
        return {
            constant_name: constant_value if constant_name not in cli_flags else True
            for constant_name, constant_value in self.constants.items()
        }


def flag(feature_flag: str):
    """
    Sets the feature flag attribute for the route.
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

    if req.app["flags"].get(feature_flag) is False:
        raise HTTPNotFound(text="API route disabled")

    return await handler(req)


def set_feature_flags(cli_flags: List[str]) -> Dict[str, bool]:
    """
    Sets the flags based on CLI flag values.
    """

    feature_flags = FeatureFlags()
    return feature_flags.derive_flag_values(cli_flags)


def check_flag_enabled(app: App, feature_flag: str):
    """
    Checks whether the specified feature flag is enabled.
    """
    if feature_flag not in [member.value for member in FlagName]:
        raise ValueError("Invalid flag name, use FlagName Enum")

    flags = app["flags"]

    return flags.get(feature_flag)
