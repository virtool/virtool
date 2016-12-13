import virtool.gen


class EmptyInterface:

    def __init__(self, dispatch, collections):
        self.dispatch = dispatch
        self.collection = collections


class MockInterface(EmptyInterface):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    @virtool.gen.exposed_method([])
    def test_exposed_method(self, transaction):
        print(5 + 5)
