from cx_Freeze import setup, Executable

# Dependencies are automatically detected, but it might need
# fine tuning.
build_exe_options = {
    "bin_includes": [
        "libcrypto.so.1.0.0",
        "libssl.so.1.0.0"
    ],
    "includes": [
        "numpy",
        "numpy.core._methods",
        "numpy.lib",
        "numpy.lib.format"
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
