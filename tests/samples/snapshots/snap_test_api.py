# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import GenericRepr, Snapshot


snapshots = Snapshot()

snapshots['test_find_analyses[uvloop-None-None] 1'] = {
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

snapshots['test_find_analyses[uvloop-bob-None] 1'] = {
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
        }
    ],
    'found_count': 1,
    'page': 1,
    'page_count': 1,
    'per_page': 25,
    'total_count': 3
}

snapshots['test_get_cache[uvloop-None] 1'] = {
    'id': 'bar',
    'key': 'abc123',
    'program': 'skewer-0.2.2',
    'sample': {
        'id': 'foo'
    }
}

snapshots['test_upload_reads_cache[uvloop-True] 1'] = {
    'id': 2,
    'key': 'aodp-abcdefgh',
    'name': 'reads_2.fq.gz',
    'name_on_disk': 'reads_2.fq.gz',
    'sample': 'test',
    'size': 9081,
    'uploaded_at': '2015-10-06T20:00:00Z'
}

snapshots['test_find[uvloop-None-None-None-None-d_range1-meta1] 1'] = {
    'documents': [
        {
            'created_at': '2015-10-06T22:00:00Z',
            'host': '',
            'id': 'cb400e6d',
            'isolate': '',
            'labels': [
                {
                    'color': '#0d321d',
                    'description': 'This is a question',
                    'id': 3,
                    'name': 'Question'
                }
            ],
            'name': '16SPP044',
            'nuvs': False,
            'pathoscope': False,
            'ready': True,
            'user': {
                'id': 'fred'
            }
        },
        {
            'created_at': '2015-10-06T21:00:00Z',
            'host': '',
            'id': 'beb1eb10',
            'isolate': 'Thing',
            'labels': [
                {
                    'color': '#a83432',
                    'description': 'This is a bug',
                    'id': 1,
                    'name': 'Bug'
                },
                {
                    'color': '#03fc20',
                    'description': 'This is a info',
                    'id': 2,
                    'name': 'Info'
                }
            ],
            'name': '16GVP042',
            'nuvs': False,
            'pathoscope': False,
            'ready': True,
            'user': {
                'id': 'bob'
            }
        },
        {
            'created_at': '2015-10-06T20:00:00Z',
            'host': '',
            'id': '72bb8b31',
            'isolate': 'Test',
            'labels': [
                {
                    'color': '#a83432',
                    'description': 'This is a bug',
                    'id': 1,
                    'name': 'Bug'
                }
            ],
            'name': '16GVP043',
            'nuvs': False,
            'pathoscope': False,
            'ready': True,
            'user': {
                'id': 'fred'
            }
        }
    ],
    'found_count': 3,
    'page': 1,
    'page_count': 1,
    'per_page': 25,
    'total_count': 3
}

snapshots['test_find[uvloop-None-None-None-label_filter7-None-None] 1'] = {
    'documents': [
        {
            'created_at': '2015-10-06T22:00:00Z',
            'host': '',
            'id': 'cb400e6d',
            'isolate': '',
            'labels': [
                {
                    'color': '#0d321d',
                    'description': 'This is a question',
                    'id': 3,
                    'name': 'Question'
                }
            ],
            'name': '16SPP044',
            'nuvs': False,
            'pathoscope': False,
            'ready': True,
            'user': {
                'id': 'fred'
            }
        }
    ],
    'found_count': 1,
    'page': 1,
    'page_count': 1,
    'per_page': 25,
    'total_count': 3
}

snapshots['test_get[uvloop-False-None] 1'] = {
    'artifacts': [
        {
            'id': 1,
            'name': 'reference.fa.gz',
            'name_on_disk': 'reference.fa.gz',
            'sample': 'test',
            'size': None,
            'type': 'fasta',
            'uploaded_at': None
        }
    ],
    'caches': [
    ],
    'created_at': '2015-10-06T20:00:00Z',
    'files': [
        {
            'download_url': '/download/samples/files/file_1.fq.gz',
            'id': 'foo',
            'name': 'Bar.fq.gz'
        }
    ],
    'id': 'test',
    'labels': [
        {
            'color': '#a83432',
            'description': 'This is a bug',
            'id': 1,
            'name': 'Bug'
        }
    ],
    'name': 'Test',
    'paired': False,
    'reads': [
        {
            'id': 1,
            'name': 'reads_1.fq.gz',
            'name_on_disk': 'reads_1.fq.gz',
            'sample': 'test',
            'size': None,
            'upload': {
                'created_at': None,
                'id': 1,
                'name': 'test',
                'name_on_disk': None,
                'ready': False,
                'removed': False,
                'removed_at': None,
                'reserved': False,
                'size': None,
                'type': None,
                'uploaded_at': None,
                'user': None
            },
            'uploaded_at': None
        }
    ],
    'ready': False,
    'subtractions': [
        {
            'id': 'foo',
            'name': 'Foo'
        },
        {
            'id': 'bar',
            'name': 'Bar'
        }
    ]
}
