from virtool.user_groups import merge_group_permissions


class TestMergeGroupPermissions:

    def test_all_permissions(self, make_groups, all_permissions):
        """
        Make sure all permissions are set ``True`` when at least one passed group has all permissions.

        """
        assert merge_group_permissions(make_groups("limited", "administrator", "moderator")) == all_permissions

    def test_all_permissions_one(self, make_groups, all_permissions):
        """
        Make sure all permissions are set ``True`` when at only one passed group has all permissions.

        """
        assert merge_group_permissions(make_groups("administrator")) == all_permissions

    def test_no_permissions(self, make_groups, no_permissions):
        """
        Make sure no permissions are returned ``True`` when the passed groups have no permissions.

        """
        assert merge_group_permissions(make_groups("limited")) == no_permissions

    def test_some_permissions(self, make_groups, no_permissions):
        """
        Make sure the privileges of the more permitted group are returned even when the other group has no permissions.

        """
        permissions = merge_group_permissions(make_groups("limited", "technician"))
        assert permissions == dict(no_permissions, add_sample=True, cancel_job=True)

    def test_more_permissions(self, make_groups, all_permissions):
        """
        Make sure that the permissions of the more permitted group are return along with those of a less permitted
        group.

        """
        permissions = merge_group_permissions(make_groups("technician", "moderator"))
        assert permissions == dict(all_permissions, modify_options=False)
