import gzip
import json

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.data.errors import ResourceNotFoundError
from virtool.errors import GitHubError
from virtool.fake.next import DataFaker
from virtool.hmm.data import HMM_ANNOTATIONS_KEY, HMM_PROFILES_KEY, HmmsData
from virtool.hmm.sql import SQLHMM, SQLHMMStatus
from virtool.storage.object import ObjectProvider
from virtool.tasks.progress import AbstractProgressHandler


async def test_get_status(
    config, data_layer, fake: DataFaker, mongo, snapshot, static_time
):
    """Test that function works when the HMM data are being updated and when they are not."""
    user = await fake.users.create()

    await mongo.status.insert_one(
        {
            "_id": "hmm",
            "updating": False,
            "updates": [
                {
                    "body": "- remove some annotations that didn't have corresponding profiles",
                    "created_at": static_time.datetime,
                    "filename": "vthmm.tar.gz",
                    "html_url": "https://github.com/virtool/virtool-hmm/releases/tag/v0.2.1",
                    "id": 1230982,
                    "name": "v0.2.1",
                    "newer": False,
                    "published_at": static_time.datetime,
                    "ready": True,
                    "size": 85904451,
                    "user": {"id": user.id},
                },
            ],
            "installed": {
                "body": "- remove some annotations that didn't have corresponding profiles",
                "created_at": static_time.datetime,
                "filename": "vthmm.tar.gz",
                "html_url": "https://github.com/virtool/virtool-hmm/releases/tag/v0.2.1",
                "id": 8472569,
                "name": "v0.2.1",
                "newer": True,
                "published_at": "2017-11-10T19:12:43Z",
                "ready": True,
                "size": 85904451,
                "user": {"id": user.id},
            },
            "release": {
                "body": "- remove some annotations that didn't have corresponding profiles",
                "content_type": "application/gzip",
                "download_url": "https://github.com/virtool/virtool-hmm/releases/download/v0.2.1/vthmm.tar.gz",
                "etag": 'W/"7bd9cdef79c82ab4d7e5cfff394cf81eaddc6f681b8202f2a7bdc65cbcc4aaea"',
                "filename": "vthmm.tar.gz",
                "html_url": "https://github.com/virtool/virtool-hmm/releases/tag/v0.2.1",
                "id": 1230982,
                "name": "v0.2.1",
                "newer": False,
                "published_at": static_time.datetime,
                "retrieved_at": static_time.datetime,
                "size": 85904451,
            },
            "errors": [],
        },
    )

    assert await data_layer.hmms.get_status() == snapshot


class TestGetStatusUpdatingFlag:
    """``updating`` is derived from the latest entry in ``updates``.

    It is ``True`` exactly when ``updates`` is non-empty and the latest entry
    has ``ready: False`` — matching the install lock in ``install_update`` that
    refuses to start when any ``updates.ready`` is ``False``. The pre-fix
    derivation ignored the first install and inverted the ``ready`` check
    (VIR-2445).
    """

    @staticmethod
    async def _insert_status(mongo, updates: list[dict]) -> None:
        await mongo.status.insert_one(
            {
                "_id": "hmm",
                "updates": updates,
                "installed": None,
                "release": None,
                "errors": [],
            },
        )

    async def test_single_in_progress_update(self, data_layer, mongo):
        """A lone unfinished update reports ``updating: True``."""
        await self._insert_status(mongo, [{"id": 1, "ready": False}])

        status = await data_layer.hmms.get_status()

        assert status.updating is True

    async def test_latest_in_progress_update(self, data_layer, mongo):
        """A finished update followed by an unfinished one reports ``True``."""
        await self._insert_status(
            mongo,
            [{"id": 1, "ready": True}, {"id": 2, "ready": False}],
        )

        status = await data_layer.hmms.get_status()

        assert status.updating is True

    async def test_latest_completed_update(self, data_layer, mongo):
        """A latest finished update reports ``updating: False``."""
        await self._insert_status(mongo, [{"id": 1, "ready": True}])

        status = await data_layer.hmms.get_status()

        assert status.updating is False

    async def test_no_updates(self, data_layer, mongo):
        """An empty ``updates`` list reports ``updating: False``."""
        await self._insert_status(mongo, [])

        status = await data_layer.hmms.get_status()

        assert status.updating is False


async def _drain(stream) -> bytes:
    return b"".join([chunk async for chunk in stream])


class TestDownloadProfiles:
    """``download_profiles`` must find the object by exact key.

    These run against a real ``obstore``-backed provider, whose ``list``
    evaluates prefixes on path-segment boundaries. Listing the full key
    ``hmm/profiles.hmm`` as a prefix returns nothing even when the object
    exists, so the method must probe the exact key instead — the regression
    behind VIR-2418.
    """

    async def test_returns_stored_object(self):
        storage = ObjectProvider.for_memory()

        async def _data():
            yield b"PROFILE-BYTES"

        await storage.write(HMM_PROFILES_KEY, _data())

        hmms = HmmsData(None, None, None, storage)

        stream, size = await hmms.download_profiles()

        assert size == len(b"PROFILE-BYTES")
        assert await _drain(stream) == b"PROFILE-BYTES"

    async def test_missing_raises_not_found(self):
        hmms = HmmsData(None, None, None, ObjectProvider.for_memory())

        with pytest.raises(ResourceNotFoundError):
            await hmms.download_profiles()


class TestDownloadAnnotations:
    async def test_returns_stored_object_without_regenerating(self):
        """A present annotations object is served, not regenerated from Mongo."""
        storage = ObjectProvider.for_memory()

        async def _data():
            yield b"STORED-ANNOTATIONS"

        await storage.write(HMM_ANNOTATIONS_KEY, _data())

        hmms = HmmsData(None, None, None, storage)

        stream, size = await hmms.download_annotations()

        assert size == len(b"STORED-ANNOTATIONS")
        assert await _drain(stream) == b"STORED-ANNOTATIONS"

    async def test_regenerates_and_stores_when_missing(self, mongo):
        """When no object exists, annotations are regenerated from Mongo and stored."""
        storage = ObjectProvider.for_memory()

        await mongo.hmm.insert_many(
            [
                {"_id": "annotation_alpha", "cluster": 1, "hidden": False},
                {"_id": "annotation_beta", "cluster": 2, "hidden": False},
            ],
            session=None,
        )

        hmms = HmmsData(None, mongo, None, storage)

        stream, size = await hmms.download_annotations()

        assert size > 0

        regenerated = await _drain(stream)
        assert size == len(regenerated)

        clusters = {a["cluster"] for a in json.loads(gzip.decompress(regenerated))}
        assert clusters == {1, 2}

        stored = await _drain(storage.read(HMM_ANNOTATIONS_KEY))
        assert stored == regenerated


class _NullProgressHandler(AbstractProgressHandler):
    async def set_error(self, error: str) -> None: ...

    async def set_progress(self, progress: int) -> None: ...


async def _profile_bytes():
    yield b"PROFILE-BYTES"


ANNOTATION = {
    "cluster": 2,
    "count": 216,
    "length": 356,
    "mean_entropy": 0.52,
    "total_entropy": 185.12,
    "names": ["AL1 protein", "replication protein", "AC1"],
    "families": {"Geminiviridae": 235, "None": 2},
    "genera": {"Begomovirus": 198, "None": 37},
    "entries": [
        {
            "accession": "NP_040324.1",
            "gi": 9626083,
            "organism": "Pepper huasteco yellow vein virus",
            "name": "AL1 protein",
        },
    ],
}

RELEASE = {
    "id": 1,
    "name": "v0.2.1",
    "body": "release notes",
    "filename": "vthmm.tar.gz",
    "html_url": "https://github.com/virtool/virtool-hmm/releases/tag/v0.2.1",
    "newer": True,
    "published_at": "2017-11-10T19:12:43Z",
    "size": 85904451,
}


async def _read_pg_status(pg) -> dict | None:
    async with AsyncSession(pg) as session:
        status = (
            await session.execute(select(SQLHMMStatus).where(SQLHMMStatus.id == 1))
        ).scalar_one_or_none()

        if status is None:
            return None

        return {
            "errors": status.errors,
            "release": status.release,
            "installed": status.installed,
            "task_id": status.task_id,
            "updates": status.updates,
        }


async def _read_pg_hmms(pg) -> list[SQLHMM]:
    async with AsyncSession(pg) as session:
        return list((await session.execute(select(SQLHMM))).scalars().all())


async def _seed_status(mongo, pg, **overrides) -> None:
    document = {
        "_id": "hmm",
        "errors": [],
        "installed": None,
        "release": RELEASE,
        "updates": [],
        **overrides,
    }

    await mongo.status.insert_one(document)

    async with AsyncSession(pg) as session:
        session.add(
            SQLHMMStatus(
                id=1,
                errors=document["errors"],
                installed=document["installed"],
                release=document["release"],
                updates=document["updates"],
            ),
        )
        await session.commit()


class TestInstall:
    """``install`` dual-writes annotations and status to Mongo and Postgres."""

    async def test_writes_annotations_and_status_to_both(self, data_layer, mongo, pg):
        """A successful install mirrors annotations and status to Postgres."""
        await _seed_status(
            mongo,
            pg,
            updates=[{"id": 1, "ready": False, "name": "v0.2.1"}],
        )

        await data_layer.hmms.install(
            [ANNOTATION],
            RELEASE,
            7,
            _NullProgressHandler(),
            _profile_bytes(),
        )

        mongo_documents = await mongo.hmm.find().to_list(None)
        pg_hmms = await _read_pg_hmms(pg)

        assert [hmm.legacy_id for hmm in pg_hmms] == [
            document["_id"] for document in mongo_documents
        ]
        assert pg_hmms[0].cluster == ANNOTATION["cluster"]
        assert pg_hmms[0].count == ANNOTATION["count"]
        assert pg_hmms[0].names == ANNOTATION["names"]
        assert pg_hmms[0].families == ANNOTATION["families"]
        assert pg_hmms[0].genera == ANNOTATION["genera"]
        assert pg_hmms[0].entries == ANNOTATION["entries"]
        assert pg_hmms[0].hidden is False

        pg_status = await _read_pg_status(pg)
        mongo_status = await mongo.status.find_one("hmm")

        # Postgres stores ``installed`` as JSONB, so its datetimes are ISO
        # strings rather than the ``datetime`` objects Mongo returns. Compare
        # the scalar fields rather than the whole subdocument.
        assert pg_status["installed"] is not None
        assert pg_status["installed"]["id"] == mongo_status["installed"]["id"]
        assert pg_status["installed"]["ready"] is True
        assert pg_status["installed"]["user"] == {"id": 7}
        assert pg_status["updates"][0]["ready"] is True
        assert mongo_status["updates"][0]["ready"] is True

        assert await _drain(data_layer.hmms._storage.read(HMM_PROFILES_KEY)) == (
            b"PROFILE-BYTES"
        )

    async def test_profile_write_failure_rolls_back_both(
        self, data_layer, mocker, mongo, pg
    ):
        """A storage failure rolls back the Mongo and Postgres writes together."""
        await _seed_status(
            mongo,
            pg,
            updates=[{"id": 1, "ready": False, "name": "v0.2.1"}],
        )

        mocker.patch.object(
            data_layer.hmms._storage,
            "write",
            side_effect=RuntimeError("storage is down"),
        )

        with pytest.raises(RuntimeError):
            await data_layer.hmms.install(
                [ANNOTATION],
                RELEASE,
                7,
                _NullProgressHandler(),
                _profile_bytes(),
            )

        assert await mongo.hmm.count_documents({}) == 0
        assert await _read_pg_hmms(pg) == []

        pg_status = await _read_pg_status(pg)
        mongo_status = await mongo.status.find_one("hmm")

        assert pg_status["installed"] is None
        assert mongo_status["installed"] is None
        assert pg_status["updates"][0]["ready"] is False
        assert mongo_status["updates"][0]["ready"] is False


class TestCleanStatus:
    """``clean_status`` dual-writes the status reset to Mongo and Postgres."""

    async def test_resets_both(self, data_layer, mongo, pg):
        await _seed_status(
            mongo,
            pg,
            installed={"id": 1, "ready": True},
            updates=[{"id": 1, "ready": True}],
        )

        await data_layer.hmms.clean_status()

        pg_status = await _read_pg_status(pg)
        mongo_status = await mongo.status.find_one("hmm")

        assert pg_status["installed"] is None
        assert pg_status["task_id"] is None
        assert pg_status["updates"] == []

        assert mongo_status["installed"] is None
        assert mongo_status["task"] is None
        assert mongo_status["updates"] == []


class TestUpdateRelease:
    """``update_release`` dual-writes the fetched release to Mongo and Postgres."""

    async def test_creates_postgres_singleton_when_absent(
        self, data_layer, mocker, mongo
    ):
        """A successful fetch upserts the Postgres singleton from nothing."""
        mocker.patch(
            "virtool.hmm.db.get_release",
            mocker.AsyncMock(return_value=None),
        )

        await mongo.status.insert_one(
            {
                "_id": "hmm",
                "errors": ["stale error"],
                "installed": None,
                "release": RELEASE,
                "updates": [],
            },
        )

        await data_layer.hmms.update_release()

        pg_status = await _read_pg_status(data_layer.hmms._pg)
        mongo_status = await mongo.status.find_one("hmm")

        assert pg_status is not None
        assert pg_status["errors"] == []
        assert pg_status["release"]["id"] == RELEASE["id"]
        assert mongo_status["errors"] == []

    async def test_error_path_updates_existing_singleton(
        self, data_layer, mocker, mongo, pg
    ):
        """A non-fatal GitHub error clears errors without touching the release."""
        mocker.patch(
            "virtool.hmm.db.get_release",
            mocker.AsyncMock(side_effect=GitHubError("boom")),
        )

        await _seed_status(mongo, pg, errors=["stale error"])

        await data_layer.hmms.update_release()

        pg_status = await _read_pg_status(pg)
        mongo_status = await mongo.status.find_one("hmm")

        assert pg_status["errors"] == []
        assert pg_status["release"]["id"] == RELEASE["id"]
        assert mongo_status["errors"] == []


class TestInstallUpdate:
    """``install_update`` dual-writes the queued update to Mongo and Postgres."""

    async def test_pushes_update_to_both(self, data_layer, fake, mocker, mongo, pg):
        mocker.patch(
            "virtool.hmm.db.get_release",
            mocker.AsyncMock(return_value=None),
        )

        user = await fake.users.create()

        await _seed_status(mongo, pg)

        await data_layer.hmms.install_update(user.id)

        pg_status = await _read_pg_status(pg)
        mongo_status = await mongo.status.find_one("hmm")

        assert len(pg_status["updates"]) == 1
        assert pg_status["updates"][0]["ready"] is False
        assert pg_status["task_id"] == mongo_status["task"]["id"]

        assert len(mongo_status["updates"]) == 1
        assert mongo_status["updates"][0]["ready"] is False
