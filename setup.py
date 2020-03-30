from cx_Freeze import setup, Executable

build_exe_options = {
    "bin_includes": [
        "libssl.so",
        "libz.so"
    ],
    "bin_path_includes": [
         "/usr/lib/x86_64-linux-gnu"
    ],
    "include_files": [
        ("client/dist", "client"),
        "LICENSE",
        "templates",
        "readme.md",
        "/usr/lib/x86_64-linux-gnu/libssl.so",
        "/usr/lib/x86_64-linux-gnu/libz.so"
    ],
    "includes": [
        "asyncio.base_events"
    ],
    "packages": [
        "asyncio",
        "idna",
        "gzip",
        "motor",
        "numpy",
        "uvloop",
        "ssl"
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

setup(name="virtool", executables=executables, options=options, classifiers=classifiers)
