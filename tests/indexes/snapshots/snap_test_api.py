# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import GenericRepr, Snapshot


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

snapshots['TestCreate.test[True-uvloop] 1'] = {
    '_id': 'xjqvxigh',
    'acquired': False,
    'args': {
        'index_id': 'u3cuwaoq',
        'index_version': 9,
        'manifest': 'manifest',
        'ref_id': 'foo',
        'user_id': 'test'
    },
    'key': 'bar',
    'rights': {
        'indexes': {
            'modify': [
                'u3cuwaoq'
            ]
        },
        'references': {
            'read': [
                'foo'
            ]
        }
    },
    'state': 'waiting',
    'status': [
        {
            'error': None,
            'progress': 0,
            'stage': None,
            'state': 'waiting',
            'timestamp': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
        }
    ],
    'task': 'build_index',
    'user': {
        'id': 'test'
    }
}

snapshots['TestCreate.test[True-uvloop] 2'] = {
    '_id': 'u3cuwaoq',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'has_files': True,
    'has_json': False,
    'job': {
        'id': 'xjqvxigh'
    },
    'manifest': 'manifest',
    'ready': False,
    'reference': {
        'id': 'foo'
    },
    'user': {
        'id': 'test'
    },
    'version': 9
}

snapshots['TestCreate.test[True-uvloop] 3'] = {
    'created_at': '2015-10-06T20:00:00Z',
    'has_files': True,
    'has_json': False,
    'id': 'u3cuwaoq',
    'job': {
        'id': 'xjqvxigh'
    },
    'manifest': 'manifest',
    'ready': False,
    'reference': {
        'id': 'foo'
    },
    'user': {
        'id': 'test'
    },
    'version': 9
}

snapshots['test[uvloop-None] 1'] = {
    'documents': [
        {
            'id': 'kjs8sa99.3',
            'index': {
                'id': 'foobar',
                'version': 0
            },
            'method_name': 'add_sequence',
            'otu': {
                'id': 'kjs8sa99',
                'name': 'Foo',
                'version': 3
            },
            'user': {
                'id': 'fred'
            }
        },
        {
            'id': 'zxbbvngc.2',
            'index': {
                'id': 'foobar',
                'version': 0
            },
            'method_name': 'add_isolate',
            'otu': {
                'id': 'zxbbvngc',
                'name': 'Test',
                'version': 2
            },
            'user': {
                'id': 'igboyes'
            }
        },
        {
            'id': 'zxbbvngc.1',
            'index': {
                'id': 'foobar',
                'version': 0
            },
            'method_name': 'add_isolate',
            'otu': {
                'id': 'zxbbvngc',
                'name': 'Test',
                'version': 1
            },
            'user': {
                'id': 'igboyes'
            }
        },
        {
            'id': 'zxbbvngc.0',
            'index': {
                'id': 'foobar',
                'version': 0
            },
            'otu': {
                'id': 'zxbbvngc',
                'name': 'Test',
                'version': 0
            },
            'user': {
                'id': 'igboyes'
            }
        }
    ],
    'found_count': 4,
    'page': 1,
    'page_count': 1,
    'per_page': 25,
    'total_count': 6
}
