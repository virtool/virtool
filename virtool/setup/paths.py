import os
import sys

SUB_DIRS = [
    "files",
    "references",
    "subtractions",
    "samples",
    "hmm",
    "logs/jobs"
]


def check_empty(path: str) -> bool:
    """
    Make sure the path is empty if it already exists.

    :param path:
    :return: `True` if empty, otherwise `False`

    """
    return not len(os.listdir(path))


def check_path(path: str) -> dict:
    """
    Check that the data or watch `path` is valid. Return an error result for updating setup state.

    :param path: the path to check
    :return: an error update for the setup state

    """
    path = ensure_path_absolute(path)

    try:
        os.mkdir(path)
        os.rmdir(path)
    except FileNotFoundError:
        return error_result("not_found_error")
    except PermissionError:
        return error_result("permission_error")
    except FileExistsError:
        if check_empty(path):
            return error_result("not_empty_error")


def create_data_tree(path: str):
    """
    Create the folder structure for storing application data at `path`.

    :param path: the path to create the data folder structure in

    """
    try:
        os.mkdir(path)
    except FileExistsError:
        pass

    for subdir in SUB_DIRS:
        os.makedirs(os.path.join(path, subdir))


def create_watch(path: str):
    """
    Create the watch folder if it doesn't already exist.

    :param path: the watch path

    """
    try:
        os.mkdir(path)
    except FileExistsError:
        pass


def ensure_path_absolute(path: str) -> str:
    """
    If the path is not absolute, return one assuming the `path` is relative to the application install directory.

    :param path: a path
    :return: absolute path
    """
    if not path.startswith("/"):
        return os.path.join(sys.path[0], path)

    return path


def error_result(error: str) -> dict:
    """
    A utility function for creating a `dict` used for updating setup state related to configuring `data_path`.

    :param error: a string identifying the error
    :return: an error update for the setup state

    """
    return {
        "path": "",
        "error": error,
        "ready": False
    }



