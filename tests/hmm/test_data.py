import gzip
import json

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.data.errors import ResourceNotFoundError
from virtool.fake.next import DataFaker
from virtool.hmm.data import HMM_ANNOTATIONS_KEY, HMM_PROFILES_KEY, HmmsData
from virtool.hmm.releases import GetReleaseError
from virtool.hmm.sql import SQLHMM, SQLHMMStatus
from virtool.storage.object import ObjectProvider
from virtool.tasks.progress import AbstractProgressHandler


async def test_get_status(
    config,
    data_layer,
    fake: DataFaker,
    seed_hmm_status,
    snapshot,
    static_time,
):
    """Test that function works when the HMM data are being updated and when they are not."""
    user = await fake.users.create()

    document = {
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
    }

    await seed_hmm_status(document)

    assert await data_layer.hmms.get_status() == snapshot


class TestGetStatusUpdatingFlag:
    """``updating`` is derived from the latest entry in ``updates``.

    It is ``True`` exactly when ``updates`` is non-empty and the latest entry
    has ``ready: False`` — matching the install lock in ``install_update`` that
    refuses to start when any ``updates.ready`` is ``False``. The pre-fix
    derivation ignored the first install and inverted the ``ready`` check
    (VIR-2445).
    """

    async def test_single_in_progress_update(self, data_layer, seed_hmm_status):
        """A lone unfinished update reports ``updating: True``."""
        await seed_hmm_status({"updates": [{"id": 1, "ready": False}]})

        status = await data_layer.hmms.get_status()

        assert status.updating is True

    async def test_latest_in_progress_update(self, data_layer, seed_hmm_status):
        """A finished update followed by an unfinished one reports ``True``."""
        await seed_hmm_status(
            {"updates": [{"id": 1, "ready": True}, {"id": 2, "ready": False}]},
        )

        status = await data_layer.hmms.get_status()

        assert status.updating is True

    async def test_latest_completed_update(self, data_layer, seed_hmm_status):
        """A latest finished update reports ``updating: False``."""
        await seed_hmm_status({"updates": [{"id": 1, "ready": True}]})

        status = await data_layer.hmms.get_status()

        assert status.updating is False

    async def test_no_updates(self, data_layer, seed_hmm_status):
        """An empty ``updates`` list reports ``updating: False``."""
        await seed_hmm_status({"updates": []})

        status = await data_layer.hmms.get_status()

        assert status.updating is False


class TestGetUpdates:
    """``get_updates`` reads ``updates`` from Postgres, newest-first."""

    async def test_returns_updates_newest_first(self, data_layer, seed_hmm_status):
        """Stored updates are returned in reverse insertion order."""
        await seed_hmm_status(
            {
                "updates": [
                    {"id": 1, "name": "v0.1.0", "ready": True},
                    {"id": 2, "name": "v0.2.0", "ready": True},
                ],
            },
        )

        updates = await data_layer.hmms.get_updates()

        assert [update_["id"] for update_ in updates] == [2, 1]

    async def test_returns_empty_when_no_updates(self, data_layer, seed_hmm_status):
        """A singleton with no updates yields an empty list."""
        await seed_hmm_status({"updates": []})

        assert await data_layer.hmms.get_updates() == []


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

        hmms = HmmsData(None, None, storage)

        stream, size = await hmms.download_profiles()

        assert size == len(b"PROFILE-BYTES")
        assert await _drain(stream) == b"PROFILE-BYTES"

    async def test_missing_raises_not_found(self):
        hmms = HmmsData(None, None, ObjectProvider.for_memory())

        with pytest.raises(ResourceNotFoundError):
            await hmms.download_profiles()


class TestDownloadAnnotations:
    async def test_returns_stored_object_without_regenerating(self):
        """A present annotations object is served, not regenerated from Mongo."""
        storage = ObjectProvider.for_memory()

        async def _data():
            yield b"STORED-ANNOTATIONS"

        await storage.write(HMM_ANNOTATIONS_KEY, _data())

        hmms = HmmsData(None, None, storage)

        stream, size = await hmms.download_annotations()

        assert size == len(b"STORED-ANNOTATIONS")
        assert await _drain(stream) == b"STORED-ANNOTATIONS"

    async def test_regenerates_and_stores_when_missing(self, pg, seed_pg_hmm):
        """When no object exists, annotations are regenerated from Postgres and stored."""
        storage = ObjectProvider.for_memory()

        await seed_pg_hmm({**ANNOTATION, "_id": "annotation_alpha", "cluster": 1})
        await seed_pg_hmm({**ANNOTATION, "_id": "annotation_beta", "cluster": 2})

        hmms = HmmsData(None, pg, storage)

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


async def _seed_status(pg, **overrides) -> None:
    document = {
        "errors": [],
        "installed": None,
        "release": RELEASE,
        "updates": [],
        **overrides,
    }

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


class TestGet:
    """``get`` reads a single annotation from Postgres by its integer primary key."""

    async def test_reads_from_postgres(self, data_layer, seed_pg_hmm, hmm_document):
        await seed_pg_hmm(hmm_document)

        hmm = await data_layer.hmms.get(1)

        assert hmm.id == 1
        assert hmm.cluster == hmm_document["cluster"]
        assert hmm.entries == hmm_document["entries"]

    async def test_missing_raises_not_found(self, data_layer, seed_pg_hmm):
        with pytest.raises(ResourceNotFoundError):
            await data_layer.hmms.get(999999)


class TestFind:
    """``find`` lists annotations from Postgres, excluding hidden ones."""

    async def test_reads_from_postgres(
        self, data_layer, seed_hmm_status, seed_pg_hmm, hmm_document
    ):
        await seed_hmm_status({})
        await seed_pg_hmm({**hmm_document, "hidden": False})

        result = await data_layer.hmms.find(1, 25)

        assert result.found_count == 1
        assert result.total_count == 1
        assert [document.id for document in result.documents] == [1]

    async def test_excludes_hidden(
        self, data_layer, seed_hmm_status, seed_pg_hmm, hmm_document
    ):
        await seed_hmm_status({})
        await seed_pg_hmm({**hmm_document, "_id": "visible", "hidden": False})
        await seed_pg_hmm({**hmm_document, "_id": "concealed", "hidden": True})

        result = await data_layer.hmms.find(1, 25)

        assert result.total_count == 1
        assert [document.id for document in result.documents] == [1]

    async def test_search_filters_by_name(
        self, data_layer, seed_hmm_status, seed_pg_hmm, hmm_document
    ):
        await seed_hmm_status({})
        await seed_pg_hmm(
            {**hmm_document, "_id": "polymerase", "names": ["RNA polymerase"]},
        )
        await seed_pg_hmm(
            {**hmm_document, "_id": "capsid", "names": ["capsid protein"]},
        )

        result = await data_layer.hmms.find(1, 25, "polymerase")

        assert result.found_count == 1
        assert result.total_count == 2
        assert [document.id for document in result.documents] == [1]


class TestInstall:
    """``install`` writes annotations and status to Postgres."""

    async def test_writes_annotations_and_status(self, data_layer, pg):
        """A successful install stores annotations and flips the status."""
        await _seed_status(
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

        pg_hmms = await _read_pg_hmms(pg)

        assert len(pg_hmms) == 1
        assert pg_hmms[0].legacy_id is None
        assert pg_hmms[0].cluster == ANNOTATION["cluster"]
        assert pg_hmms[0].count == ANNOTATION["count"]
        assert pg_hmms[0].names == ANNOTATION["names"]
        assert pg_hmms[0].families == ANNOTATION["families"]
        assert pg_hmms[0].genera == ANNOTATION["genera"]
        assert pg_hmms[0].entries == ANNOTATION["entries"]
        assert pg_hmms[0].hidden is False

        pg_status = await _read_pg_status(pg)

        assert pg_status["installed"] is not None
        assert pg_status["installed"]["id"] == RELEASE["id"]
        assert pg_status["installed"]["ready"] is True
        assert pg_status["installed"]["user"] == {"id": 7}
        assert pg_status["updates"][0]["ready"] is True

        assert await _drain(data_layer.hmms._storage.read(HMM_PROFILES_KEY)) == (
            b"PROFILE-BYTES"
        )

    async def test_profile_write_failure_rolls_back(self, data_layer, mocker, pg):
        """A storage failure rolls back the Postgres writes."""
        await _seed_status(
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

        assert await _read_pg_hmms(pg) == []

        pg_status = await _read_pg_status(pg)

        assert pg_status["installed"] is None
        assert pg_status["updates"][0]["ready"] is False


class TestCleanStatus:
    """``clean_status`` resets the Postgres status singleton."""

    async def test_resets(self, data_layer, pg):
        await _seed_status(
            pg,
            installed={"id": 1, "ready": True},
            updates=[{"id": 1, "ready": True}],
        )

        await data_layer.hmms.clean_status()

        pg_status = await _read_pg_status(pg)

        assert pg_status["installed"] is None
        assert pg_status["task_id"] is None
        assert pg_status["updates"] == []


class TestUpdateRelease:
    """``update_release`` writes the fetched release to Postgres."""

    async def test_creates_postgres_singleton_when_absent(self, data_layer, mocker, pg):
        """A successful fetch upserts the Postgres singleton from nothing."""
        mocker.patch(
            "virtool.hmm.db.fetch_release_manifest_from_virtool",
            mocker.AsyncMock(
                return_value={
                    "virtool-hmm": [
                        {
                            "id": 1,
                            "name": "v1.0.0",
                            "body": "release notes",
                            "filename": "vthmm.tar.gz",
                            "size": 100,
                            "html_url": "https://github.com/virtool/virtool-hmm/releases/tag/v1.0.0",
                            "download_url": "https://example.com/vthmm.tar.gz",
                            "published_at": "2017-11-10T19:12:43Z",
                            "content_type": "application/gzip",
                        },
                    ],
                },
            ),
        )

        await data_layer.hmms.update_release()

        pg_status = await _read_pg_status(pg)

        assert pg_status is not None
        assert pg_status["errors"] == []
        assert pg_status["release"]["id"] == 1
        assert pg_status["installed"] is None

    async def test_error_path_updates_existing_singleton(self, data_layer, mocker, pg):
        """A non-fatal fetch error clears errors without touching the release."""
        mocker.patch(
            "virtool.hmm.db.fetch_release_manifest_from_virtool",
            mocker.AsyncMock(side_effect=GetReleaseError("boom")),
        )

        await _seed_status(pg, errors=["stale error"])

        await data_layer.hmms.update_release()

        pg_status = await _read_pg_status(pg)

        assert pg_status["errors"] == []
        assert pg_status["release"]["id"] == RELEASE["id"]

    @pytest.mark.parametrize(
        "manifest",
        [None, {}, {"virtool-hmm": []}],
        ids=["none", "missing_key", "empty_list"],
    )
    async def test_empty_manifest_preserves_stored_release(
        self, data_layer, manifest, mocker, pg
    ):
        """A manifest with no HMM release keeps the stored release and clears errors."""
        mocker.patch(
            "virtool.hmm.db.fetch_release_manifest_from_virtool",
            mocker.AsyncMock(return_value=manifest),
        )

        await _seed_status(pg, errors=["stale error"])

        await data_layer.hmms.update_release()

        pg_status = await _read_pg_status(pg)

        assert pg_status["errors"] == []
        assert pg_status["release"]["id"] == RELEASE["id"]

    async def test_fatal_error_propagates(self, data_layer, mocker, pg):
        """A fatal fetch error is raised rather than silently swallowed."""
        mocker.patch(
            "virtool.hmm.db.fetch_release_manifest_from_virtool",
            mocker.AsyncMock(side_effect=GetReleaseError("404 not found")),
        )

        await _seed_status(pg)

        with pytest.raises(GetReleaseError):
            await data_layer.hmms.update_release()


class TestInstallUpdate:
    """``install_update`` writes the queued update to Postgres."""

    async def test_pushes_update(self, data_layer, fake, mocker, pg):
        mocker.patch(
            "virtool.hmm.db.fetch_release_manifest_from_virtool",
            mocker.AsyncMock(return_value=None),
        )

        user = await fake.users.create()

        await _seed_status(pg)

        await data_layer.hmms.install_update(user.id)

        pg_status = await _read_pg_status(pg)

        assert len(pg_status["updates"]) == 1
        assert pg_status["updates"][0]["ready"] is False
        assert pg_status["task_id"] is not None
