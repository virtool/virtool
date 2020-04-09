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
