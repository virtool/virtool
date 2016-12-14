import tornado.websocket


class MockConnection:

    def __init__(self, settings, user, authorized):
        self.settings = settings

        self.user = {
            "_id": None
        }

        self.bound_user = user

        self.authorized = False

        if authorized:
            self.authorize()

        self.ip = "8.8.8.8"

        self._closed = False

        self.messages = list()

    def authorize(self):
        self.authorized = True
        self.user = self.bound_user

    def open(self):
        self.settings["add_connection"](self)

    def close(self):
        if self._closed is True:
            raise tornado.websocket.WebSocketClosedError
        else:
            self._closed = True
            self.on_close()

    def on_message(self, message):
        self.settings["handle"](message, self)

    def on_close(self):
        self.settings["remove_connection"](self)

    def write_message(self, message):
        self.messages.append(message)



