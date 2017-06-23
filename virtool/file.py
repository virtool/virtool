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
    "size_end",
    "size_now",
    "timestamp",
    "file_type",
    "created",
    "reserved",
    "ready"
]
