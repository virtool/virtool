# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['test_check_db[uvloop] 1'] = {
    'document': {
        '_id': 'baz',
        'files': [
            {
                'id': 'foo.fq.gz',
                'size': 123456
            }
        ],
        'paired': False
    },
    'fastqc_path': '/tmp/tmpt76p6jri/baz/fastqc',
    'files': [
        {
            'id': 'foo.fq.gz',
            'size': 123456
        }
    ],
    'paired': False,
    'sample_id': 'baz',
    'sample_path': '/tmp/pytest-of-igboyes/pytest-83/test_check_db_uvloop_0/samples/baz',
    'temp_sample_path': '/tmp/tmpt76p6jri/baz'
}
