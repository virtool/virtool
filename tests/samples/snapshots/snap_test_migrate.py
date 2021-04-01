# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['test_add_is_legacy[uvloop] 1'] = [
    {
        '_id': 'foo',
        'files': [
            {
                'id': 1,
                'raw': False
            }
        ],
        'is_legacy': True
    },
    {
        '_id': 'bar',
        'files': [
            {
                'id': 1,
                'raw': True
            }
        ],
        'is_legacy': False
    }
]
