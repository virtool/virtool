# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import GenericRepr, Snapshot


snapshots = Snapshot()

snapshots['test_create[uvloop-genome] 1'] = {
    'contributors': [
    ],
    'created_at': '2015-10-06T20:00:00Z',
    'data_type': 'genome',
    'description': 'A bunch of viruses used for testing',
    'groups': [
    ],
    'id': '9pfsom1b',
    'internal_control': None,
    'latest_build': None,
    'name': 'Test Viruses',
    'organism': 'virus',
    'otu_count': 22,
    'restrict_source_types': False,
    'source_types': [
        'strain',
        'isolate'
    ],
    'unbuilt_change_count': 5,
    'user': {
        'id': 'test'
    },
    'users': [
        {
            'build': True,
            'id': 'test',
            'modify': True,
            'modify_otu': True,
            'remove': True
        }
    ]
}

snapshots['test_create[uvloop-barcode] 1'] = {
    'contributors': [
    ],
    'created_at': '2015-10-06T20:00:00Z',
    'data_type': 'barcode',
    'description': 'A bunch of viruses used for testing',
    'groups': [
    ],
    'id': '9pfsom1b',
    'internal_control': None,
    'latest_build': None,
    'name': 'Test Viruses',
    'organism': 'virus',
    'otu_count': 22,
    'restrict_source_types': False,
    'source_types': [
        'strain',
        'isolate'
    ],
    'targets': [
    ],
    'unbuilt_change_count': 5,
    'user': {
        'id': 'test'
    },
    'users': [
        {
            'build': True,
            'id': 'test',
            'modify': True,
            'modify_otu': True,
            'remove': True
        }
    ]
}

snapshots['test_edit_group_or_user[True-uvloop-group-None] 1'] = {
    'build': False,
    'id': 'tech',
    'modify': False,
    'modify_otu': False,
    'remove': True
}

snapshots['test_edit_group_or_user[True-uvloop-group-None] 2'] = {
    '_id': 'foo',
    'groups': [
        {
            'build': False,
            'id': 'tech',
            'modify': False,
            'modify_otu': False,
            'remove': True
        }
    ],
    'users': [
        {
            'build': False,
            'id': 'fred',
            'modify': False,
            'modify_otu': False,
            'remove': False
        }
    ]
}

snapshots['test_edit_group_or_user[True-uvloop-user-None] 1'] = {
    'build': False,
    'id': 'fred',
    'identicon': 'foo_identicon',
    'modify': False,
    'modify_otu': False,
    'remove': True
}

snapshots['test_edit_group_or_user[True-uvloop-user-None] 2'] = {
    '_id': 'foo',
    'groups': [
        {
            'build': False,
            'id': 'tech',
            'modify': False,
            'modify_otu': False,
            'remove': False
        }
    ],
    'users': [
        {
            'build': False,
            'id': 'fred',
            'modify': False,
            'modify_otu': False,
            'remove': True
        }
    ]
}

snapshots['test_delete_group_or_user[True-uvloop-group-None] 1'] = {
    '_id': 'foo',
    'groups': [
    ],
    'users': [
        {
            'build': False,
            'id': 'fred',
            'modify': False,
            'modify_otu': False,
            'remove': False
        }
    ]
}

snapshots['test_delete_group_or_user[True-uvloop-user-None] 1'] = {
    '_id': 'foo',
    'groups': [
        {
            'build': False,
            'id': 'tech',
            'modify': False,
            'modify_otu': False,
            'remove': False
        }
    ],
    'users': [
    ]
}

snapshots['test_add_group_or_user[True-uvloop-group-None] 1'] = {
    'build': False,
    'created_at': '2015-10-06T20:00:00Z',
    'id': 'tech',
    'modify': True,
    'modify_otu': False,
    'remove': False
}

snapshots['test_add_group_or_user[True-uvloop-group-None] 2'] = {
    '_id': 'foo',
    'groups': [
        {
            'build': False,
            'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
            'id': 'tech',
            'modify': True,
            'modify_otu': False,
            'remove': False
        }
    ],
    'users': [
    ]
}

snapshots['test_add_group_or_user[True-uvloop-user-None] 1'] = {
    'build': False,
    'created_at': '2015-10-06T20:00:00Z',
    'id': 'fred',
    'identicon': 'foo_identicon',
    'modify': True,
    'modify_otu': False,
    'remove': False
}

snapshots['test_add_group_or_user[True-uvloop-user-None] 2'] = {
    '_id': 'foo',
    'groups': [
    ],
    'users': [
        {
            'build': False,
            'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
            'id': 'fred',
            'modify': True,
            'modify_otu': False,
            'remove': False
        }
    ]
}

snapshots['test_edit[uvloop-None-genome] 1'] = {
    'contributors': [
    ],
    'data_type': 'genome',
    'description': 'This is a test reference.',
    'id': 'foo',
    'internal_control': None,
    'latest_build': None,
    'name': 'Bar',
    'otu_count': 0,
    'unbuilt_change_count': 0,
    'users': [
        {
            'id': 'bob',
            'identicon': 'abc123'
        }
    ]
}

snapshots['test_edit[uvloop-None-genome] 2'] = {
    '_id': 'foo',
    'data_type': 'genome',
    'description': 'This is a test reference.',
    'name': 'Bar',
    'users': [
        {
            'id': 'bob'
        }
    ]
}

snapshots['test_edit[uvloop-None-barcode] 1'] = {
    'contributors': [
    ],
    'data_type': 'barcode',
    'description': 'This is a test reference.',
    'id': 'foo',
    'internal_control': None,
    'latest_build': None,
    'name': 'Bar',
    'otu_count': 0,
    'targets': [
        {
            'description': '',
            'name': 'CPN60',
            'required': True
        }
    ],
    'unbuilt_change_count': 0,
    'users': [
        {
            'id': 'bob',
            'identicon': 'abc123'
        }
    ]
}

snapshots['test_edit[uvloop-None-barcode] 2'] = {
    '_id': 'foo',
    'data_type': 'barcode',
    'description': 'This is a test reference.',
    'name': 'Bar',
    'targets': [
        {
            'description': '',
            'name': 'CPN60',
            'required': True
        }
    ],
    'users': [
        {
            'id': 'bob'
        }
    ]
}
