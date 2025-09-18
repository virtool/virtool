from virtool.administrators.api import RolesView
from virtool.flags import FeatureFlags, FlagName


def test_check_flag_enabled():
    """Test that enabling a flag results in check_flag_enabled return true."""
    feature_flags = FeatureFlags([FlagName.ADMINISTRATOR_ROLES])
    assert feature_flags.check_flag_enabled(FlagName.ADMINISTRATOR_ROLES) is True


def test_flag_decorator():
    feature_flag = getattr(RolesView, "feature_flag", None)
    assert feature_flag == FlagName.ADMINISTRATOR_ROLES
