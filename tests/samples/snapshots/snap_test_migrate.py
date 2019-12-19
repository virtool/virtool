# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['test_add_library_type[uvloop] 1'] = [
    {
        '_id': 'foo',
        'library_type': 'srna'
    },
    {
        '_id': 'bar',
        'library_type': 'normal'
    },
    {
        '_id': 'baz',
        'library_type': 'normal'
    },
    {
        '_id': 'boo',
        'library_type': 'srna'
    }
]

snapshots['test_delete_unready[uvloop] 1'] = [
    {
        '_id': 'foo',
        'imported': True
    },
    {
        '_id': 'baz',
        'imported': True
    }
]
