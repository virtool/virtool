import aionotify
import arrow
import asyncio
import inotify.adapters
import logging
import multiprocessing
import os
import pymongo
import queue
import setproctitle
import shutil

import virtool.file
import virtool.utils

#: A dict for mapping inotify type names of interest to simple file operation verbs used in Virtool.
TYPE_NAME_DICT = {
    "CREATE": "create",
    "MOVED_TO": "move",
    "DELETE": "delete",
    "MOVED_FROM": "delete",
    "CLOSE_WRITE": "close"
}

FLAGS = (
    aionotify.Flags.CLOSE_WRITE |
    aionotify.Flags.CREATE |
    aionotify.Flags.DELETE |
    aionotify.Flags.MOVED_TO |
    aionotify.Flags.MOVED_FROM
)

#: Files with these extensions will be consumed from the watch folder and be entered into Virtool's file manager.
FILE_EXTENSION_FILTER = (
    ".fq.gz",
    ".fastq.gz",
    ".fq",
    ".fastq"
)


def get_event_type(event):
    flags = aionotify.Flags.parse(event.flags)

    if aionotify.Flags.CREATE in flags or aionotify.Flags.MOVED_TO in flags:
        return "create"

    if aionotify.Flags.DELETE in flags or aionotify.Flags.MOVED_FROM in flags:
        return "delete"

    if aionotify.Flags.CLOSE_WRITE in flags:
        return "close"


class Manager:

    def __init__(self, loop, executor, db, dispatch, files_path, watch_path, clean_interval=20):
        self.loop = loop
        self.executor = executor
        self.db = db
        self.dispatch = dispatch
        self.files_path = files_path
        self.watch_path = watch_path
        self.clean_interval = clean_interval

        self.watcher = aionotify.Watcher()

        self.watcher.watch(self.files_path, FLAGS, alias="files")
        self.watcher.watch(self.watch_path, FLAGS, alias="watch")

        self._watch_task = asyncio.ensure_future(self.watch(), loop=self.loop)

        if self.clean_interval is not None:
            self._clean_task = asyncio.ensure_future(self.clean(), loop=self.loop)

    async def clean(self):
        try:
            while True:
                dir_list = os.listdir(self.files_path)
                db_list = await self.db.files.distinct("_id")

                for filename in dir_list:
                    if filename not in db_list:
                        await self.loop.run_in_executor(self.executor, os.remove, os.path.join(self.files_path, filename))

                db_created_list = await self.db.files.find({"created": True}).distinct("_id")

                await self.db.files.delete_many({
                    "_id": {
                        "$in": [filename for filename in db_created_list if filename not in dir_list]
                    }
                })

                count = 0
                threshold = self.clean_interval / 0.3

                while count < threshold:
                    await asyncio.sleep(0.3, loop=self.loop)

        except asyncio.CancelledError:
            pass

    async def watch(self):
        await self.watcher.setup(self.loop)

        try:
            while True:
                event = await self.watcher.get_event()

                alias = event.alias
                event_type = get_event_type(event)
                filename = event.name

                if alias == "watch":
                    if event_type == "close":

                        has_read_ext = any(filename.endswith(ext) for ext in FILE_EXTENSION_FILTER)

                        old_path = os.path.join(self.watch_path, filename)

                        if has_read_ext:
                            document = await virtool.file.create(self.db, self.dispatch, filename, "reads")

                            await self.loop.run_in_executor(
                                self.executor,
                                shutil.copy,
                                old_path,
                                os.path.join(self.files_path, document["id"])
                            )

                        await self.loop.run_in_executor(
                            self.executor,
                            os.remove,
                            old_path
                        )

                else:
                    path = os.path.join(self.files_path, filename)

                    if event_type == "delete":
                        document = await self.db.files.find_one({"_id": filename})

                        if document:
                            await self.db.files.delete_one({"_id": filename})

                            await self.dispatch(
                                "files",
                                "remove",
                                [document["_id"]]
                            )

                    else:
                        file_entry = dict(virtool.utils.file_stats(path), filename=filename)

                        if event_type == "create":
                            await self.db.files.update_one({"_id": filename}, {
                                "$set": {
                                    "created": True
                                }
                            })

                        elif event_type == "close":
                            document = await self.db.files.find_one_and_update({"_id": filename}, {
                                "$set": {
                                    "size": file_entry["size"],
                                    "ready": True
                                }
                            }, return_document=pymongo.ReturnDocument.AFTER, projection=virtool.file.PROJECTION)

                            await self.dispatch(
                                "files",
                                "update",
                                virtool.utils.base_processor(document)
                            )

        except asyncio.CancelledError:
            pass

        self.watcher.close()

        logging.debug("Stopped file manager")

    async def close(self):
        self._clean_task.cancel()
        self._watch_task.cancel()

        while not (self._clean_task.done() and self._watch_task.done()):
            await asyncio.sleep(0.1, loop=self.loop)

        await self._clean_task
        await self._watch_task
