import os
import shutil
import binascii
import datetime
import pymongo
import motor

import virtool.gen


@virtool.gen.synchronous
def rm(path, recursive=False):
    """
    A function that removes files or directories in a separate thread. Wraps :func:`os.remove` and func:`shutil.rmtree`.

    :param path: the path to remove.
    :type path: str

    :param recursive: the operation should recursively descend into dirs.
    :type recursive: bool

    :return: a Tornado future.
    :rtype: :class:`tornado.concurrent.Future`

    """
    try:
        os.remove(path)
        return True
    except IsADirectoryError:
        if recursive:
            shutil.rmtree(path)
            return True

        raise


@virtool.gen.synchronous
def write_file(path, body, is_bytes=False):
    """
    Writes the data in ``body`` to a file at ``path``. Write in bytes mode if ``is_bytes`` is ``True``.

    :param path: path to write the file to.
    :type path: string

    :param body: the content to write to the file.
    :type body: string

    :param is_bytes: whether the write in bytes mode.
    :type is_bytes: bool

    """
    mode = "w"

    if is_bytes:
        mode += "b"

    with open(path, mode) as handle:
        handle.write(body)


@virtool.gen.synchronous
def list_files(directory, excluded=None):
    """
    Get a list of dicts describing the files in the passed directory. Each dict contains the information:

    * _id: the file name
    * size: the size in bytes of the file
    * access: the timestamp for when the file was last accessed
    * modify:  the timestamp for when the file was last modified

    :param directory: the directory to look in.
    :type directory: str

    :param excluded: names of files to exclude from the list.
    :type excluded: list

    :returns: a list of dicts describing the files in the directory.
    :rtype: list

    """
    file_list = os.listdir(directory)

    # This list will contain a dictionary of the detail for each file that was not excluded
    available = dict()

    for name in file_list:
        if excluded is None or name not in excluded:
            # Get detailed information for file by name
            file_stats = os.stat(directory + "/" + name)

            # Append file entry to reply list
            available[name] = {
                "_id": name,
                "size": file_stats.st_size,
                "access": timestamp(file_stats.st_atime),
                "modify": timestamp(file_stats.st_mtime)
            }

    return available


def timestamp(time=None, time_getter=datetime.datetime.now):
    """
    Returns and ISO format timestamp. Generates one for the current time if no ``time`` argument is passed.

    :param time: the datetime to generate a timestamp for.
    :type time: :class:`datetime.datetime` or str

    :param time_getter: a function that return a :class:"datetime.datetime" object.
    :type time_getter: func

    :return: a timestamp
    :rtype: str

    """
    if time is None:
        time = time_getter()

    if isinstance(time, datetime.datetime):
        return time.isoformat()

    # Probably a POSIX timestamp.
    if isinstance(time, float):
        return datetime.datetime.fromtimestamp(time).isoformat()

    raise TypeError("Couldn't calculate timestamp from time or time_getter")


def random_alphanumeric(length=6, excluded=[], randomizer=None):
    """
    Generates a random string composed of letters and numbers.

    :param length: the length of the string.
    :type length: int

    :param excluded: strings that may not be returned.
    :type excluded: list

    :param randomizer: a custom function for return the random string.
    :type randomizer: func

    :return: a random alphanumeric string.
    :rtype: string

    """
    if randomizer is None:
        def randomizer():
            return binascii.hexlify(os.urandom(length * 3)).decode()[0:length]

    candidate = randomizer()

    if candidate not in excluded:
        return candidate

    return random_alphanumeric(length, excluded, randomizer)


def where(subject, predicate):
    """
    Returns the first object in ``subject`` that return True for the given ``predicate``.

    :param subject: a list of objects.
    :type subject: list

    :param predicate: a function or dict to test items in the ``subject`` list.
    :type predicate: func or dict

    :return: the matched object or None.
    :rtype: any

    """
    if isinstance(predicate, dict):
        clone = dict(predicate)

        def predicate(entry):
            return all([(key in entry and entry[key] == value) for key, value in clone.items()])

    if callable(predicate):
        filtered = list(filter(predicate, subject))

        if len(filtered) > 0:
            return filtered[0]

        return None

    raise TypeError("Predicate must be callable or dict")


def average_list(list1, list2):
    if not isinstance(list1, list) or not isinstance(list2, list):
        raise TypeError("Both arguments must be lists")

    try:
        assert len(list1) == len(list2)
    except AssertionError:
        raise TypeError("Both arguments must be lists of the same length")

    return [(value + list2[i]) / 2 for i, value in enumerate(list1)]


def create_db_client(host, port, name, sync=False):
    if sync:
        return pymongo.MongoClient(host, port, serverSelectionTimeoutMS=2000, appname="Virtool")[name]

    return motor.MotorClient(host, port, connectTimeoutMS=2000, appname="Virtool")[name]