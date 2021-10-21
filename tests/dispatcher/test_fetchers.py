import pytest

from virtool.dispatcher.change import Change
from virtool.dispatcher.fetchers import IndexesFetcher, SimpleMongoFetcher, LabelsFetcher, UploadsFetcher, TasksFetcher
from virtool.dispatcher.operations import DELETE, INSERT, UPDATE
from virtool.uploads.models import UploadType


@pytest.fixture
def connections(ws):
    return [ws, ws, ws]


class TestSimpleMongoFetcher:

    async def test_auto_delete(self, connections, dbi, ws):
        fetcher = SimpleMongoFetcher(dbi.hmm)

        pairs = list()

        async for pair in fetcher.fetch(Change("hmm", DELETE, ["foo"]), connections):
            pairs.append(pair)

        message = {
            "interface": "hmm",
            "operation": DELETE,
            "data": ["foo"]
        }

        assert pairs == [
            (ws, message),
            (ws, message),
            (ws, message)
        ]

    @pytest.mark.parametrize("operation", [INSERT, UPDATE])
    @pytest.mark.parametrize("use_projection", [True, False])
    async def test_insert_and_update(self, operation, use_projection, connections, dbi, ws):
        await dbi.hmm.insert_many([
            {"_id": "foo", "name": "Foo", "include": True, "hidden": True},
            {"_id": "bar", "name": "Bar", "include": True, "hidden": True}
        ])

        if use_projection:
            fetcher = SimpleMongoFetcher(dbi.hmm, projection=["name", "include"])
        else:
            fetcher = SimpleMongoFetcher(dbi.hmm)

        pairs = list()

        async for pair in fetcher.fetch(Change("hmm", operation, ["foo"]), connections):
            pairs.append(pair)

        message = {
            "interface": "hmm",
            "operation": operation,
            "data": {
                "id": "foo",
                "name": "Foo",
                "include": True
            }
        }

        # If not using projection, the `hidden` field will be included in the message.
        if not use_projection:
            message["data"]["hidden"] = True

        assert pairs == [
            (ws, message),
            (ws, message),
            (ws, message)
        ]

    @pytest.mark.parametrize("use_processor", [True, False])
    async def test_processor(self, use_processor, connections, dbi, ws):
        await dbi.hmm.insert_many([
            {"_id": "foo", "name": "Foo", "include": True},
            {"_id": "bar", "name": "Bar", "include": True}
        ])

        if use_processor:
            async def processor(db, document):
                return {
                    **document,
                    "processed": True
                }

            fetcher = SimpleMongoFetcher(dbi.hmm, processor=processor)
        else:
            fetcher = SimpleMongoFetcher(dbi.hmm)

        pairs = list()

        async for pair in fetcher.fetch(Change("hmm", UPDATE, ["foo"]), connections):
            pairs.append(pair)

        message = {
            "interface": "hmm",
            "operation": UPDATE,
            "data": {
                "id": "foo",
                "name": "Foo",
                "include": True,
            }
        }

        if use_processor:
            message["data"].update({
                "_id": message["data"].pop("id"),
                "processed": True
            })

        assert pairs == [
            (ws, message),
            (ws, message),
            (ws, message)
        ]


class TestIndexesFetcher:

    async def test_auto_delete(self, connections, dbi, ws):
        fetcher = IndexesFetcher(dbi)

        pairs = list()

        async for pair in fetcher.fetch(Change("indexes", DELETE, ["foo.3"]), connections):
            pairs.append(pair)

        message = {
            "interface": "indexes",
            "operation": DELETE,
            "data": ["foo.3"]
        }

        assert pairs == [
            (ws, message),
            (ws, message),
            (ws, message)
        ]

    @pytest.mark.parametrize("operation", [INSERT, UPDATE])
    async def test_insert_and_update(
            self,
            operation,
            mocker,
            connections,
            dbi,
            reference,
            static_time,
            test_indexes,
            ws
    ):
        await dbi.indexes.insert_many(test_indexes)

        async def m_indexes_processor(db, document):
            assert db == dbi

            processed = dict(document)
            processed["id"] = processed.pop("_id")
            processed["extra_field"] = True

            return processed

        mocker.patch("virtool.indexes.db.processor", m_indexes_processor)

        fetcher = IndexesFetcher(dbi)

        pairs = list()

        async for pair in fetcher.fetch(Change("indexes", operation, ["cdffbdjk"]), connections):
            pairs.append(pair)

        message = {
            "data": {
                "created_at": test_indexes[1]["created_at"],
                "extra_field": True,
                "has_files": False,
                "id": "cdffbdjk",
                "job": {
                    "id": "3tt0w336"
                },
                "ready": True,
                "reference": {
                    "id": "hxn167"
                },
                "user": {
                    "id": "mrott"
                },
                "version": 1
            },
            "interface": "indexes",
            "operation": operation
        }

        assert pairs == [
            (ws, message),
            (ws, message),
            (ws, message)
        ]


class TestLabelsFetcher:

    async def test_auto_delete(self, connections, dbi, pg, ws):
        fetcher = LabelsFetcher(pg, dbi)

        pairs = list()

        message = {
            "interface": "labels",
            "operation": DELETE,
            "data": [1]
        }

        async for pair in fetcher.fetch(Change("labels", DELETE, [1]), connections):
            pairs.append(pair)

        assert pairs == [
            (ws, message),
            (ws, message),
            (ws, message)
        ]

    @pytest.mark.parametrize("operation", [INSERT, UPDATE])
    async def test_insert_and_update(
            self,
            operation,
            connections,
            dbi,
            pg,
            reference,
            static_time,
            test_labels,
            ws
    ):
        fetcher = LabelsFetcher(pg, dbi)

        pairs = list()

        async for pair in fetcher.fetch(Change("labels", operation, [1]), connections):
            pairs.append(pair)

        message = {
            "data": {
                "id": 1,
                "name": "Legacy",
                "color": None,
                "description": None
            },
            "interface": "labels",
            "operation": operation
        }

        assert pairs == [
            (ws, message),
            (ws, message),
            (ws, message)
        ]


class TestUploadsFetcher:

    async def test_auto_delete(self, connections, pg, ws):
        fetcher = UploadsFetcher(pg)

        pairs = list()

        message = {
            "interface": "uploads",
            "operation": DELETE,
            "data": [1]
        }

        async for pair in fetcher.fetch(Change("uploads", DELETE, [1]), connections):
            pairs.append(pair)

        assert pairs == [
            (ws, message),
            (ws, message),
            (ws, message)
        ]

    @pytest.mark.parametrize("operation", [INSERT, UPDATE])
    async def test_insert_and_update(
            self,
            operation,
            connections,
            pg,
            reference,
            static_time,
            test_uploads,
            ws
    ):
        fetcher = UploadsFetcher(pg)

        pairs = list()

        async for pair in fetcher.fetch(Change("uploads", operation, [1]), connections):
            pairs.append(pair)

        message = {
            "data": {
                "id": 1,
                "created_at": None,
                "name": "test.fq.gz",
                "name_on_disk": None,
                "ready": False,
                "removed": False,
                "removed_at": None,
                'reserved': False,
                "size": None,
                "type": UploadType.reads,
                "user": "danny",
                "uploaded_at": None
            },
            "interface": "uploads",
            "operation": operation
        }

        assert pairs == [
            (ws, message),
            (ws, message),
            (ws, message)
        ]


class TestTasksFetcher:

    async def test_auto_delete(self, connections, pg, ws):
        fetcher = TasksFetcher(pg)

        pairs = list()

        message = {
            "interface": "tasks",
            "operation": DELETE,
            "data": [1]
        }

        async for pair in fetcher.fetch(Change("tasks", DELETE, [1]), connections):
            pairs.append(pair)

        assert pairs == [
            (ws, message),
            (ws, message),
            (ws, message)
        ]

    @pytest.mark.parametrize("operation", [INSERT, UPDATE])
    async def test_insert_and_update(
            self,
            operation,
            connections,
            pg,
            reference,
            static_time,
            test_tasks,
            ws
    ):
        fetcher = TasksFetcher(pg)

        pairs = list()

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
                "type": "clone_reference"
            }
        }

        assert pairs == [
            (ws, message),
            (ws, message),
            (ws, message)
        ]
