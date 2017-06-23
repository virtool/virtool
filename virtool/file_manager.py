import os
import time
import asyncio
import logging
import setproctitle
import multiprocessing
import inotify.adapters

from virtool.utils import file_stats


TYPE_NAME_DICT = {
    "IN_CREATE": "create",
    "IN_MODIFY": "modify",
    "IN_DELETE": "delete",
    "IN_MOVED_FROM": "delete",
    "IN_CLOSE_WRITE": "close"
}


class Manager:

    def __init__(self, loop, db, dispatch, path):
        self.loop = loop
        self.db = db
        self.dispatch = dispatch

        self.queue = multiprocessing.Queue()
        self.watcher = multiprocessing.Process(target=watch, name="virtool-inotify", args=[path, self.queue])
        self.watcher.start()

        self.loop.create_task(self.run())
        self._kill = False
        self.alive = None

    async def run(self):
        self.alive = True

        try:
            while not self._kill:
                while not self.queue.empty():

                    event = self.queue.get()

                    print(event)

                    filename = event["file"]["filename"]

                    if event["action"] == "create":
                        await self.db.files.update_one({"_id": filename}, {
                            "$set": {
                                "created": True
                            }
                        })

                    elif event["action"] == "modify":
                        await self.db.files.update_one({"_id": filename}, {
                            "$set": {
                                "size_now": event["file"]["size"]
                            }
                        })

                    elif event["action"] == "close":
                        await self.db.files.update_one({"_id": filename}, {
                            "$set": {
                                "eof": True
                            }
                        })

                    elif event["action"] == "delete":
                        await self.db.files.delete_one({"_id": filename})

                await asyncio.sleep(0.1, loop=self.loop)

        except KeyboardInterrupt:
            pass

        self.watcher.terminate()
        self.alive = False

        logging.debug("Stopped file watcher")

    async def wait_for_dead(self):
        while self.alive:
            await asyncio.sleep(0.1, loop=self.loop)

    async def close(self):
        self._kill = True
        await self.wait_for_dead()


def watch(path, queue):
    setproctitle.setproctitle("virtool-inotify")

    interval = 0.300

    notifier = inotify.adapters.Inotify()

    notifier.add_watch(bytes(path, encoding="utf-8"))

    last_modification = time.time()

    try:
        for event in notifier.event_gen():
            if event is not None:
                _, type_names, _, filename = event

                if filename and type_names[0] in TYPE_NAME_DICT:
                    assert len(type_names) == 1

                    action = TYPE_NAME_DICT[type_names[0]]

                    filename = filename.decode()

                    now = time.time()

                    if action in ["create", "modify", "close"]:
                        file_entry = file_stats(os.path.join(path, filename))
                        file_entry["filename"] = filename

                        if action == "modify" and (now - last_modification) > interval:
                            queue.put({
                                "action": action,
                                "file": file_entry
                            })

                            last_modification = now

                        else:
                            queue.put({
                                "action": action,
                                "file": file_entry
                            })

                    if action == "delete":
                        queue.put({
                            "action": "delete",
                            "file": filename
                        })

    except KeyboardInterrupt:
        logging.debug("Stopped file watcher")



