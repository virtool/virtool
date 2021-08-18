import pytest


class RespIs:

    @staticmethod
    async def no_content(resp):
        assert resp.status == 204

    @staticmethod
    async def bad_gateway(resp, message="Bad gateway"):
        """
        Check whether a response object is a valid Virtool ``bad gateway``.
        """
        assert resp.status == 502
        assert await resp.json() == {
            "id": "bad_gateway",
            "message": message
        }

    @staticmethod
    async def bad_request(resp, message="Bad request"):
        """
        Check whether a response object is a valid Virtool ``bad_request``.
        """
        assert resp.status == 400
        assert await resp.json() == {
            "id": "bad_request",
            "message": message
        }

    @staticmethod
    async def insufficient_rights(resp, message="Insufficient rights"):
        """
        Check whether a response object is a valid Virtool ``insufficient_rights``.

        """
        assert resp.status == 403
        assert await resp.json() == {
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
        assert resp.status == 404
        assert await resp.json() == {
            "id": "not_found",
            "message": message
        }

    @staticmethod
    async def conflict(resp, message="Conflict"):
        """
        Check whether a response object is a valid Virtool ``not_found``.

        """
        assert resp.status == 409
        assert await resp.json() == {
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
