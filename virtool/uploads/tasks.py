from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import virtool.tasks.pg
import virtool.tasks.task
from virtool.types import App
from virtool.uploads.models import Upload


class MigrateFilesTask(virtool.tasks.task.Task):
    task_type = "migrate_files"

    def __init__(self, app: App, task_id: int):
        super().__init__(app, task_id)

        self.steps = [self.transform_documents_to_rows]

    async def transform_documents_to_rows(self):
        """
        Transforms documents in the `files` collection into rows in the `uploads` SQL table.

        """
        async for document in self.db.files.find():
            async with AsyncSession(self.app["pg"]) as session:
                exists = (
                    await session.execute(
                        select(Upload).filter_by(name_on_disk=document["_id"])
                    )
                ).scalar()

                if not exists:
                    upload = Upload(
                        name=document["name"],
                        name_on_disk=document["_id"],
                        ready=document["ready"],
                        removed=False,
                        reserved=document["reserved"],
                        size=document["size"],
                        type=document["type"],
                        user=document["user"]["id"],
                        uploaded_at=document["uploaded_at"],
                    )

                    session.add(upload)
                    await session.commit()

                    await self.db.files.delete_one({"_id": document["_id"]})

        await virtool.tasks.pg.update(
            self.pg, self.id, step="transform_documents_to_rows"
        )
