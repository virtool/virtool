# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['test_get[uvloop-None-True] format_analysis'] = {
    '_id': 'foobar',
    'algorithm': 'pathoscope_bowtie',
    'ready': True,
    'results': {
    },
    'sample': {
        'id': 'baz'
    },
    'subtraction': {
        'id': 'plum',
        'name': 'Plum'
    }
}
