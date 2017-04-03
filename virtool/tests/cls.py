class AuthorizedTest:

    async def test_not_authorized(self, do_get):
        resp = await do_get("/api/users")

        assert resp.status == 403

        assert await resp.json() == {
            "message": "Not authorized"
        }


class ProtectedTest(AuthorizedTest):

    async def test_not_authorized(self, do_get):
        resp = await do_get("/api/users")

        assert resp.status == 403

        assert await resp.json() == {
            "message": "Not authorized"
        }

    async def test_not_permitted(self, do_get):
        resp = await do_get("/api/users", authorize=True)

        assert resp.status == 403

        assert await resp.json() == {
            "message": "Not permitted"
        }
