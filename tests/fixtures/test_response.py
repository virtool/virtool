import pytest


class RespIs:

    @staticmethod
    async def no_content(resp):
        assert resp.status == 204

    @staticmethod
    async def insufficient_rights(resp, message="Insufficient rights"):
        """
        Check whether a response object is a valid Virtool ``insufficient_rights``.

        """
        return resp.status == 403 and await resp.json() == {
            "id": "insufficient_rights",
            "message": message
        }

    @staticmethod
    async def not_permitted(resp, message="Not permitted"):
        return resp.status == 403 and await resp.json() == {
            "id": "not_permitted",
            "message": message
        }

    @staticmethod
    async def not_found(resp, message="Not found"):
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
            "message": "Invalid input",
            "errors": errors
        }

    @staticmethod
    async def invalid_query(resp, errors):
        """
        Check whether a response object is a valid Virtool ``invalid_query``.

        """
        return resp.status == 422 and await resp.json() == {
            "id": "invalid_query",
            "message": "Invalid query",
            "errors": errors
        }


@pytest.fixture(scope="session")
def resp_is():
    return RespIs()
