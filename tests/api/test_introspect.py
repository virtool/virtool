from virtool_core.models.label import Label

from virtool.api.custom_json import json_response
from virtool.api.introspect import HandlerReturnValue
from virtool.api.status import R200, R404
from virtool.api.view import APIView


class ReturnValueView(APIView):
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


class TestHandlerReturnValue:
    def test(self):
        ret = HandlerReturnValue(ReturnValueView.get)

        assert ret.responses == {
            "200": {
                "content": {
                    "application/json": {
                        "schema": {
                            "properties": {
                                "id": {
                                    "type": "string",
                                },
                            },
                            "type": "object",
                        },
                    },
                },
            },
            "404": {
                "content": {},
            },
        }

        assert ret.component_schemas == {
            "test": 1}
