# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['test_write_sequences_to_file 1'] = '''>foo
ATTGAGAGATAGAGACAC
>bar
GGGTACGAGTTTCTATCG
>baz
GGCTTCGGACTTTTTTCG
'''

snapshots['test_get_sequences_from_patched_otus[uvloop-genome] 1'] = [
    {
        '_id': '1',
        'sequence': 'AGAGGATAGAGACACA'
    },
    {
        '_id': '2',
        'sequence': 'GGGTAGTCGATCTGGC'
    },
    {
        '_id': '5',
        'sequence': 'TTTGAGCCACACCCCC'
    },
    {
        '_id': '6',
        'sequence': 'GCCCACCCATTAGAAC'
    }
]

snapshots['test_get_sequences_from_patched_otus[uvloop-genome] 2'] = {
    '1': 'foo',
    '2': 'foo',
    '3': 'foo',
    '4': 'foo',
    '5': 'bar',
    '6': 'bar'
}

snapshots['test_get_sequences_from_patched_otus[uvloop-barcode] 1'] = [
    {
        '_id': '1',
        'sequence': 'AGAGGATAGAGACACA'
    },
    {
        '_id': '2',
        'sequence': 'GGGTAGTCGATCTGGC'
    },
    {
        '_id': '3',
        'default': True,
        'sequence': 'TTTAGAGTTGGATTAC'
    },
    {
        '_id': '4',
        'default': True,
        'sequence': 'AAAGGAGAGAGAAACC'
    },
    {
        '_id': '5',
        'sequence': 'TTTGAGCCACACCCCC'
    },
    {
        '_id': '6',
        'sequence': 'GCCCACCCATTAGAAC'
    }
]

snapshots['test_get_sequences_from_patched_otus[uvloop-barcode] 2'] = {
    '1': 'foo',
    '2': 'foo',
    '3': 'foo',
    '4': 'foo',
    '5': 'bar',
    '6': 'bar'
}
