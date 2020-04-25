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
