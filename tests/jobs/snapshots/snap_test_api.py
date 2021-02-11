# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['test_acquire[uvloop] 1'] = {
    'acquired': True,
    'args': {
        'analysis_id': 'e410429b',
        'index_id': '465428b0',
        'name': None,
        'sample_id': '1e01a382',
        'username': 'igboyes',
        'workflow': 'nuvs'
    },
    'id': '4c530449',
    'key': 'bar',
    'mem': 16,
    'proc': 10,
    'status': [
        {
            'error': None,
            'progress': 0,
            'stage': None,
            'state': 'waiting',
            'timestamp': '2015-10-06T20:00:00Z'
        },
        {
            'error': None,
            'progress': 0,
            'stage': None,
            'state': 'running',
            'timestamp': '2015-10-06T20:00:00Z'
        },
        {
            'error': None,
            'progress': 0.091,
            'stage': 'mk_analysis_dir',
            'state': 'running',
            'timestamp': '2015-10-06T20:00:00Z'
        },
        {
            'error': None,
            'progress': 1.0,
            'stage': 'import_results',
            'state': 'complete',
            'timestamp': '2015-10-06T20:00:00Z'
        }
    ],
    'task': 'build_index',
    'user': {
        'id': 'igboyes'
    }
}

snapshots['test_get[uvloop-None] 1'] = {
    'acquired': False,
    'args': {
        'analysis_id': 'e410429b',
        'index_id': '465428b0',
        'name': None,
        'sample_id': '1e01a382',
        'username': 'igboyes',
        'workflow': 'nuvs'
    },
    'id': '4c530449',
    'mem': 16,
    'proc': 10,
    'status': [
        {
            'error': None,
            'progress': 0,
            'stage': None,
            'state': 'waiting',
            'timestamp': '2015-10-06T20:00:00Z'
        },
        {
            'error': None,
            'progress': 0,
            'stage': None,
            'state': 'running',
            'timestamp': '2015-10-06T20:00:00Z'
        },
        {
            'error': None,
            'progress': 0.091,
            'stage': 'mk_analysis_dir',
            'state': 'running',
            'timestamp': '2015-10-06T20:00:00Z'
        },
        {
            'error': None,
            'progress': 1.0,
            'stage': 'import_results',
            'state': 'complete',
            'timestamp': '2015-10-06T20:00:00Z'
        }
    ],
    'task': 'build_index',
    'user': {
        'id': 'igboyes'
    }
}

snapshots['test_cancel[uvloop] 1'] = {
    'acquired': False,
    'args': {
        'analysis_id': 'e410429b',
        'index_id': '465428b0',
        'name': None,
        'sample_id': '1e01a382',
        'username': 'igboyes',
        'workflow': 'nuvs'
    },
    'id': '4c530449',
    'mem': 16,
    'proc': 10,
    'state': 'cancelling',
    'status': [
        {
            'error': None,
            'progress': 0,
            'stage': None,
            'state': 'waiting',
            'timestamp': '2015-10-06T20:00:00Z'
        },
        {
            'error': None,
            'progress': 0,
            'stage': None,
            'state': 'running',
            'timestamp': '2015-10-06T20:00:00Z'
        },
        {
            'error': None,
            'progress': 0.091,
            'stage': 'mk_analysis_dir',
            'state': 'running',
            'timestamp': '2015-10-06T20:00:00Z'
        }
    ],
    'task': 'build_index',
    'user': {
        'id': 'igboyes'
    }
}

snapshots['test_acquire[uvloop-None] 1'] = {
    'acquired': True,
    'args': {
        'analysis_id': 'e410429b',
        'index_id': '465428b0',
        'name': None,
        'sample_id': '1e01a382',
        'username': 'igboyes',
        'workflow': 'nuvs'
    },
    'id': '4c530449',
    'key': 'bar',
    'mem': 16,
    'proc': 10,
    'status': [
        {
            'error': None,
            'progress': 0,
            'stage': None,
            'state': 'waiting',
            'timestamp': '2015-10-06T20:00:00Z'
        },
        {
            'error': None,
            'progress': 0,
            'stage': None,
            'state': 'running',
            'timestamp': '2015-10-06T20:00:00Z'
        },
        {
            'error': None,
            'progress': 0.091,
            'stage': 'mk_analysis_dir',
            'state': 'running',
            'timestamp': '2015-10-06T20:00:00Z'
        },
        {
            'error': None,
            'progress': 1.0,
            'stage': 'import_results',
            'state': 'complete',
            'timestamp': '2015-10-06T20:00:00Z'
        }
    ],
    'task': 'build_index',
    'user': {
        'id': 'igboyes'
    }
}
