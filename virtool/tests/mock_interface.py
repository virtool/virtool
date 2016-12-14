import virtool.gen


class EmptyInterface:

    def __init__(self, dispatch, collections, settings):
        self.dispatch = dispatch
        self.collection = collections
        self.settings = settings


class MockInterface(EmptyInterface):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    @virtool.gen.exposed_method([])
    def test_exposed_method(self, transaction):
        data = transaction.data
        data["value"] += "_hello_world"

        self.dispatch({
            "operation": "update",
            "interface": "test",
            "message": data
        })

        return True, data

    @virtool.gen.exposed_method([])
    def test_name_error_method(self, transaction):
        print(non_existent_variable)

        return False, dict(message="Will never see this")

    @virtool.gen.exposed_method([])
    def test_type_error_method(self, transaction):
        print(1 + "5")

        return False, dict(message="Will never see this")

    @virtool.gen.exposed_method([])
    def test_no_transaction_method(self):
        self.dispatch({
            "operation": "update",
            "interface": "test",
            "message": "the was no transaction for this exposed method call"
        })

        return True, dict(message="no transaction")

    @virtool.gen.exposed_method(["modify_options"])
    def test_permissions_exposed_method(self, transaction):
        self.dispatch({
            "operation": "update",
            "interface": "test",
            "message": "will only be called by connections with modify_options permission"
        })

        return True, dict(message="need permission")

    @virtool.gen.exposed_method([], unprotected=True)
    def test_unprotected_method(self, transaction):
        data = transaction.data
        data["value"] += "_hello_world"

        self.dispatch({
            "operation": "update",
            "interface": "test",
            "message": data
        })

        return True, data

    def test_unexposed_method(self):
        print("This method should not be called in dispatcher.handle")
