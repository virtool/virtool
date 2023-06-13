from pathlib import Path


def get_revisions_path() -> Path:
    """
    Get the hardcoded path to Virtool revision files.

    :return: the revisions path

    """
    return Path(__file__).parent.parent.parent / "assets/revisions"


def get_template_path() -> Path:
    """
    Get the hardcoded path to migration template files.

    :return: the template path

    """
    return Path(__file__).parent.parent.parent / "virtool/migration/templates"
