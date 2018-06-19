import logging
import os
import shutil
import sys

logger = logging.getLogger(__name__)

INSTALL_PATH = sys.path[0]

SOFTWARE_REPO = "virtool/virtool"

RELEASE_KEYS = [
    "name",
    "body",
    "prerelease",
    "published_at",
    "html_url"
]


def check_software_files(path):
    if not {"client", "run", "VERSION"}.issubset(set(os.listdir(path))):
        return False

    client_content = os.listdir(os.path.join(path, "client"))

    if "favicon.ico" not in client_content or "index.html" not in client_content:
        return False

    if not any(["app." in filename and ".js" in filename for filename in client_content]):
        return False

    return True


def copy_software_files(src, dest):
    for dir_name in ["templates", "lib", "client", "assets"]:
        shutil.rmtree(os.path.join(dest, dir_name), ignore_errors=True)

    for name in os.listdir(src):
        src_path = os.path.join(src, name)
        dest_path = os.path.join(dest, name)

        if os.path.isfile(dest_path):
            os.remove(dest_path)

        if os.path.isfile(src_path):
            shutil.copy(src_path, dest_path)

        if os.path.isdir(dest_path):
            shutil.rmtree(dest_path)

        if os.path.isdir(src_path):
            shutil.copytree(src_path, dest_path)
