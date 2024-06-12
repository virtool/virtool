from typing import Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from virtool.types import App
from virtool.uploads.models import SQLUpload


async def create_fake_fasta_upload(app: App, user_id: str) -> Tuple[int, str]:
    async with AsyncSession(app["pg"]) as session:
        upload = SQLUpload(name="test.fa.gz", type="subtraction", user=user_id)

        session.add(upload)
        await session.flush()

        upload_id = upload.id
        upload_name = upload.name

        await session.commit()

    return upload_id, upload_name
