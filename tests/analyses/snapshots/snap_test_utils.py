# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['test_attach_analysis_files[uvloop-True] 1'] = {
    '_id': 'foobar',
    'files': [
        {
            'analysis': 'foobar',
            'description': None,
            'format': 'fasta',
            'id': 1,
            'name': 'reference-fa',
            'name_on_disk': '1-reference-fa',
            'size': None,
            'uploaded_at': None
        }
    ],
    'ready': True
}

snapshots['test_attach_analysis_files[uvloop-False] 1'] = {
    '_id': 'foobar',
    'files': [
    ],
    'ready': True
}
