# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['TestUpload.test[uvloop-hmm] 1'] = {
    'created_at': '2015-10-06T20:00:00Z',
    'id': 1,
    'name': 'Test.fq.gz',
    'name_on_disk': '1-Test.fq.gz',
    'ready': True,
    'removed': False,
    'removed_at': None,
    'reserved': False,
    'size': 9081,
    'type': 'hmm',
    'uploaded_at': '2015-10-06T20:00:00Z',
    'user': 'test'
}

snapshots['TestUpload.test[uvloop-reference] 1'] = {
    'created_at': '2015-10-06T20:00:00Z',
    'id': 1,
    'name': 'Test.fq.gz',
    'name_on_disk': '1-Test.fq.gz',
    'ready': True,
    'removed': False,
    'removed_at': None,
    'reserved': False,
    'size': 9081,
    'type': 'reference',
    'uploaded_at': '2015-10-06T20:00:00Z',
    'user': 'test'
}

snapshots['TestUpload.test[uvloop-reads] 1'] = {
    'created_at': '2015-10-06T20:00:00Z',
    'id': 1,
    'name': 'Test.fq.gz',
    'name_on_disk': '1-Test.fq.gz',
    'ready': True,
    'removed': False,
    'removed_at': None,
    'reserved': False,
    'size': 9081,
    'type': 'reads',
    'uploaded_at': '2015-10-06T20:00:00Z',
    'user': 'test'
}

snapshots['TestUpload.test[uvloop-subtraction] 1'] = {
    'created_at': '2015-10-06T20:00:00Z',
    'id': 1,
    'name': 'Test.fq.gz',
    'name_on_disk': '1-Test.fq.gz',
    'ready': True,
    'removed': False,
    'removed_at': None,
    'reserved': False,
    'size': 9081,
    'type': 'subtraction',
    'uploaded_at': '2015-10-06T20:00:00Z',
    'user': 'test'
}

snapshots['TestUpload.test[uvloop-None] 1'] = {
    'created_at': '2015-10-06T20:00:00Z',
    'id': 1,
    'name': 'Test.fq.gz',
    'name_on_disk': '1-Test.fq.gz',
    'ready': True,
    'removed': False,
    'removed_at': None,
    'reserved': False,
    'size': 9081,
    'type': None,
    'uploaded_at': '2015-10-06T20:00:00Z',
    'user': 'test'
}

snapshots['TestFind.test[uvloop-danny-reads] 1'] = [
    {
        'created_at': None,
        'id': 1,
        'name': 'test.fq.gz',
        'name_on_disk': None,
        'ready': None,
        'removed': None,
        'removed_at': None,
        'reserved': None,
        'size': None,
        'type': 'reads',
        'uploaded_at': None,
        'user': 'danny'
    },
    {
        'created_at': None,
        'id': 2,
        'name': 'test.fq.gz',
        'name_on_disk': None,
        'ready': None,
        'removed': None,
        'removed_at': None,
        'reserved': None,
        'size': None,
        'type': 'subtraction',
        'uploaded_at': None,
        'user': 'lester'
    },
    {
        'created_at': None,
        'id': 3,
        'name': 'test.fq.gz',
        'name_on_disk': None,
        'ready': None,
        'removed': None,
        'removed_at': None,
        'reserved': None,
        'size': None,
        'type': None,
        'uploaded_at': None,
        'user': 'jake'
    }
]

snapshots['TestFind.test[uvloop-danny-reference] 1'] = [
    {
        'created_at': None,
        'id': 1,
        'name': 'test.fq.gz',
        'name_on_disk': None,
        'ready': None,
        'removed': None,
        'removed_at': None,
        'reserved': None,
        'size': None,
        'type': 'reads',
        'uploaded_at': None,
        'user': 'danny'
    },
    {
        'created_at': None,
        'id': 2,
        'name': 'test.fq.gz',
        'name_on_disk': None,
        'ready': None,
        'removed': None,
        'removed_at': None,
        'reserved': None,
        'size': None,
        'type': 'subtraction',
        'uploaded_at': None,
        'user': 'lester'
    },
    {
        'created_at': None,
        'id': 3,
        'name': 'test.fq.gz',
        'name_on_disk': None,
        'ready': None,
        'removed': None,
        'removed_at': None,
        'reserved': None,
        'size': None,
        'type': None,
        'uploaded_at': None,
        'user': 'jake'
    }
]

snapshots['TestFind.test[uvloop-danny-None] 1'] = [
    {
        'created_at': None,
        'id': 1,
        'name': 'test.fq.gz',
        'name_on_disk': None,
        'ready': None,
        'removed': None,
        'removed_at': None,
        'reserved': None,
        'size': None,
        'type': 'reads',
        'uploaded_at': None,
        'user': 'danny'
    },
    {
        'created_at': None,
        'id': 2,
        'name': 'test.fq.gz',
        'name_on_disk': None,
        'ready': None,
        'removed': None,
        'removed_at': None,
        'reserved': None,
        'size': None,
        'type': 'subtraction',
        'uploaded_at': None,
        'user': 'lester'
    },
    {
        'created_at': None,
        'id': 3,
        'name': 'test.fq.gz',
        'name_on_disk': None,
        'ready': None,
        'removed': None,
        'removed_at': None,
        'reserved': None,
        'size': None,
        'type': None,
        'uploaded_at': None,
        'user': 'jake'
    }
]

snapshots['TestFind.test[uvloop-lester-reads] 1'] = [
    {
        'created_at': None,
        'id': 1,
        'name': 'test.fq.gz',
        'name_on_disk': None,
        'ready': None,
        'removed': None,
        'removed_at': None,
        'reserved': None,
        'size': None,
        'type': 'reads',
        'uploaded_at': None,
        'user': 'danny'
    },
    {
        'created_at': None,
        'id': 2,
        'name': 'test.fq.gz',
        'name_on_disk': None,
        'ready': None,
        'removed': None,
        'removed_at': None,
        'reserved': None,
        'size': None,
        'type': 'subtraction',
        'uploaded_at': None,
        'user': 'lester'
    },
    {
        'created_at': None,
        'id': 3,
        'name': 'test.fq.gz',
        'name_on_disk': None,
        'ready': None,
        'removed': None,
        'removed_at': None,
        'reserved': None,
        'size': None,
        'type': None,
        'uploaded_at': None,
        'user': 'jake'
    }
]

snapshots['TestFind.test[uvloop-lester-reference] 1'] = [
    {
        'created_at': None,
        'id': 1,
        'name': 'test.fq.gz',
        'name_on_disk': None,
        'ready': None,
        'removed': None,
        'removed_at': None,
        'reserved': None,
        'size': None,
        'type': 'reads',
        'uploaded_at': None,
        'user': 'danny'
    },
    {
        'created_at': None,
        'id': 2,
        'name': 'test.fq.gz',
        'name_on_disk': None,
        'ready': None,
        'removed': None,
        'removed_at': None,
        'reserved': None,
        'size': None,
        'type': 'subtraction',
        'uploaded_at': None,
        'user': 'lester'
    },
    {
        'created_at': None,
        'id': 3,
        'name': 'test.fq.gz',
        'name_on_disk': None,
        'ready': None,
        'removed': None,
        'removed_at': None,
        'reserved': None,
        'size': None,
        'type': None,
        'uploaded_at': None,
        'user': 'jake'
    }
]

snapshots['TestFind.test[uvloop-lester-None] 1'] = [
    {
        'created_at': None,
        'id': 1,
        'name': 'test.fq.gz',
        'name_on_disk': None,
        'ready': None,
        'removed': None,
        'removed_at': None,
        'reserved': None,
        'size': None,
        'type': 'reads',
        'uploaded_at': None,
        'user': 'danny'
    },
    {
        'created_at': None,
        'id': 2,
        'name': 'test.fq.gz',
        'name_on_disk': None,
        'ready': None,
        'removed': None,
        'removed_at': None,
        'reserved': None,
        'size': None,
        'type': 'subtraction',
        'uploaded_at': None,
        'user': 'lester'
    },
    {
        'created_at': None,
        'id': 3,
        'name': 'test.fq.gz',
        'name_on_disk': None,
        'ready': None,
        'removed': None,
        'removed_at': None,
        'reserved': None,
        'size': None,
        'type': None,
        'uploaded_at': None,
        'user': 'jake'
    }
]

snapshots['TestFind.test[uvloop-jake-reads] 1'] = [
    {
        'created_at': None,
        'id': 1,
        'name': 'test.fq.gz',
        'name_on_disk': None,
        'ready': None,
        'removed': None,
        'removed_at': None,
        'reserved': None,
        'size': None,
        'type': 'reads',
        'uploaded_at': None,
        'user': 'danny'
    },
    {
        'created_at': None,
        'id': 2,
        'name': 'test.fq.gz',
        'name_on_disk': None,
        'ready': None,
        'removed': None,
        'removed_at': None,
        'reserved': None,
        'size': None,
        'type': 'subtraction',
        'uploaded_at': None,
        'user': 'lester'
    },
    {
        'created_at': None,
        'id': 3,
        'name': 'test.fq.gz',
        'name_on_disk': None,
        'ready': None,
        'removed': None,
        'removed_at': None,
        'reserved': None,
        'size': None,
        'type': None,
        'uploaded_at': None,
        'user': 'jake'
    }
]

snapshots['TestFind.test[uvloop-jake-reference] 1'] = [
    {
        'created_at': None,
        'id': 1,
        'name': 'test.fq.gz',
        'name_on_disk': None,
        'ready': None,
        'removed': None,
        'removed_at': None,
        'reserved': None,
        'size': None,
        'type': 'reads',
        'uploaded_at': None,
        'user': 'danny'
    },
    {
        'created_at': None,
        'id': 2,
        'name': 'test.fq.gz',
        'name_on_disk': None,
        'ready': None,
        'removed': None,
        'removed_at': None,
        'reserved': None,
        'size': None,
        'type': 'subtraction',
        'uploaded_at': None,
        'user': 'lester'
    },
    {
        'created_at': None,
        'id': 3,
        'name': 'test.fq.gz',
        'name_on_disk': None,
        'ready': None,
        'removed': None,
        'removed_at': None,
        'reserved': None,
        'size': None,
        'type': None,
        'uploaded_at': None,
        'user': 'jake'
    }
]

snapshots['TestFind.test[uvloop-jake-None] 1'] = [
    {
        'created_at': None,
        'id': 1,
        'name': 'test.fq.gz',
        'name_on_disk': None,
        'ready': None,
        'removed': None,
        'removed_at': None,
        'reserved': None,
        'size': None,
        'type': 'reads',
        'uploaded_at': None,
        'user': 'danny'
    },
    {
        'created_at': None,
        'id': 2,
        'name': 'test.fq.gz',
        'name_on_disk': None,
        'ready': None,
        'removed': None,
        'removed_at': None,
        'reserved': None,
        'size': None,
        'type': 'subtraction',
        'uploaded_at': None,
        'user': 'lester'
    },
    {
        'created_at': None,
        'id': 3,
        'name': 'test.fq.gz',
        'name_on_disk': None,
        'ready': None,
        'removed': None,
        'removed_at': None,
        'reserved': None,
        'size': None,
        'type': None,
        'uploaded_at': None,
        'user': 'jake'
    }
]
