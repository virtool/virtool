from setuptools import setup

classifiers=[
    "Programming Language :: Python :: 3.7",
    "Programming Language :: Python :: 3.8",
]

setup(
    name="virtool",
    classifiers=classifiers,
    install_requires=[
        "aiofiles",
        "aiohttp",
        "aiojobs",
        "aionotify",
        "aioredis",
        "arrow",
        "bcrypt",
        "biopython",
        "Cerberus",
        "cchardet",
        "click",
        "coloredlogs",
        "coverage",
        "dictdiffer",
        "Mako",
        "motor",
        "psutil",
        "semver",
        "sentry-sdk",
        "uvloop",
        "visvalingamwyatt"
    ],
    py_modules=["virtool"],
    entry_points='''
        [console_scripts]
        virtool=virtool.config:entry
    '''
)
