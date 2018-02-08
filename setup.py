from cx_Freeze import setup, Executable

packages = [
    "_cffi_backend",
    "appdirs",
    "asyncio",
    "asyncio.base_events",
    "asyncio.compat",
    "bcrypt",
    "encodings",
    "idna",
    "motor",
    "packaging",
    "packaging.version",
    "raven",
    "raven.processors",
    "uvloop"
]

# Dependencies are automatically detected, but it might need
# fine tuning.
buildOptions = dict(packages=packages, excludes=[])

base = 'Console'

executables = [
    Executable('run.py', base=base)
]

setup(name='virtool',
      version='3.0.0',
      description='',
      options=dict(build_exe=buildOptions),
      executables=executables)
