# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import GenericRepr, Snapshot


snapshots = Snapshot()

snapshots['test_create_fake_user[uvloop] 1'] = {
    '_id': 'bob',
    'administrator': True,
    'force_reset': False,
    'groups': [
    ],
    'identicon': '81b637d8fcd2c6da6359e6963113a1170de795e4b725b84d1e0b4cfd9ec58ce9',
    'invalidate_sessions': True,
    'last_password_change': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'permissions': {
        'cancel_job': False,
        'create_ref': False,
        'create_sample': False,
        'modify_hmm': False,
        'modify_subtraction': False,
        'remove_file': False,
        'remove_job': False,
        'upload_file': False
    },
    'primary_group': '',
    'settings': {
        'quick_analyze_workflow': 'pathoscope_bowtie',
        'show_ids': True,
        'show_versions': True,
        'skip_quick_analyze_dialog': True
    }
}
