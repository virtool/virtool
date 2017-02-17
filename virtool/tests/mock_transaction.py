class MockTransaction:

    def __init__(self, message, connection):

        self.message = message

        self.method = self.message.get("method")

        self.interface = self.message.get("interface")

        self.data = self.message.get("data")

        self.connection = connection

        #: An attribute that can be reassigned to send data to the client when the transaction is fulfilled without
        #: passing data directly to :meth:`.fulfill`.
        self.response = None

        # Tuples containing args for dispatch and fulfill calls.
        self.update_called = False
        self.fulfill_called = False

    def fulfill(self, success=True, data=None):
        data = data or self.response

        if not success:
            data_to_send = {
                "warning": True,
                "message": "Error"
            }

            if data:
                data_to_send.update(data)

            data = data_to_send

        self.fulfill_called = (success, data)

    def update(self, data):
        """
        Sends an update that is tied to the transaction to the requesting client. Useful for giving progress updates.

        :param data: data to send to the client
        :type data: any

        """
        self.update_called = (True, data)


class MiniConnection:

    def __init__(self, user):
        self.user = user or {
            "name": "test"
        }
