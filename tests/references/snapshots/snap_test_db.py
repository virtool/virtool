# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['TestEdit.test_control[uvloop-None-True] 1'] = {
    '_id': 'foo',
    'data_type': 'genome',
    'description': 'This is a test reference.',
    'internal_control': {
        'id': 'bar'
    },
    'name': 'Tester',
    'users': [
        {
            'id': 'bob'
        }
    ]
}

snapshots['TestEdit.test_control[uvloop-None-False] 1'] = {
    '_id': 'foo',
    'data_type': 'genome',
    'description': 'This is a test reference.',
    'internal_control': {
        'id': 'bar'
    },
    'name': 'Tester',
    'users': [
        {
            'id': 'bob'
        }
    ]
}

snapshots['TestEdit.test_control[uvloop-baz-True] 1'] = {
    '_id': 'foo',
    'data_type': 'genome',
    'description': 'This is a test reference.',
    'internal_control': {
        'id': 'baz'
    },
    'name': 'Tester',
    'users': [
        {
            'id': 'bob'
        }
    ]
}

snapshots['TestEdit.test_control[uvloop-baz-False] 1'] = {
    '_id': 'foo',
    'data_type': 'genome',
    'description': 'This is a test reference.',
    'internal_control': None,
    'name': 'Tester',
    'users': [
        {
            'id': 'bob'
        }
    ]
}

snapshots['TestEdit.test_control[uvloop-None-True] 2'] = {
    'contributors': [
    ],
    'data_type': 'genome',
    'description': 'This is a test reference.',
    'id': 'foo',
    'internal_control': {
        'id': 'baz'
    },
    'latest_build': None,
    'name': 'Tester',
    'otu_count': 0,
    'unbuilt_change_count': 0,
    'users': [
        {
            'id': 'bob'
        }
    ]
}

snapshots['TestEdit.test_control[uvloop-None-False] 2'] = {
    'contributors': [
    ],
    'data_type': 'genome',
    'description': 'This is a test reference.',
    'id': 'foo',
    'internal_control': None,
    'latest_build': None,
    'name': 'Tester',
    'otu_count': 0,
    'unbuilt_change_count': 0,
    'users': [
        {
            'id': 'bob'
        }
    ]
}

snapshots['TestEdit.test_control[uvloop-baz-True] 2'] = {
    'contributors': [
    ],
    'data_type': 'genome',
    'description': 'This is a test reference.',
    'id': 'foo',
    'internal_control': {
        'id': 'baz'
    },
    'latest_build': None,
    'name': 'Tester',
    'otu_count': 0,
    'unbuilt_change_count': 0,
    'users': [
        {
            'id': 'bob'
        }
    ]
}

snapshots['TestEdit.test_control[uvloop-baz-False] 2'] = {
    'contributors': [
    ],
    'data_type': 'genome',
    'description': 'This is a test reference.',
    'id': 'foo',
    'internal_control': None,
    'latest_build': None,
    'name': 'Tester',
    'otu_count': 0,
    'unbuilt_change_count': 0,
    'users': [
        {
            'id': 'bob'
        }
    ]
}

snapshots['TestEdit.test_reference_name[uvloop] 1'] = {
    '_id': 'foo',
    'data_type': 'genome',
    'internal_control': {
        'id': 'bar'
    },
    'name': 'Bar',
    'users': [
        {
            'id': 'bob'
        }
    ]
}

snapshots['TestEdit.test_reference_name[uvloop] 2'] = [
    {
        '_id': 'baz',
        'reference': {
            'id': 'foo',
            'name': 'Bar'
        }
    },
    {
        '_id': 'boo',
        'reference': {
            'id': 'foo',
            'name': 'Bar'
        }
    }
]

snapshots['TestEdit.test_control[uvloop--True] 1'] = {
    '_id': 'foo',
    'data_type': 'genome',
    'description': 'This is a test reference.',
    'internal_control': None,
    'name': 'Tester',
    'users': [
        {
            'id': 'bob'
        }
    ]
}

snapshots['TestEdit.test_control[uvloop--True] 2'] = {
    'contributors': [
    ],
    'data_type': 'genome',
    'description': 'This is a test reference.',
    'id': 'foo',
    'internal_control': {
        'id': 'baz'
    },
    'latest_build': None,
    'name': 'Tester',
    'otu_count': 0,
    'unbuilt_change_count': 0,
    'users': [
        {
            'id': 'bob'
        }
    ]
}

snapshots['TestEdit.test_control[uvloop--False] 1'] = {
    '_id': 'foo',
    'data_type': 'genome',
    'description': 'This is a test reference.',
    'internal_control': None,
    'name': 'Tester',
    'users': [
        {
            'id': 'bob'
        }
    ]
}

snapshots['TestEdit.test_control[uvloop--False] 2'] = {
    'contributors': [
    ],
    'data_type': 'genome',
    'description': 'This is a test reference.',
    'id': 'foo',
    'internal_control': None,
    'latest_build': None,
    'name': 'Tester',
    'otu_count': 0,
    'unbuilt_change_count': 0,
    'users': [
        {
            'id': 'bob'
        }
    ]
}
