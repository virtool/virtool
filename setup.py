import importlib
from cx_Freeze import setup, Executable

backend_path = importlib.import_module("bcrypt").__path__[0]

backend_path = backend_path.replace("bcrypt", ".libs_cffi_backend")

# Dependencies are automatically detected, but it might need
# fine tuning.
build_exe_options = {
    "include_files": [
        ("client/dist", "client"),
        "LICENSE",
        "templates",
        "readme.md",
        (backend_path, "lib/.libs_cffi_backend")
    ],
    "includes": [
        "cffi",
        "numpy",
        "numpy.core._methods",
        "numpy.lib",
        "numpy.lib.format",
        "raven.processors"
    ],
    "packages": [
        "_cffi_backend",
        "appdirs",
        "asyncio",
        "bcrypt",
        "cffi",
        "idna",
        "motor",
        "packaging",
        "ssl",
        "uvloop"
    ]
}

options = {
    "build_exe": build_exe_options
}

executables = [
    Executable('run.py', base="Console")
]

classifiers=[
    "Programming Language :: Python :: 3.7"
]

importlib.import_module("virtool")

setup(name='virtool', executables=executables, options=options, classifiers=classifiers, python_requires=">=3.6")


