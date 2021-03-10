# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['test_add_missing_field[uvloop] 1'] = [
    {
        '_id': 'foo',
        'missing': False
    },
    {
        '_id': 'bar',
        'missing': True
    },
    {
        '_id': 'baz',
        'missing': False
    }
]

snapshots['test_rename_hash_field[uvloop] 1'] = [
    {
        '_id': 'foo',
        'key': 'a97439e170adc4365c5b92bd2c148ed57d75e566'
    },
    {
        '_id': 'bar',
        'key': 'd7fh3ee170adc4365c5b92bd2c1f3fd5745te566'
    }
]
