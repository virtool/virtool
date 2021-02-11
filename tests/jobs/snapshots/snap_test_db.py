# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import GenericRepr, Snapshot


snapshots = Snapshot()

snapshots['test_create[uvloop-False] 1'] = {
    '_id': '9pfsom1b',
    'acquired': False,
    'args': {
        'sample_id': 'foo'
    },
    'key': 'hashed',
    'rights': {
        'samples': {
            'modify': [
                'foo'
            ],
            'read': [
                'foo'
            ],
            'remove': [
                'foo'
            ]
        }
    },
    'state': 'waiting',
    'status': [
        {
            'error': None,
            'progress': 0,
            'stage': None,
            'state': 'waiting',
            'timestamp': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
        }
    ],
    'task': 'create_sample',
    'user': {
        'id': 'bob'
    }
}

snapshots['test_create[uvloop-True] 1'] = {
    '_id': 'bar',
    'acquired': False,
    'args': {
        'sample_id': 'foo'
    },
    'key': 'hashed',
    'rights': {
        'samples': {
            'modify': [
                'foo'
            ],
            'read': [
                'foo'
            ],
            'remove': [
                'foo'
            ]
        }
    },
    'state': 'waiting',
    'status': [
        {
            'error': None,
            'progress': 0,
            'stage': None,
            'state': 'waiting',
            'timestamp': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
        }
    ],
    'task': 'create_sample',
    'user': {
        'id': 'bob'
    }
}
