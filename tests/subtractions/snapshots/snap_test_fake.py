# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['test_create_fake_subtractions[uvloop] 1'] = [
    {
        '_id': '2x6YnyMt',
        'count': 100,
        'deleted': False,
        'file': {
            'id': 1,
            'name': 'test.fa.gz'
        },
        'gc': {
            'a': 0.25,
            'c': 0.25,
            'g': 0.25,
            't': 0.25
        },
        'name': 'subtraction_1',
        'nickname': '',
        'ready': True,
        'user': {
            'id': 'bob'
        }
    },
    {
        '_id': 'c2uyoYJd',
        'deleted': False,
        'file': {
            'id': 1,
            'name': 'test.fa.gz'
        },
        'name': 'subtraction_2',
        'nickname': '',
        'ready': False,
        'user': {
            'id': 'bob'
        }
    },
    {
        '_id': '5NxTrGkY',
        'deleted': False,
        'file': {
            'id': 1,
            'name': 'test.fa.gz'
        },
        'name': 'subtraction_unready',
        'nickname': '',
        'ready': False,
        'user': {
            'id': 'bob'
        }
    }
]
