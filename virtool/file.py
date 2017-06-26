import os
import time
import logging

from virtool.utils import file_stats
from setproctitle import setproctitle
from multiprocessing import Process
from inotify.adapters import Inotify

logger = logging.getLogger(__name__)


LIST_PROJECTION = [
    "_id",
    "name",
    "size",
    "user_id",
    "timestamp",
    "type",
    "ready"
]


def processor(document):
    document = dict(document)
    document["file_id"] = document.pop("_id")
    return document
