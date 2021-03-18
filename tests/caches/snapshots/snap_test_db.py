# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import GenericRepr, Snapshot


snapshots = Snapshot()

snapshots['test_create[uvloop-paired] return'] = {
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'files': [
    ],
    'id': '9pfsom1b',
    'key': 'aodp-abcdefgh',
    'legacy': False,
    'missing': False,
    'paired': True,
    'ready': False,
    'sample': {
        'id': 'foo'
    }
}

snapshots['test_create[uvloop-paired] db'] = {
    '_id': '9pfsom1b',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'files': [
    ],
    'key': 'aodp-abcdefgh',
    'legacy': False,
    'missing': False,
    'paired': True,
    'ready': False,
    'sample': {
        'id': 'foo'
    }
}

snapshots['test_create[uvloop-unpaired] return'] = {
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'files': [
    ],
    'id': '9pfsom1b',
    'key': 'aodp-abcdefgh',
    'legacy': False,
    'missing': False,
    'paired': False,
    'ready': False,
    'sample': {
        'id': 'foo'
    }
}

snapshots['test_create[uvloop-unpaired] db'] = {
    '_id': '9pfsom1b',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'files': [
    ],
    'key': 'aodp-abcdefgh',
    'legacy': False,
    'missing': False,
    'paired': False,
    'ready': False,
    'sample': {
        'id': 'foo'
    }
}

snapshots['test_create_duplicate[uvloop] return'] = {
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'files': [
    ],
    'id': 'u3cuwaoq',
    'key': 'aodp-abcdefgh',
    'legacy': False,
    'missing': False,
    'paired': False,
    'ready': False,
    'sample': {
        'id': 'foo'
    }
}

snapshots['test_create_duplicate[uvloop] db'] = {
    '_id': 'u3cuwaoq',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'files': [
    ],
    'key': 'aodp-abcdefgh',
    'legacy': False,
    'missing': False,
    'paired': False,
    'ready': False,
    'sample': {
        'id': 'foo'
    }
}

snapshots['test_create_legacy[uvloop] return'] = {
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'files': [
    ],
    'id': '9pfsom1b',
    'key': 'aodp-abcdefgh',
    'legacy': True,
    'missing': False,
    'paired': False,
    'ready': False,
    'sample': {
        'id': 'foo'
    }
}

snapshots['test_create_legacy[uvloop] db'] = {
    '_id': '9pfsom1b',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'files': [
    ],
    'key': 'aodp-abcdefgh',
    'legacy': True,
    'missing': False,
    'paired': False,
    'ready': False,
    'sample': {
        'id': 'foo'
    }
}
