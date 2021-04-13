# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['test_create_fake_subtractions[uvloop] 1'] = [
    {
        '_id': '2x6YnyMt',
        'deleted': False,
        'file': {
            'id': 1,
            'name': 'test.fa.gz'
        },
        'is_host': True,
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
        'is_host': True,
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
        'is_host': True,
        'name': 'subtraction_unready',
        'nickname': '',
        'ready': False,
        'user': {
            'id': 'bob'
        }
    }
]
