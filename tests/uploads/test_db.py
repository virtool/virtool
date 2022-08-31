import pytest

import virtool.uploads.db

import asyncio

from virtool.data.utils import get_data_from_app


@pytest.mark.parametrize("to_release", [1, [1, 2, 3]])
async def test_release(spawn_client, pg, test_uploads, to_release):
    client = await spawn_client(authorize=True)
    await virtool.uploads.db.release(pg, to_release)

    if isinstance(to_release, int):
        upload = await get_data_from_app(client.app).uploads.get(to_release)
        assert not upload.reserved
    else:
        upload_1, upload_2, upload_3 = await asyncio.gather(
            *[get_data_from_app(client.app).uploads.get(id_) for id_ in to_release]
        )
        assert (upload_1.reserved, upload_2.reserved, upload_3.reserved) == (
            False,
            False,
            False,
        )
