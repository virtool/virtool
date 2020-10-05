# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['test_migrate_status[uvloop-True-True-True] 1'] = [
    {
        '_id': 'hmm',
        'installed': None,
        'release': None,
        'task': None,
        'updates': [
        ]
    },
    {
        '_id': 'software',
        'mongo_version': '3.6.3',
        'task': None,
        'updating': False,
        'version': 'v3.0.0'
    }
]

snapshots['test_migrate_status[uvloop-True-True-False] 1'] = [
    {
        '_id': 'hmm',
        'installed': None,
        'release': None,
        'task': None,
        'updates': [
        ]
    },
    {
        '_id': 'software',
        'installed': None,
        'mongo_version': '3.6.3',
        'process': None,
        'releases': [
        ],
        'updating': False,
        'version': 'v3.0.0'
    }
]

snapshots['test_migrate_status[uvloop-True-False-True] 1'] = [
    {
        '_id': 'hmm',
        'installed': None,
        'release': None,
        'task': None,
        'updates': [
        ]
    },
    {
        '_id': 'software',
        'mongo_version': '3.6.3',
        'task': None,
        'updating': False,
        'version': 'v3.0.0'
    }
]

snapshots['test_migrate_status[uvloop-True-False-False] 1'] = [
    {
        '_id': 'hmm',
        'installed': None,
        'release': None,
        'task': None,
        'updates': [
        ]
    },
    {
        '_id': 'software',
        'installed': None,
        'mongo_version': '3.6.3',
        'process': None,
        'releases': [
        ],
        'updating': False,
        'version': 'v3.0.0'
    }
]

snapshots['test_migrate_status[uvloop-False-True-True] 1'] = [
    {
        '_id': 'hmm',
        'installed': None,
        'release': None,
        'task': None,
        'updates': [
        ]
    },
    {
        '_id': 'software',
        'mongo_version': '3.6.3',
        'task': None,
        'updating': False,
        'version': 'v3.0.0'
    }
]

snapshots['test_migrate_status[uvloop-False-True-False] 1'] = [
    {
        '_id': 'hmm',
        'installed': None,
        'release': None,
        'task': None,
        'updates': [
        ]
    },
    {
        '_id': 'software',
        'installed': None,
        'mongo_version': '3.6.3',
        'process': None,
        'releases': [
        ],
        'updating': False,
        'version': 'v3.0.0'
    }
]

snapshots['test_migrate_status[uvloop-False-False-True] 1'] = [
    {
        '_id': 'hmm',
        'installed': None,
        'release': None,
        'task': None,
        'updates': [
        ]
    },
    {
        '_id': 'software',
        'mongo_version': '3.6.3',
        'task': None,
        'updating': False,
        'version': 'v3.0.0'
    }
]

snapshots['test_migrate_status[uvloop-False-False-False] 1'] = [
    {
        '_id': 'hmm',
        'installed': None,
        'release': None,
        'task': None,
        'updates': [
        ]
    },
    {
        '_id': 'software',
        'installed': None,
        'mongo_version': '3.6.3',
        'process': None,
        'releases': [
        ],
        'updating': False,
        'version': 'v3.0.0'
    }
]
