import pytest
from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.dispatcher.change import Change
from virtool.dispatcher.fetchers import (
    IndexesFetcher,
    LabelsFetcher,
    SimpleMongoFetcher,
    TasksFetcher,
    UploadsFetcher,
)
from virtool.dispatcher.operations import DELETE, INSERT, UPDATE


@pytest.fixture
def connections(ws):
    return [ws, ws, ws]


class TestSimpleMongoFetcher:
    async def test_auto_delete(self, connections, mongo, ws):
        fetcher = SimpleMongoFetcher(mongo.hmm)

        pairs = []

        async for pair in fetcher.fetch(Change("hmm", DELETE, ["foo"]), connections):
            pairs.append(pair)

        message = {"interface": "hmm", "operation": DELETE, "data": ["foo"]}

        assert pairs == [(ws, message), (ws, message), (ws, message)]

    @pytest.mark.parametrize("operation", [INSERT, UPDATE])
    @pytest.mark.parametrize("use_projection", [True, False])
    async def test_insert_and_update(
        self, operation, use_projection, connections, mongo, ws
    ):
        await mongo.hmm.insert_many(
            [
                {"_id": "foo", "name": "Foo", "include": True, "hidden": True},
                {"_id": "bar", "name": "Bar", "include": True, "hidden": True},
            ]
        )

        if use_projection:
            fetcher = SimpleMongoFetcher(mongo.hmm, projection=["name", "include"])
        else:
            fetcher = SimpleMongoFetcher(mongo.hmm)

        pairs = []

        async for pair in fetcher.fetch(Change("hmm", operation, ["foo"]), connections):
            pairs.append(pair)

        message = {
            "interface": "hmm",
            "operation": operation,
            "data": {"id": "foo", "name": "Foo", "include": True},
        }

        # If not using projection, the `hidden` field will be included in the message.
        if not use_projection:
            message["data"]["hidden"] = True

        assert pairs == [(ws, message), (ws, message), (ws, message)]

    @pytest.mark.parametrize("use_processor", [True, False])
    async def test_processor(self, use_processor, connections, mongo, ws):
        await mongo.hmm.insert_many(
            [
                {"_id": "foo", "name": "Foo", "include": True},
                {"_id": "bar", "name": "Bar", "include": True},
            ]
        )

        if use_processor:

            async def processor(db, document):
                return {**document, "processed": True}

            fetcher = SimpleMongoFetcher(mongo.hmm, processor=processor)
        else:
            fetcher = SimpleMongoFetcher(mongo.hmm)

        pairs = []

        async for pair in fetcher.fetch(Change("hmm", UPDATE, ["foo"]), connections):
            pairs.append(pair)

        message = {
            "interface": "hmm",
            "operation": UPDATE,
            "data": {
                "id": "foo",
                "name": "Foo",
                "include": True,
            },
        }

        if use_processor:
            message["data"].update(
                {"_id": message["data"].pop("id"), "processed": True}
            )

        assert pairs == [(ws, message), (ws, message), (ws, message)]


class TestIndexesFetcher:
    async def test_auto_delete(self, connections, mongo, ws):
        fetcher = IndexesFetcher(mongo)

        pairs = []

        async for pair in fetcher.fetch(
            Change("indexes", DELETE, ["foo.3"]), connections
        ):
            pairs.append(pair)

        message = {"interface": "indexes", "operation": DELETE, "data": ["foo.3"]}

        assert pairs == [(ws, message), (ws, message), (ws, message)]

    @pytest.mark.parametrize("operation", [INSERT, UPDATE])
    async def test_insert_and_update(
        self,
        operation,
        mocker,
        connections,
        mongo,
        reference,
        static_time,
        test_indexes,
        ws,
    ):
        await mongo.indexes.insert_many(test_indexes)

        async def m_indexes_processor(db, document):
            assert db == mongo

            processed = dict(document)
            processed["id"] = processed.pop("_id")
            processed["extra_field"] = True

            return processed

        mocker.patch("virtool.indexes.db.processor", m_indexes_processor)

        fetcher = IndexesFetcher(mongo)

        pairs = []

        async for pair in fetcher.fetch(
            Change("indexes", operation, ["cdffbdjk"]), connections
        ):
            pairs.append(pair)

        message = {
            "data": {
                "created_at": test_indexes[1]["created_at"],
                "extra_field": True,
                "has_files": False,
                "id": "cdffbdjk",
                "job": {"id": "3tt0w336"},
                "ready": True,
                "reference": {"id": "hxn167"},
                "user": {"id": "mrott"},
                "version": 1,
            },
            "interface": "indexes",
            "operation": operation,
        }

        assert pairs == [(ws, message), (ws, message), (ws, message)]


class TestLabelsFetcher:
    async def test_auto_delete(self, connections, mongo, pg: AsyncEngine, ws):
        fetcher = LabelsFetcher(pg, mongo)

        pairs = []

        message = {"interface": "labels", "operation": DELETE, "data": [1]}

        async for pair in fetcher.fetch(Change("labels", DELETE, [1]), connections):
            pairs.append(pair)

        assert pairs == [(ws, message), (ws, message), (ws, message)]

    @pytest.mark.parametrize("operation", [INSERT, UPDATE])
    async def test_insert_and_update(
        self,
        fake2,
        operation,
        connections,
        mongo,
        pg,
        reference,
        snapshot,
        ws,
    ):
        await fake2.labels.create()
        await fake2.labels.create()
        await fake2.labels.create()

        fetcher = LabelsFetcher(pg, mongo)

        messages = []

        async for conn, message in fetcher.fetch(
            Change("labels", operation, [1]), connections
        ):
            assert conn == ws
            messages.append(message)

        assert messages == snapshot


class TestUploadsFetcher:
    async def test_auto_delete(self, connections, mongo, pg, ws):
        fetcher = UploadsFetcher(mongo, pg)

        pairs = []

        message = {"interface": "uploads", "operation": DELETE, "data": [1]}

        async for pair in fetcher.fetch(Change("uploads", DELETE, [1]), connections):
            pairs.append(pair)

        assert pairs == [(ws, message), (ws, message), (ws, message)]

    @pytest.mark.parametrize("operation", [INSERT, UPDATE])
    async def test_insert_and_update(
        self,
        operation,
        connections,
        snapshot,
        mongo,
        pg,
        reference,
        static_time,
        test_uploads,
        ws,
    ):
        fetcher = UploadsFetcher(mongo, pg)

        messages = []

        async for conn, message in fetcher.fetch(
            Change("uploads", operation, [1]), connections
        ):
            assert conn == ws
            messages.append(message)

        assert messages == snapshot


class TestTasksFetcher:
    async def test_auto_delete(self, connections, pg, ws):
        fetcher = TasksFetcher(pg)

        pairs = []

        message = {"interface": "tasks", "operation": DELETE, "data": [1]}

        async for pair in fetcher.fetch(Change("tasks", DELETE, [1]), connections):
            pairs.append(pair)

        assert pairs == [(ws, message), (ws, message), (ws, message)]

    @pytest.mark.parametrize("operation", [INSERT, UPDATE])
    async def test_insert_and_update(
        self, operation, connections, pg, reference, static_time, test_tasks, ws
    ):
        fetcher = TasksFetcher(pg)

        pairs = []

        async for pair in fetcher.fetch(Change("tasks", operation, [1]), connections):
            pairs.append(pair)

        message = {
            "interface": "tasks",
            "operation": operation,
            "data": {
                "id": 1,
                "complete": True,
                "context": None,
                "count": 0,
                "created_at": static_time.datetime,
                "error": None,
                "file_size": None,
                "progress": 100,
                "step": "download",
                "type": "clone_reference",
            },
        }

        assert pairs == [(ws, message), (ws, message), (ws, message)]
