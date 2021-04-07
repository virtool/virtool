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

snapshots['test_create_fake_analysis[uvloop] 1'] = [
    {
        '_id': 'analysis_1',
        'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
        'index': {
            'id': 'foo',
            'version': 2
        },
        'job': {
            'id': 'job_1'
        },
        'ready': False,
        'reference': {
            'id': 'reference_1'
        },
        'sample': {
            'id': 'sample_1'
        },
        'subtractions': [
            'subtraction_1',
            'subtraction_2'
        ],
        'user': {
            'id': 'bob'
        },
        'workflow': 'pathoscope'
    },
    {
        '_id': 'analysis_2',
        'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
        'files': [
            {
                'analysis': 'analysis_2',
                'description': None,
                'format': 'fasta',
                'id': 1,
                'name': 'result.fa',
                'name_on_disk': '1-result.fa',
                'size': 123456,
                'uploaded_at': None
            }
        ],
        'index': {
            'id': 'foo',
            'version': 2
        },
        'job': {
            'id': 'job_2'
        },
        'ready': True,
        'reference': {
            'id': 'reference_1'
        },
        'sample': {
            'id': 'sample_1'
        },
        'subtractions': [
            'subtraction_1',
            'subtraction_2'
        ],
        'user': {
            'id': 'bob'
        },
        'workflow': 'pathoscope'
    }
]

snapshots['test_create_fake_job[uvloop] 1'] = {
    '_id': 'integration_test_job',
    'acquired': False,
    'args': {
        'ref_id': 'reference_1',
        'sample_id': 'sample_1',
        'subtraction_id': 'subtraction_1'
    },
    'key': None,
    'rights': {
    },
    'state': 'waiting',
    'status': [
        {
            'error': None,
            'progress': 0,
            'stage': None,
            'state': 'waiting',
            'timestamp': None
        }
    ],
    'task': 'integration_test_workflow',
    'user': {
        'id': 'bob'
    }
}

snapshots['test_create_fake_references[uvloop] 1'] = {
    '_id': 'reference_1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'data_type': 'genome',
    'description': 'A fake reference',
    'groups': [
    ],
    'internal_control': None,
    'name': 'Reference 1',
    'organism': 'virus',
    'restrict_source_types': False,
    'source_types': [
        'isolate',
        'strain'
    ],
    'user': {
        'id': 'bob'
    },
    'users': [
        {
            'build': True,
            'id': 'bob',
            'modify': True,
            'modify_otu': True,
            'remove': True
        }
    ]
}
