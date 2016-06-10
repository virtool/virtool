import sys
import os
import shutil
import subprocess

try:
    target = sys.argv[1]
except IndexError:
    target = "../virtool-build"

try:
    shutil.rmtree(target)
except OSError:
    pass

pyinstaller_cmd = [
    "pyinstaller",
    "-F",
    "--distpath", target,
    "run.py"
]

subprocess.call(pyinstaller_cmd)

shutil.rmtree("./build")
os.remove("run.spec")

shutil.copy("install.sh", os.path.join(target, "install.sh"))

for path in ["assets", "scripts"]:
    shutil.copytree(path, os.path.join(target, path))

shutil.copytree("client/dist", os.path.join(target, "client"))

subprocess.call(["make", "-C", "doc", "html"])

shutil.copytree("doc/_build/html", os.path.join(target, "doc"))