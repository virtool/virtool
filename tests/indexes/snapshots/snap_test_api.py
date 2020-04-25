# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['test_find[uvloop] 1'] = {
    'change_count': 12,
    'documents': [
        {
            'change_count': 4,
            'created_at': '2015-10-06T20:00:00Z',
            'has_files': True,
            'id': 'bar',
            'job': {
                'id': 'bar'
            },
            'modified_otu_count': 3,
            'ready': False,
            'reference': {
                'id': 'bar'
            },
            'user': {
                'id': 'bob'
            },
            'version': 1
        },
        {
            'change_count': 2,
            'created_at': '2015-10-06T20:00:00Z',
            'has_files': True,
            'id': 'foo',
            'job': {
                'id': 'foo'
            },
            'modified_otu_count': 2,
            'ready': False,
            'reference': {
                'id': 'foo'
            },
            'user': {
                'id': 'bob'
            },
            'version': 0
        }
    ],
    'found_count': 2,
    'modified_otu_count': 3,
    'page': 1,
    'page_count': 1,
    'per_page': 25,
    'total_count': 2,
    'total_otu_count': 123
}

snapshots['test_get[uvloop-None] 1'] = {
    'change_count': 2,
    'contributors': [
        {
            'count': 1,
            'id': 'fred'
        },
        {
            'count': 3,
            'id': 'igboyes'
        }
    ],
    'created_at': '2015-10-06T20:00:00Z',
    'has_files': True,
    'id': 'foobar',
    'job': {
        'id': 'sj82la'
    },
    'modified_otu_count': 2,
    'otus': [
        {
            'change_count': 1,
            'id': 'kjs8sa99',
            'name': 'Foo'
        },
        {
            'change_count': 3,
            'id': 'zxbbvngc',
            'name': 'Test'
        }
    ],
    'ready': False,
    'user': {
        'id': 'test'
    },
    'version': 0
}
