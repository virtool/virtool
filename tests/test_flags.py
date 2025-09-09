from virtool.administrators.api import RolesView
from virtool.flags import FeatureFlags, FlagName


def test_check_flag_enabled():
    feature_flags = FeatureFlags([FlagName.SPACES])
    assert feature_flags.check_flag_enabled(FlagName.SPACES) is True


def test_flag_decorator():
    feature_flag = getattr(RolesView, "feature_flag", None)
    assert feature_flag == FlagName.ADMINISTRATOR_ROLES
