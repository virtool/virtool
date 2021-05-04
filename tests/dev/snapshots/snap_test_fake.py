# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import GenericRepr, Snapshot


snapshots = Snapshot()

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
    '_id': 'sample_integration_test_job',
    'acquired': False,
    'args': {
        'analysis_id': 'analysis_1',
        'ref_id': 'reference_1',
        'sample_id': 'sample_paired_finalized',
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

snapshots['test_create_fake_references[uvloop] 1'] = [
    {
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
    },
    {
        '_id': 'reference_2',
        'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
        'data_type': 'genome',
        'description': 'A fake reference',
        'groups': [
        ],
        'internal_control': None,
        'name': 'Reference 2',
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
]
