import os
import shutil
import datetime

from random import choice
from string import ascii_letters, ascii_lowercase, digits


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

    if excluded:
        return {name: file_stats(os.path.join(directory, name)) for name in file_list if name not in excluded}

    return {name: file_stats(os.path.join(directory, name)) for name in file_list}


def file_stats(path):
    stats = os.stat(path)

    # Append file entry to reply list
    return {
        "size": stats.st_size,
        "modify": timestamp(stats.st_mtime)
    }


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


def time_now():
    return datetime.datetime.utcnow()


def random_alphanumeric(length=6, mixed_case=False, excluded=[]):
    """
    Generates a random string composed of letters and numbers.

    :param length: the length of the string.
    :type length: int

    :param excluded: strings that may not be returned.
    :type excluded: list

    :return: a random alphanumeric string.
    :rtype: string

    """
    characters = digits + ascii_letters if mixed_case else ascii_lowercase

    candidate = "".join([choice(characters) for i in range(length)])

    if candidate not in excluded:
        return candidate

    return random_alphanumeric(length, excluded)


def average_list(list1, list2):
    if not isinstance(list1, list) or not isinstance(list2, list):
        raise TypeError("Both arguments must be lists")

    try:
        assert len(list1) == len(list2)
    except AssertionError:
        raise TypeError("Both arguments must be lists of the same length")

    return [(value + list2[i]) / 2 for i, value in enumerate(list1)]
