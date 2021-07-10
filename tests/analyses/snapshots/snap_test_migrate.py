# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import GenericRepr, Snapshot


snapshots = Snapshot()

snapshots['test_nest_pathoscope_results[uvloop] 1'] = [
    {
        '_id': 'foo',
        'results': {
            'hits': [
                1,
                2,
                3,
                4,
                5
            ],
            'read_count': 1209,
            'subtracted_count': 231
        },
        'workflow': 'pathoscope_bowtie'
    },
    {
        '_id': 'fine',
        'results': {
            'hits': [
                1,
                2,
                3,
                4,
                5
            ],
            'read_count': 1209,
            'subtracted_count': 231
        },
        'workflow': 'pathoscope_bowtie'
    },
    {
        '_id': 'bar',
        'results': {
            'hits': [
                9,
                8,
                7,
                6,
                5
            ],
            'read_count': 7982,
            'subtracted_count': 112
        },
        'workflow': 'pathoscope_bowtie'
    },
    {
        '_id': 'baz',
        'results': {
            'hits': [
                9,
                8,
                7,
                6,
                5
            ]
        },
        'workflow': 'nuvs'
    },
    {
        '_id': 'bad',
        'results': {
            'hits': [
                9,
                8,
                7,
                6,
                5
            ],
            'join_histogram': [
                1,
                2,
                3,
                4,
                5
            ],
            'joined_pair_count': 12345,
            'remainder_pair_count': 54321
        },
        'workflow': 'aodp'
    }
]
