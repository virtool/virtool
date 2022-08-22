from contextlib import asynccontextmanager
from typing import Callable, List, Optional

from motor.motor_asyncio import AsyncIOMotorClient

import virtool.analyses.db
import virtool.caches.db
import virtool.history.db
import virtool.hmm.db
import virtool.indexes.db
import virtool.jobs.db
import virtool.otus.db
import virtool.references.db
import virtool.samples.db
import virtool.settings.db
import virtool.subtractions.db
import virtool.uploads.db
import virtool.users.db
from virtool.mongo.core import Collection
from virtool.mongo.identifier import AbstractIdProvider
from virtool.types import Projection


class DB:
    def __init__(
        self,
        motor_client: AsyncIOMotorClient,
        enqueue_change: Callable[[str, str, List[str]], None],
        id_provider: AbstractIdProvider,
    ):
        self.motor_client = motor_client
        self.start_session = motor_client.start_session
        self.enqueue_change = enqueue_change
        self.id_provider = id_provider

        self.analyses = self.bind_collection(
            "analyses", projection=virtool.analyses.db.PROJECTION
        )

        self.caches = self.bind_collection(
            "caches", projection=virtool.caches.db.PROJECTION
        )

        self.files = self.bind_collection(
            "files", projection=virtool.uploads.db.PROJECTION
        )

        self.groups = self.bind_collection("groups")

        self.history = self.bind_collection(
            "history", projection=virtool.history.db.PROJECTION
        )

        self.hmm = self.bind_collection("hmm", projection=virtool.hmm.db.PROJECTION)

        self.indexes = self.bind_collection(
            "indexes", projection=virtool.indexes.db.PROJECTION
        )

        self.jobs = self.bind_collection(
            "jobs",
            projection=virtool.jobs.db.LIST_PROJECTION,
            processor=virtool.jobs.db.processor,
        )

        self.keys = self.bind_collection("keys", silent=True)

        self.labels = self.bind_collection("labels")

        self.otus = self.bind_collection("otus", projection=virtool.otus.db.PROJECTION)

        self.tasks = self.bind_collection("tasks")

        self.references = self.bind_collection(
            "references",
            processor=virtool.references.db.processor,
            projection=virtool.references.db.PROJECTION,
        )

        self.samples = self.bind_collection(
            "samples", projection=virtool.samples.db.LIST_PROJECTION
        )
        self.settings = self.bind_collection(
            "settings", projection=virtool.settings.db.PROJECTION
        )

        self.sequences = self.bind_collection("sequences")

        self.sessions = self.bind_collection("sessions", silent=True)

        self.status = self.bind_collection("status")

        self.subtraction = self.bind_collection(
            "subtraction", projection=virtool.subtractions.db.PROJECTION
        )

        self.users = self.bind_collection(
            "users", projection=virtool.users.db.PROJECTION
        )

    def bind_collection(
        self,
        name: str,
        processor: Optional[Callable] = None,
        projection: Optional[Projection] = None,
        silent: bool = False,
    ) -> Collection:
        return Collection(
            self,
            name,
            processor,
            projection,
            silent,
        )

    @asynccontextmanager
    async def create_session(self):
        async with await self.motor_client.client.start_session() as s, s.start_transaction():
            yield s
