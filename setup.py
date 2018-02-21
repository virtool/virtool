from cx_Freeze import setup, Executable

# Dependencies are automatically detected, but it might need
# fine tuning.
build_exe_options = {
    "excludes": [
        "numpy"
    ],
    "packages": [
        "_cffi_backend",
        "appdirs",
        "asyncio",
        "bcrypt",
        "encodings",
        "idna",
        "motor",
        "packaging",
        "raven",
        "uvloop"
    ]
}

options = {
    "build_exe": build_exe_options
}

executables = [
    Executable('run.py', base="Console")
]

setup(name='virtool', executables=executables, options=options)
