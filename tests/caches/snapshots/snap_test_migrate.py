# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['test_add_missing_field[uvloop] 1'] = [
    {
        '_id': 'foo',
        'key': '1',
        'missing': False,
        'sample': {
            'id': 'abc'
        }
    },
    {
        '_id': 'bar',
        'key': '2',
        'missing': True,
        'sample': {
            'id': 'dfg'
        }
    },
    {
        '_id': 'baz',
        'key': '3',
        'missing': False,
        'sample': {
            'id': 'zxc'
        }
    }
]

snapshots['test_rename_hash_field[uvloop] 1'] = [
    {
        '_id': 'foo',
        'key': 'a97439e170adc4365c5b92bd2c148ed57d75e566',
        'sample': {
            'id': 'abc'
        }
    },
    {
        '_id': 'bar',
        'key': 'd7fh3ee170adc4365c5b92bd2c1f3fd5745te566',
        'sample': {
            'id': 'dfg'
        }
    }
]
