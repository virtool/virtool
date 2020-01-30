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

snapshots['test_update_ready[uvloop] 1'] = [
    {
        '_id': 'foo',
        'imported': True,
        'ready': True
    },
    {
        '_id': 'baz',
        'imported': True,
        'ready': True
    },
    {
        '_id': 'far',
        'ready': True
    }
]

snapshots['test_prune_fields[uvloop] 1'] = [
    {
        '_id': 'foo'
    },
    {
        '_id': 'bar',
        'ready': True
    }
]

snapshots['test_update_pairedness[uvloop] 1'] = [
    {
        '_id': 'foo',
        'files': [
            '1'
        ],
        'paired': False
    },
    {
        '_id': 'bar',
        'files': [
            '1',
            '2'
        ],
        'paired': True
    },
    {
        '_id': 'baz',
        'paired': True
    },
    {
        '_id': 'boo',
        'paired': False
    }
]
