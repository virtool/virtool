from pathlib import Path


def get_revisions_path() -> Path:
    """
    Get the hardcoded path to data revision files.

    :return: the revisions path

    """
    return Path(__file__).parent.parent.parent / "assets/revisions"
