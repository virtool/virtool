import os

try:
    import aionotify
except (ImportError, OSError):
    aionotify = None


#: Files with these extensions will be consumed from the watch folder and be entered into Virtool's file manager.
FILE_EXTENSION_FILTER = (
    ".fq.gz",
    ".fastq.gz",
    ".fq",
    ".fastq"
)


def join_file_path(settings: dict, file_id: str) -> str:
    """
    Return a file path based on the Virtool `data_path` setting and a unique file id.

    :param settings: the application settings
    :param file_id: a file id
    :return: the path for the file with id `file_id`

    """
    return os.path.join(settings["data_path"], "files", file_id)


def get_event_type(event):
    """
    Get a simplified event type from :package:`aionotify` flags.

    :param event: an inotify event
    :return: a simple string event type

    """
    flags = aionotify.Flags.parse(event.flags)

    if aionotify.Flags.CREATE in flags or aionotify.Flags.MOVED_TO in flags:
        return "create"

    if aionotify.Flags.DELETE in flags or aionotify.Flags.MOVED_FROM in flags:
        return "delete"

    if aionotify.Flags.CLOSE_WRITE in flags:
        return "close"


def has_read_extension(filename):
    return any(filename.endswith(ext) for ext in FILE_EXTENSION_FILTER)
