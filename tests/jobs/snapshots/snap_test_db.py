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

snapshots['test_cancel[uvloop] 1'] = {
    '_id': 'foo',
    'state': 'waiting',
    'status': [
        {
            'error': None,
            'progress': 0.33,
            'stage': 'foo',
            'state': 'running',
            'timestamp': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
        },
        {
            'error': None,
            'progress': 0.33,
            'stage': 'foo',
            'state': 'cancelled',
            'timestamp': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
        }
    ]
}

snapshots['test_processor[uvloop] 1'] = {
    'acquired': False,
    'args': {
        'analysis_id': 'e410429b',
        'index_id': '465428b0',
        'name': None,
        'sample_id': '1e01a382',
        'username': 'igboyes',
        'workflow': 'nuvs'
    },
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'id': '4c530449',
    'key': 'bar',
    'mem': 16,
    'proc': 10,
    'progress': 1.0,
    'stage': 'import_results',
    'state': 'complete',
    'task': 'build_index',
    'user': {
        'id': 'igboyes'
    }
}
