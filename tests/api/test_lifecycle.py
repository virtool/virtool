class TestShutdown:

    async def test(self, mocker, monkeypatch, do_get):
        """
        Test that a ``GET /api/lifecycle/shutdown`` results in :meth:`aiohttp.web.Application.shutdown` being called on
        the Virtool application object. We check this be seeing if 

        """
        await do_get.init_client()

        stub = mocker.stub(name="shutdown")

        async def mock_shutdown():
            return stub()

        monkeypatch.setattr(do_get.server.app, "shutdown", mock_shutdown)

        await do_get("/api/lifecycle/shutdown", authorize=True)

        assert stub.called

    async def test_job_manager(self, mocker, monkeypatch, do_get):
        """
        Test that a ``GET /api/lifecycle/shutdown`` results in :meth:`virtool.job_manager.Manager.close` being called as
        part of the shutdown process.

        """
        await do_get.init_client()

        stub = mocker.stub(name="close")

        async def mock_close():
            return stub()

        monkeypatch.setattr(do_get.server.app["job_manager"], "close", mock_close)

        await do_get("/api/lifecycle/shutdown", authorize=True)

        assert stub.called

