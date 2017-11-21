from cx_Freeze import setup, Executable

packages = [
    "encodings",
    "uvloop",
    "motor",
    "appdirs",
    "packaging",
    "packaging.version",
    "_cffi_backend",
    "asyncio",
    "asyncio.base_events",
    "asyncio.compat",
    "raven.conf",
    "raven.handlers",
    "raven.processors"
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
