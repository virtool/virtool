from virtool.flags import FeatureFlags, FlagName
from virtool.administrators.api import RolesView


def test_derive_flag_values():
    feature_flags = FeatureFlags()

    flag_results = feature_flags.derive_flag_values([FlagName.FF_SPACES.value])

    assert flag_results.get(FlagName.FF_SPACES.value) is True


def test_flag():
    feature_flag = getattr(RolesView, "feature_flag", None)

    assert feature_flag == FlagName.FF_ADMINISTRATOR_ROLES.value
