# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['test_add_index_files[uvloop-DNE] 1'] = [
    {
        'id': 1,
        'index': 'foo',
        'name': 'reference.1.bt2',
        'size': 4096,
        'type': 'bowtie2'
    },
    {
        'id': 2,
        'index': 'foo',
        'name': 'reference.fa.gz',
        'size': 4096,
        'type': 'fasta'
    }
]

snapshots['test_add_index_files[uvloop-empty] 1'] = [
    {
        'id': 1,
        'index': 'foo',
        'name': 'reference.1.bt2',
        'size': 4096,
        'type': 'bowtie2'
    },
    {
        'id': 2,
        'index': 'foo',
        'name': 'reference.fa.gz',
        'size': 4096,
        'type': 'fasta'
    }
]

snapshots['test_add_index_files[uvloop-full] 1'] = [
]

snapshots['test_add_index_files[uvloop-not_ready] 1'] = [
]
