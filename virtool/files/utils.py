import os


def join_file_path(settings, file_id):
    return os.path.join(settings["data_path"], "files", file_id)
