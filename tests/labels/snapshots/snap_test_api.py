# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['TestFind.test_find_by_name[uvloop] 1'] = [
    {
        'color': '#a83432',
        'count': 0,
        'description': 'This is a bug',
        'id': 1,
        'name': 'Bug'
    }
]
