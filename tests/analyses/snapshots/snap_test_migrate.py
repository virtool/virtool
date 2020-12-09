# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import GenericRepr, Snapshot


snapshots = Snapshot()

snapshots['test_add_updated_at[uvloop] 1'] = [
    {
        '_id': 'foo',
        'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
        'updated_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
    },
    {
        '_id': 'bar',
        'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
        'updated_at': GenericRepr('datetime.datetime(2015, 10, 7, 5, 0)')
    },
    {
        '_id': 'baz',
        'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
        'updated_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
    },
    {
        '_id': 'bad',
        'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
        'updated_at': GenericRepr('datetime.datetime(2015, 10, 6, 22, 32)')
    }
]

snapshots['test_change_to_subtractions_list[uvloop] 1'] = [
    {
        '_id': 'foo',
        'subtractions': [
            'prunus'
        ]
    },
    {
        '_id': 'bar',
        'subtractions': [
            'malus'
        ]
    },
    {
        '_id': 'baz',
        'subtractions': [
            'malus'
        ]
    }
]
