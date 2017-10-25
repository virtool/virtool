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
import time

import virtool.file
import virtool.utils

#: A dict for mapping inotify type names of interest to simple file operation verbs used in Virtool.
TYPE_NAME_DICT = {
    "IN_CREATE": "create",
    "IN_MODIFY": "modify",
    "IN_DELETE": "delete",
    "IN_MOVED_FROM": "delete",
    "IN_CLOSE_WRITE": "close"
}

#: Files with these extensions will be consumed from the watch folder and be entered into Virtool's file manager.
FILE_EXTENSION_FILTER = (
    ".fq.gz",
    ".fastq.gz",
    ".fq",
    ".fastq"
)


class Manager:

    def __init__(self, loop, executor, db, dispatch, files_path, watch_path, clean_interval=20):
        self.loop = loop
        self.executor = executor
        self.db = db
        self.dispatch = dispatch
        self.files_path = files_path
        self.watch_path = watch_path
        self.clean_interval = clean_interval

        self.queue = multiprocessing.Queue()
        self.watcher = Watcher(self.files_path, self.watch_path, self.queue)
        self.watcher.start()

        self._kill = False
        self._clean_alive = False
        self._run_alive = False

    async def start(self):
        if self.clean_interval is not None:
            self.loop.create_task(self.clean())

        self.loop.create_task(self.run())
        self.queue.get(block=True, timeout=3)

        self._run_alive = True

    async def clean(self):
        self._clean_alive = True

        looped_once = False

        while not (self._kill and looped_once):
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

            while not self._kill and count < threshold:
                await asyncio.sleep(0.3, loop=self.loop)

            looped_once = True

        self._clean_alive = False

    async def run(self):
        looped_once = False

        while not (self._kill and looped_once):
            while True:
                try:
                    event = self.queue.get(block=False)
                except queue.Empty:
                    break

                filename = event["file"]["filename"]

                if event["action"] == "create":
                    await self.db.files.update_one({"_id": filename}, {
                        "$set": {
                            "created": True
                        }
                    })

                elif event["action"] == "close":
                    document = await self.db.files.find_one_and_update({"_id": filename}, {
                        "$set": {
                            "size": event["file"]["size"],
                            "ready": True
                        }
                    }, return_document=pymongo.ReturnDocument.AFTER, projection=virtool.file.PROJECTION)

                    await self.dispatch(
                        "files",
                        "update",
                        virtool.file.processor(document)
                    )

                elif event["action"] == "delete":
                    document = await self.db.files.find_one({"_id": filename})

                    if document:
                        await self.db.files.delete_one({"_id": filename})

                        await self.dispatch(
                            "files",
                            "remove",
                            [document["_id"]]
                        )

                elif event["action"] == "watch":
                    document = await virtool.file.create(self.db, self.dispatch, filename, "reads")

                    old_path = os.path.join(self.watch_path, filename)

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

            async for document in self.db.files.find({"expires_at": {"$ne": None}}, ["expires_at"]):
                if arrow.get(document["expires_at"]) <= arrow.utcnow():
                    await self.db.files.delete_one({"_id": document["_id"]})
                    os.remove(os.path.join(self.files_path, document["_id"]))

            await asyncio.sleep(0.1, loop=self.loop)

            looped_once = True

        self.watcher.terminate()

        self._run_alive = False

        logging.debug("Stopped file manager")

    @property
    def alive(self):
        return self._run_alive or self._clean_alive

    async def wait_for_dead(self):
        while self._run_alive or self._clean_alive:
            await asyncio.sleep(0.1, loop=self.loop)

    async def close(self):
        self._kill = True
        await self.wait_for_dead()


class Watcher(multiprocessing.Process):

    def __init__(self, files_path, watch_path, queue):
        super().__init__()

        self.files_path = files_path
        self.watch_path = watch_path

        self.watch_files = set()

        self.queue = queue

    def run(self):
        # This title will show up in output from ``top`` and ``ps`` etc.
        setproctitle.setproctitle("virtool-inotify")

        # A ton of "IN_MODIFY" type events can be produced. We minimize the number of messages being sent to the
        # main process by only allowing one to be put in ``self.queue`` every 300 ms.
        interval = 0.300

        notifier = inotify.adapters.Inotify()

        # The ``add_watch`` method only takes paths as bytestrings.
        notifier.add_watch(bytes(self.files_path, encoding="utf-8"))
        notifier.add_watch(bytes(self.watch_path, encoding="utf-8"))

        last_modification = time.time()

        try:
            # This tells the FileManager object that the watcher is ready to start sending messages.
            self.queue.put("alive")

            for event in notifier.event_gen():
                if event is not None:
                    _, type_names, dirname, filename = event

                    # Only paying attention to a select few type names.
                    if filename and type_names[0] in TYPE_NAME_DICT:
                        if len(type_names) != 1:
                            raise ValueError("Unexpected number of type_names")

                        action = TYPE_NAME_DICT[type_names[0]]

                        filename = filename.decode()
                        dirname = dirname.decode()

                        now = time.time()

                        if dirname.endswith("files"):
                            if action in ["create", "modify", "close"]:
                                file_entry = virtool.utils.file_stats(os.path.join(self.files_path, filename))
                                file_entry["filename"] = filename

                                if action == "modify" and (now - last_modification) > interval:
                                    self.queue.put({
                                        "action": action,
                                        "file": file_entry
                                    })

                                    last_modification = now

                                else:
                                    self.queue.put({
                                        "action": action,
                                        "file": file_entry
                                    })

                            if action == "delete":
                                self.queue.put({
                                    "action": "delete",
                                    "file": {
                                        "filename": filename
                                    }
                                })

                        elif dirname.endswith("watch"):
                            has_read_ext = any(filename.endswith(ext) for ext in FILE_EXTENSION_FILTER)

                            if action == "close" and has_read_ext and filename not in self.watch_files:
                                self.watch_files.add(filename)

                                file_entry = virtool.utils.file_stats(os.path.join(self.watch_path, filename))

                                file_entry["filename"] = filename

                                self.queue.put({
                                    "action": "watch",
                                    "file": file_entry
                                })

                            elif action == "delete":
                                try:
                                    self.watch_files.remove(filename)
                                except KeyError:
                                    pass

        except KeyboardInterrupt:
            logging.debug("Stopped file watcher")
