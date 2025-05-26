from syrupy import SnapshotAssertion
from virtool_core.models.label import Label

from virtool.api.custom_json import json_response
from virtool.api.introspect import HandlerParameters, HandlerReturnValue
from virtool.api.model import RequestModel
from virtool.api.status import R200, R404, R422
from virtool.api.view import APIView


class ExampleRequestModel(RequestModel):
    name: str = None
    group: str | None = None


class ExampleView(APIView):
    def get(self) -> R200[Label] | R404:
        """Get a user.

        Gets a user for return value documentation purposes.
        """
        return json_response(
            Label(
                id=11,
                count=5,
                description="A longer description.",
                name="Test Label",
                color="#ff0000",
            ),
        )

    def patch(self, data: ExampleRequestModel) -> R200[Label] | R404 | R422:
        """Update a user.

        Gets a user for return value documentation purposes.
        """
        return json_response(
            Label(
                id=11,
                count=5,
                description="A longer description.",
                name="Test Label",
                color="#ff0000",
            ),
        )


class TestHandlerReturnValue:
    def test(self, snapshot: SnapshotAssertion):
        ret = HandlerReturnValue(ExampleView.get)

        assert ret.responses == snapshot(name="schema")


class TestHandleParameters:
    def test(self, snapshot: SnapshotAssertion):
        params = HandlerParameters.from_handler(ExampleView.patch)

        data = None

        for param in params:
            if param.name == "data":
                data = param
                break

        assert data.type is ExampleRequestModel
        assert ExampleRequestModel.schema()
