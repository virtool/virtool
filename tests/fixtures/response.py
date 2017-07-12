import pytest
import pprint


class RespIs:

    @staticmethod
    async def bad_request(resp, message="Bad Request"):
        """
        Check whether a response object is a valid Virtool ``bad_request``.

        """
        return resp.status == 400 and await resp.json() == {
            "id": "bad_request",
            "message": message
        }

    @staticmethod
    async def not_found(resp, message="Not Found"):
        """
        Check whether a response object is a valid Virtool ``not_found``.

        """
        return resp.status == 404 and await resp.json() == {
            "id": "not_found",
            "message": message
        }

    @staticmethod
    async def conflict(resp, message="Conflict"):
        """
        Check whether a response object is a valid Virtool ``not_found``.

        """
        return resp.status == 409 and await resp.json() == {
            "id": "conflict",
            "message": message
        }

    @staticmethod
    async def invalid_input(resp, errors):
        """
        Check whether a response object is a valid Virtool ``invalid_input``.

        """
        return resp.status == 422 and await resp.json() == {
            "id": "invalid_input",
            "message": "Invalid Input",
            "errors": errors
        }

    @staticmethod
    async def invalid_query(resp, errors):
        """
        Check whether a response object is a valid Virtool ``invalid_query``.

        """
        return resp.status == 422 and await resp.json() == {
            "id": "invalid_query",
            "message": "Invalid Query",
            "errors": errors
        }


@pytest.fixture(scope="session")
def resp_is():
    return RespIs()
