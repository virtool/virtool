import asyncio
import logging
import os
import re
import shutil
import sys

import aionotify

import virtool.files.db
import virtool.utils

#: Files with these extensions will be consumed from the watch folder and be entered into Virtool's file manager.
FILE_EXTENSION_FILTER = (
    ".fq.gz",
    ".fastq.gz",
    ".fq",
    ".fastq"
)

FILES_FLAGS = (
        aionotify.Flags.CLOSE_WRITE |
        aionotify.Flags.CREATE |
        aionotify.Flags.DELETE |
        aionotify.Flags.MOVED_TO |
        aionotify.Flags.MOVED_FROM
)

PATH_RE = re.compile("Error setting up watch on (.*) with flags ([0-9]+):")

WATCH_FLAGS = (
        aionotify.Flags.CLOSE_WRITE |
        aionotify.Flags.MOVED_TO
)

#: A dict for mapping inotify type names of interest to simple file operation verbs used in Virtool.
TYPE_NAME_DICT = {
    "CLOSE_WRITE": "close",
    "CREATE": "create",
    "DELETE": "delete",
    "MOVED_FROM": "delete",
    "MOVED_TO": "close"
}

logger = logging.getLogger(__name__)


def format_path(path):
    if path[0] == "/":
        return path

    return os.path.join(sys.path[0], path)


def get_event_type(event):
    flags = aionotify.Flags.parse(event.flags)

    if aionotify.Flags.CREATE in flags or aionotify.Flags.MOVED_TO in flags:
        return "create"

    if aionotify.Flags.DELETE in flags or aionotify.Flags.MOVED_FROM in flags:
        return "delete"

    if aionotify.Flags.CLOSE_WRITE in flags:
        return "close"


def handle_watch_error(err: Exception):
    """
    Handle exceptions raised during inotify watch setup.

    If exception is expected, a critical error  will be logged and the application will exit.

    :param err: an exception

    """
    match = PATH_RE.match(str(err))

    path = match.group(1)
    flags = match.group(2)

    if match:
        logger.critical(f"Could not set up watch on {format_path(path)} ({flags})")
        sys.exit(1)

    raise


def has_read_extension(filename):
    return any(filename.endswith(ext) for ext in FILE_EXTENSION_FILTER)


class Manager:

    def __init__(self, executor, db, files_path, watch_path, clean_interval=20):
        self.loop = asyncio.get_event_loop()
        self.executor = executor
        self.db = db
        self.files_path = files_path
        self.watch_path = watch_path
        self.clean_interval = clean_interval

        self.watcher = aionotify.Watcher()

        self.watcher.watch(self.files_path, FILES_FLAGS, alias="files")
        self.watcher.watch(self.watch_path, WATCH_FLAGS, alias="watch")

    async def run(self):
        coros = [
            self.watch()
        ]

        if self.clean_interval is not None:
            coros.append(self.clean())

        return await asyncio.gather(*coros)

    async def clean(self):
        try:
            while True:
                dir_list = os.listdir(self.files_path)
                db_list = await self.db.files.distinct("_id")

                for filename in dir_list:
                    if filename not in db_list:
                        await self.loop.run_in_executor(
                            self.executor,
                            os.remove,
                            os.path.join(self.files_path, filename)
                        )

                db_created_list = await self.db.files.find({"created": True}).distinct("_id")

                await self.db.files.delete_many({
                    "_id": {
                        "$in": [filename for filename in db_created_list if filename not in dir_list]
                    }
                })

                count = 0
                threshold = self.clean_interval / 0.3

                while count < threshold:
                    await asyncio.sleep(0.3)

        except asyncio.CancelledError:
            pass

    async def watch(self):
        logging.debug("Started file manager")

        try:
            await self.watcher.setup(self.loop)
        except OSError as err:
            handle_watch_error(err)

        try:
            while True:
                event = await self.watcher.get_event()
                filename = event.name

                if event.alias == "watch":
                    await self.handle_watch(filename)

                else:
                    event_type = get_event_type(event)

                    if event_type == "delete":
                        await self.handle_delete(filename)

                    elif event_type == "create":
                        await self.handle_create(filename)

                    elif event_type == "close":
                        await self.handle_close(filename)

        except asyncio.CancelledError:
            pass

        logging.debug("Closed file manager")

    async def handle_watch(self, filename):
        """
        Handle the writing or moving of a file to the watch path.

        :param filename: the name of the written or moved file
        :type filename: str

        """
        path = os.path.join(self.watch_path, filename)

        is_read_file = has_read_extension(filename)

        if is_read_file:
            document = await virtool.files.db.create(self.db, filename, "reads")

            await self.loop.run_in_executor(
                self.executor,
                shutil.copy,
                path,
                os.path.join(self.files_path, document["id"])
            )

            logging.debug("Retrieved file from watch path: " + filename)

        await self.loop.run_in_executor(
            self.executor,
            os.remove,
            path
        )

        if not is_read_file:
            logging.debug("Removed invalid read file from watch path: " + filename)

    async def handle_close(self, filename):
        """
        Handle the finish of a write or move to the files directory. Remove the file immediately if it doesn't have a
        corresponding database entry.

        :param filename: the name of the file in the files path
        :type filename: str

        """
        path = os.path.join(self.files_path, filename)

        size = virtool.utils.file_stats(path)["size"]

        update_result = await self.db.files.update_one({"_id": filename}, {
            "$set": {
                "size": size,
                "ready": True
            }
        })

        if not update_result.matched_count:
            await self.loop.run_in_executor(
                self.executor,
                os.remove,
                path
            )

            logging.debug("Removed untracked file from files path: " + filename)

        else:
            logging.debug("Marked file as ready: " + filename)

    async def handle_create(self, filename):
        """
        If a file is created in the files path, set the `created` flag on its corresponding database entry.

        :param filename: the name of the file in the files path
        :type filename: str

        """
        await self.db.files.update_one({"_id": filename}, {
            "$set": {
                "created": True
            }
        })

        logging.debug("File was created in files path: " + filename)

    async def handle_delete(self, filename):
        """
        If a file is deleted from the files path, remove its corresponding database entry.

        :param filename: the name of the file in the files path
        :type filename: str

        """
        await self.db.files.delete_one({"_id": filename})
