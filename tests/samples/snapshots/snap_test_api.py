# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import GenericRepr, Snapshot


snapshots = Snapshot()

snapshots['TestCreate.test[uvloop-none] 1'] = {
    'all_read': True,
    'all_write': True,
    'analyzed': False,
    'archived': False,
    'created_at': '2015-10-06T20:00:00Z',
    'files': [
        {
            'id': 'test.fq'
        }
    ],
    'format': 'fastq',
    'group': 'none',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'id': '9pfsom1b',
    'imported': 'ip',
    'library_type': 'normal',
    'name': 'Foobar',
    'nuvs': False,
    'paired': False,
    'pathoscope': False,
    'quality': None,
    'subtraction': {
        'id': 'apple'
    },
    'user': {
        'id': 'test'
    }
}

snapshots['TestCreate.test[uvloop-users_primary_group] 1'] = {
    'all_read': True,
    'all_write': True,
    'analyzed': False,
    'archived': False,
    'created_at': '2015-10-06T20:00:00Z',
    'files': [
        {
            'id': 'test.fq'
        }
    ],
    'format': 'fastq',
    'group': 'technician',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'id': '9pfsom1b',
    'imported': 'ip',
    'library_type': 'normal',
    'name': 'Foobar',
    'nuvs': False,
    'paired': False,
    'pathoscope': False,
    'quality': None,
    'subtraction': {
        'id': 'apple'
    },
    'user': {
        'id': 'test'
    }
}

snapshots['TestCreate.test[uvloop-force_choice] 1'] = {
    'all_read': True,
    'all_write': True,
    'analyzed': False,
    'archived': False,
    'created_at': '2015-10-06T20:00:00Z',
    'files': [
        {
            'id': 'test.fq'
        }
    ],
    'format': 'fastq',
    'group': 'diagnostics',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'id': '9pfsom1b',
    'imported': 'ip',
    'library_type': 'normal',
    'name': 'Foobar',
    'nuvs': False,
    'paired': False,
    'pathoscope': False,
    'quality': None,
    'subtraction': {
        'id': 'apple'
    },
    'user': {
        'id': 'test'
    }
}

snapshots['TestCreate.test[uvloop-none] 2'] = {
    '_id': '9pfsom1b',
    'all_read': True,
    'all_write': True,
    'analyzed': False,
    'archived': False,
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'files': [
        {
            'id': 'test.fq'
        }
    ],
    'format': 'fastq',
    'group': 'none',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'imported': 'ip',
    'library_type': 'normal',
    'name': 'Foobar',
    'nuvs': False,
    'paired': False,
    'pathoscope': False,
    'quality': None,
    'subtraction': {
        'id': 'apple'
    },
    'user': {
        'id': 'test'
    }
}

snapshots['TestCreate.test[uvloop-users_primary_group] 2'] = {
    '_id': '9pfsom1b',
    'all_read': True,
    'all_write': True,
    'analyzed': False,
    'archived': False,
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'files': [
        {
            'id': 'test.fq'
        }
    ],
    'format': 'fastq',
    'group': 'technician',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'imported': 'ip',
    'library_type': 'normal',
    'name': 'Foobar',
    'nuvs': False,
    'paired': False,
    'pathoscope': False,
    'quality': None,
    'subtraction': {
        'id': 'apple'
    },
    'user': {
        'id': 'test'
    }
}

snapshots['TestCreate.test[uvloop-force_choice] 2'] = {
    '_id': '9pfsom1b',
    'all_read': True,
    'all_write': True,
    'analyzed': False,
    'archived': False,
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'files': [
        {
            'id': 'test.fq'
        }
    ],
    'format': 'fastq',
    'group': 'diagnostics',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'imported': 'ip',
    'library_type': 'normal',
    'name': 'Foobar',
    'nuvs': False,
    'paired': False,
    'pathoscope': False,
    'quality': None,
    'subtraction': {
        'id': 'apple'
    },
    'user': {
        'id': 'test'
    }
}
