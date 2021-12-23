from virtool.tasks.pg import update
from virtool.tasks.task import Task
from virtool.types import App
from virtool.users.db import PROJECTION
import virtool.users.db


class UpdateUserDocumentsTask(Task):
    """
    Update user documents that don't contain a "handle" field.

    For B2C users with b2c_given_name and b2c_family_name included in their user document, generate handle.

    For all other users use existing _id values as handle.

    """

    task_type = "update_user_documents"

    def __init__(self, app: App, task_id: int):
        super().__init__(app, task_id)

        self.steps = [self.update_user_documents]

    async def update_user_documents(self):
        async for document in self.db.users.find({"handle": {"$exists": False}}):
            user_id = document["_id"]

            if "b2c_given_name" in document and "b2c_family_name" in document:
                handle = await virtool.users.db.generate_handle(
                    self.db, document["b2c_given_name"], document["b2c_family_name"]
                )
            else:
                handle = user_id

            await self.db.users.find_one_and_update(
                {"_id": user_id}, {"$set": {"handle": handle}}, projection=PROJECTION
            )
