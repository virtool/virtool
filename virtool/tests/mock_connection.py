class MockConnection:

    def __init__(self, bound_user, authorized=True):
        self.user = bound_user
        self.authorized = authorized

