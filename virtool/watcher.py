import os
import time
import logging

from virtool.utils import file_stats
from setproctitle import setproctitle
from multiprocessing import Process
from inotify.adapters import Inotify

logger = logging.getLogger(__name__)

TYPE_NAME_DICT = {
    "IN_CREATE": "create",
    "IN_MODIFY": "modify",
    "IN_DELETE": "delete",
    "IN_MOVED_FROM": "delete",
    "IN_CLOSE_WRITE": "close"
}


projector = [
    "_id",
    "_version",
    "name",
    "size_end",
    "size_now",
    "timestamp",
    "file_type",
    "created",
    "reserved",
    "ready"
]


class Watcher(Process):

    def __init__(self, path, queue, interval=0.300):
        super().__init__()

        self.path = path
        self.queue = queue
        self.interval = interval
        self.notifier = Inotify()

    def run(self):

        setproctitle("virtool-inotify")

        self.notifier.add_watch(bytes(self.path, encoding="utf-8"))

        last_modification = time.time()

        try:
            for event in self.notifier.event_gen():
                if event is not None:
                    _, type_names, _, filename = event

                    if filename and type_names[0] in TYPE_NAME_DICT:
                        assert len(type_names) == 1

                        action = TYPE_NAME_DICT[type_names[0]]

                        filename = filename.decode()

                        now = time.time()

                        if action in ["create", "modify", "close"]:
                            file_entry = file_stats(os.path.join(self.path, filename))
                            file_entry["filename"] = filename

                            if action == "modify" and (now - last_modification) > self.interval:
                                self.queue.put({
                                    "action": action,
                                    "file": file_entry
                                })

                                last_modification = now

                            if action in ["create", "close"]:
                                self.queue.put({
                                    "action": action,
                                    "file": file_entry
                                })

                        if action == "delete":
                            self.queue.put({
                                "action": "delete",
                                "file": filename
                            })

        except KeyboardInterrupt:
            logging.debug("Stopped file watcher")