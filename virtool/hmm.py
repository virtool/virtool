import os


def file_exists(data_path):
    return os.path.isfile(os.path.join(data_path, "hmm", "profiles.hmm"))
