from virtool.tasks.pg import update
from virtool.tasks.task import Task
from virtool.types import App
from virtool.users.db import PROJECTION
import virtool.users.db


class UpdateUserDocumentsTask(Task):
    """
    Update user documents that don't contain a "handle" field.

    For AD users with ad_given_name and ad_family_name included in their user document, generate handle.

    For all other users use existing _id values as handle.
    """
    task_type = "update_user_documents"

    def __init__(self, app: App, task_id: int):
        super().__init__(app, task_id)

        self.steps = [
            self.update_user_documents
        ]

    async def update_user_documents(self):
        tracker = await self.get_tracker()

        await update(
            self.pg,
            self.id,
            step="update_user_documents"
        )

        async for document in self.db.users.find({"handle": {"$exists": False}}):
            user_id = document["_id"]
            if "ad_given_name" in document and "ad_family_name" in document:
                handle = await virtool.users.db.generate_handle(
                    self.db,
                    document["ad_given_name"],
                    document["ad_family_name"]
                )
            else:
                handle = user_id

            await self.db.users.find_one_and_update({"_id": user_id}, {
                    "$set": {
                        "handle": handle
                    }
                },
                projection=PROJECTION
            )

            await update(
                self.pg,
                self.id,
                progress=tracker.step_completed,
                step="update_user_documents"
            )
