import gzip
import json

import pytest

from virtool.data.errors import ResourceNotFoundError
from virtool.fake.next import DataFaker
from virtool.hmm.data import HMM_ANNOTATIONS_KEY, HMM_PROFILES_KEY, HmmsData
from virtool.storage.object import ObjectProvider


async def test_get_status(
    config, data_layer, fake: DataFaker, mongo, snapshot, static_time
):
    """Test that function works when the HMM data are being updated and when they are not."""
    user = await fake.users.create()

    await mongo.status.insert_one(
        {
            "_id": "hmm",
            "updating": False,
            "updates": [{"id": 231}],
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
