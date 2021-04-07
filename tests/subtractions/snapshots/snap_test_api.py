# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['test_edit[uvloop-data0] json'] = {
    'files': [
    ],
    'id': 'foo',
    'linked_samples': 12,
    'name': 'Bar',
    'nickname': 'Foo Subtraction'
}

snapshots['test_edit[uvloop-data0] db'] = {
    '_id': 'foo',
    'name': 'Bar',
    'nickname': 'Foo Subtraction'
}

snapshots['test_edit[uvloop-data1] json'] = {
    'files': [
    ],
    'id': 'foo',
    'linked_samples': 12,
    'name': 'Foo',
    'nickname': 'Bar Subtraction'
}

snapshots['test_edit[uvloop-data1] db'] = {
    '_id': 'foo',
    'name': 'Foo',
    'nickname': 'Bar Subtraction'
}

snapshots['test_edit[uvloop-data2] json'] = {
    'files': [
    ],
    'id': 'foo',
    'linked_samples': 12,
    'name': 'Foo',
    'nickname': ''
}

snapshots['test_edit[uvloop-data2] db'] = {
    '_id': 'foo',
    'name': 'Foo',
    'nickname': ''
}

snapshots['test_edit[uvloop-data3] json'] = {
    'files': [
    ],
    'id': 'foo',
    'linked_samples': 12,
    'name': 'Bar',
    'nickname': 'Bar Subtraction'
}

snapshots['test_edit[uvloop-data3] db'] = {
    '_id': 'foo',
    'name': 'Bar',
    'nickname': 'Bar Subtraction'
}

snapshots['test_upload[uvloop-None] 1'] = {
    'id': 1,
    'name': 'subtraction.1.bt2',
    'size': 12,
    'subtraction': 'foo',
    'type': 'bowtie2'
}

snapshots['test_upload[uvloop-404] 1'] = {
    'id': 1,
    'name': 'subtraction.1.bt2',
    'size': 12,
    'subtraction': 'foo',
    'type': 'bowtie2'
}

snapshots['test_finalize_subtraction[uvloop-None] 1'] = {
    'files': [
        {
            'id': 1,
            'name': 'subtraction.fq.gz',
            'size': 12345,
            'subtraction': 'foo',
            'type': 'fasta'
        },
        {
            'id': 2,
            'name': 'subtraction.1.bt2',
            'size': 56437,
            'subtraction': 'foo',
            'type': 'bowtie2'
        },
        {
            'id': 3,
            'name': 'subtraction.2.bt2',
            'size': 93845,
            'subtraction': 'foo',
            'type': 'bowtie2'
        }
    ],
    'gc': {
        'a': 0.319,
        'c': 0.18,
        'g': 0.18,
        'n': 0.002,
        't': 0.319
    },
    'id': 'foo',
    'name': 'Foo',
    'nickname': 'Foo Subtraction',
    'ready': True
}

snapshots['test_job_remove[uvloop-True-False] 1'] = {
    '_id': 'foo',
    'deleted': True,
    'name': 'Foo',
    'nickname': 'Foo Subtraction',
    'ready': False
}

snapshots['test_job_remove[uvloop-True-False] 2'] = {
    '_id': 'test',
    'name': 'Test',
    'subtractions': [
    ]
}

snapshots['test_finalize_subtraction[uvloop-None] 2'] = {
    '_id': 'foo',
    'gc': {
        'a': 0.319,
        'c': 0.18,
        'g': 0.18,
        'n': 0.002,
        't': 0.319
    },
    'name': 'Foo',
    'nickname': 'Foo Subtraction',
    'ready': True
}
