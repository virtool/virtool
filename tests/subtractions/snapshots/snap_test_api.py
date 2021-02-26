# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['test_edit[uvloop-data0] json'] = {
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
