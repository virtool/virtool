# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import GenericRepr, Snapshot


snapshots = Snapshot()

snapshots['test_get[uvloop-None-True] format_analysis'] = {
    '_id': 'foobar',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'ready': True,
    'results': {
    },
    'sample': {
        'id': 'baz'
    },
    'subtraction': {
        'id': 'plum',
        'name': 'Plum'
    },
    'workflow': 'pathoscope_bowtie'
}

snapshots['test_get[uvloop-None-True] 1'] = {
    'created_at': '2015-10-06T20:00:00Z',
    'formatted': True,
    'id': 'foo'
}

snapshots['test_get[uvloop-None-False] 1'] = {
    'created_at': '2015-10-06T20:00:00Z',
    'id': 'foobar',
    'ready': False,
    'results': {
    },
    'sample': {
        'id': 'baz'
    },
    'subtraction': {
        'id': 'plum',
        'name': 'Plum'
    },
    'workflow': 'pathoscope_bowtie'
}

snapshots['test_find[uvloop] 1'] = {
    'documents': [
        {
            'created_at': '2015-10-06T20:00:00Z',
            'id': 'test_1',
            'index': {
                'id': 'foo',
                'version': 2
            },
            'job': {
                'id': 'test'
            },
            'ready': True,
            'reference': {
                'id': 'baz',
                'name': 'Baz'
            },
            'sample': {
                'id': 'test'
            },
            'user': {
                'id': 'bob'
            },
            'workflow': 'pathoscope_bowtie'
        },
        {
            'created_at': '2015-10-06T20:00:00Z',
            'id': 'test_2',
            'index': {
                'id': 'foo',
                'version': 2
            },
            'job': {
                'id': 'test'
            },
            'ready': True,
            'reference': {
                'id': 'baz',
                'name': 'Baz'
            },
            'sample': {
                'id': 'test'
            },
            'user': {
                'id': 'fred'
            },
            'workflow': 'pathoscope_bowtie'
        },
        {
            'created_at': '2015-10-06T20:00:00Z',
            'id': 'test_3',
            'index': {
                'id': 'foo',
                'version': 2
            },
            'job': {
                'id': 'test'
            },
            'ready': True,
            'reference': {
                'id': 'foo',
                'name': 'Foo'
            },
            'sample': {
                'id': 'test'
            },
            'user': {
                'id': 'fred'
            },
            'workflow': 'pathoscope_bowtie'
        }
    ],
    'found_count': 3,
    'page': 1,
    'page_count': 1,
    'per_page': 25,
    'total_count': 3
}
