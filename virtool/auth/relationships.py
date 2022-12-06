class BaseRelationship:

    def __init__(self, relation):
        self.object_name = "virtool"
        self.object_type = "app"
        self.relation = relation

    ...


class GroupPermission(BaseRelationship):

    def __init__(self, group_id, relation):
        super().__init__(relation)
        self.user_id = group_id
        self.user_type = "group"


class UserPermission(BaseRelationship):

    def __init__(self, user_id, relation):
        super().__init__(relation)
        self.user_id = user_id
        self.user_type = "user"

