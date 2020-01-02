# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['test_add_targets_field[uvloop] 1'] = [
    {
        '_id': 'foo',
        'data_type': 'genome'
    },
    {
        '_id': 'bar',
        'data_type': 'barcode',
        'targets': [
        ]
    }
]
