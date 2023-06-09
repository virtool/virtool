from typing import List

from aiohttp.web_exceptions import HTTPNotFound
from aiohttp_pydantic import PydanticView

import virtool.http.routes

FF_ADMINISTRATOR_ROLES = True
FF_ML_MODELS = False
FF_SPACES = False

cli_feature_flags = []

routes = virtool.http.routes.Routes()


class FeatureFlags:
    """
    Class contains the derived value of the feature flags and cli flag config
    """

    flags = []

    def __init__(self):
        self.constants = {
            'FF_ADMINISTRATOR_ROLES': FF_ADMINISTRATOR_ROLES,
            'FF_ML_MODELS': FF_ML_MODELS,
            'FF_SPACES': FF_SPACES,
        }
        self.set_attributes()

    def set_attributes(self):
        for attr_name, constant_value in self.constants.items():
            setattr(
                self, attr_name, constant_value if attr_name not in self.flags else True
            )


def check_flag_enabled(feature_flag: str):
    derived_feature_flags = FeatureFlags()

    if feature_flag == "FF_ADMINISTRATOR_ROLES":
        return derived_feature_flags.FF_ADMINISTRATOR_ROLES
    if feature_flag == "FF_ML_MODELS":
        return derived_feature_flags.FF_ML_MODELS
    if feature_flag == "FF_SPACES":
        return derived_feature_flags.FF_SPACES
    return None


def flag(feature_flag: str):
    """
    Registers or does not register route based on feature flag
    :param feature_flag: flag used to determine whether to return route or not
    :param cli_feature_flags: cli list of flags to enable

    Apply flag decorator under @routes.view("url") for API routes
    """

    def func(route):
        if check_flag_enabled(feature_flag):
            return route
        return FeatureOff

    return func


@routes.view("/featureoff")
@staticmethod
class FeatureOff(PydanticView):
    def get(self):
        raise HTTPNotFound(text="API route off")
