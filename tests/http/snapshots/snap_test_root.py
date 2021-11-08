# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['test_get[uvloop] 1'] = {
    'dev': False,
    'endpoints': {
        'account': {
            'doc': 'https://www.virtool.ca/docs/developer/api/account',
            'url': '/api/account'
        },
        'analyses': {
            'doc': 'https://www.virtool.ca/docs/developer/api/analyses',
            'url': '/api/analyses'
        },
        'genbank': {
            'doc': 'https://www.virtool.ca/docs/developer/api/genbank',
            'url': '/api/genbank'
        },
        'groups': {
            'doc': 'https://www.virtool.ca/docs/developer/api/groups',
            'url': '/api/groups'
        },
        'history': {
            'doc': 'https://www.virtool.ca/docs/developer/api/history',
            'url': '/api/history'
        },
        'hmm': {
            'doc': 'https://www.virtool.ca/docs/developer/api/hmm',
            'url': '/api/hmm'
        },
        'indexes': {
            'doc': 'https://www.virtool.ca/docs/developer/api/indexes',
            'url': '/api/indexes'
        },
        'jobs': {
            'doc': 'https://www.virtool.ca/docs/developer/api/jobs',
            'url': '/api/jobs'
        },
        'otus': {
            'doc': 'https://www.virtool.ca/docs/developer/api/otus',
            'url': '/api/otus'
        },
        'references': {
            'doc': 'https://www.virtool.ca/docs/developer/api/refs',
            'url': '/api/references'
        },
        'samples': {
            'doc': 'https://www.virtool.ca/docs/developer/api/samples',
            'url': '/api/samples'
        },
        'settings': {
            'doc': 'https://www.virtool.ca/docs/developer/api/settings',
            'url': '/api/settings'
        },
        'subtraction': {
            'doc': 'https://www.virtool.ca/docs/developer/api/subtraction',
            'url': '/api/subtraction'
        },
        'tasks': {
            'doc': 'https://www.virtool.ca/docs/developer/api/tasks',
            'url': '/api/tasks'
        },
        'users': {
            'doc': 'https://www.virtool.ca/docs/developer/api/users',
            'url': '/api/users'
        }
    },
    'version': 'v0.0.0'
}
