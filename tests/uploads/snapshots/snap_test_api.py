# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['TestUpload.test[uvloop-reference] 1'] = {
    'created_at': '2015-10-06T20:00:00Z',
    'id': 1,
    'name': 'Test.fq.gz',
    'name_on_disk': '1-Test.fq.gz',
    'ready': False,
    'removed': False,
    'reserved': False,
    'size': 9081,
    'type': 'reference',
    'uploaded_at': '2015-10-06T20:00:00Z',
    'user': 'test'
}

snapshots['TestUpload.test[uvloop-reads] 1'] = {
    'created_at': '2015-10-06T20:00:00Z',
    'id': 1,
    'name': 'Test.fq.gz',
    'name_on_disk': '1-Test.fq.gz',
    'ready': False,
    'removed': False,
    'reserved': False,
    'size': 9081,
    'type': 'reads',
    'uploaded_at': '2015-10-06T20:00:00Z',
    'user': 'test'
}

snapshots['TestUpload.test[uvloop-hmm] 1'] = {
    'created_at': '2015-10-06T20:00:00Z',
    'id': 1,
    'name': 'Test.fq.gz',
    'name_on_disk': '1-Test.fq.gz',
    'ready': False,
    'removed': False,
    'reserved': False,
    'size': 9081,
    'type': 'hmm',
    'uploaded_at': '2015-10-06T20:00:00Z',
    'user': 'test'
}

snapshots['TestUpload.test[uvloop-subtraction] 1'] = {
    'created_at': '2015-10-06T20:00:00Z',
    'id': 1,
    'name': 'Test.fq.gz',
    'name_on_disk': '1-Test.fq.gz',
    'ready': False,
    'removed': False,
    'reserved': False,
    'size': 9081,
    'type': 'subtraction',
    'uploaded_at': '2015-10-06T20:00:00Z',
    'user': 'test'
}

snapshots['TestUpload.test[uvloop-None] 1'] = {
    'created_at': '2015-10-06T20:00:00Z',
    'id': 1,
    'name': 'Test.fq.gz',
    'name_on_disk': '1-Test.fq.gz',
    'ready': False,
    'removed': False,
    'reserved': False,
    'size': 9081,
    'type': None,
    'uploaded_at': '2015-10-06T20:00:00Z',
    'user': 'test'
}
