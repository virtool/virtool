# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['test_find[uvloop] 1'] = [
    {
        'complete': True,
        'context': {
            'user_id': 'test_1'
        },
        'count': 40,
        'created_at': '2015-10-06T20:00:00Z',
        'error': None,
        'file_size': 1024,
        'id': 1,
        'progress': 100,
        'step': 'download',
        'type': 'clone_reference'
    },
    {
        'complete': False,
        'context': {
            'user_id': 'test_2'
        },
        'count': 30,
        'created_at': '2015-10-06T20:00:00Z',
        'error': None,
        'file_size': 14754,
        'id': 2,
        'progress': 80,
        'step': 'download',
        'type': 'import_reference'
    }
]

snapshots['test_get[uvloop-None] 1'] = {
    'complete': True,
    'context': {
        'user_id': 'test_1'
    },
    'count': 40,
    'created_at': '2015-10-06T20:00:00Z',
    'error': None,
    'file_size': 1024,
    'id': 1,
    'progress': 100,
    'step': 'download',
    'type': 'clone_reference'
}
