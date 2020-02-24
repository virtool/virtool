# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import GenericRepr, Snapshot


snapshots = Snapshot()

snapshots['test_create_duplicate return'] = {
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'files': [
    ],
    'hash': '68b60be51a667882d3aaa02a93259dd526e9c990',
    'id': 'u3cuwaoq',
    'legacy': False,
    'missing': False,
    'paired': False,
    'parameters': {
        'end_quality': '20',
        'max_error_rate': '0.1',
        'max_indel_rate': '0.03',
        'max_length': None,
        'mean_quality': '25',
        'min_length': '20',
        'mode': 'pe'
    },
    'program': 'skewer-0.2.2',
    'ready': False,
    'sample': {
        'id': 'foo'
    }
}

snapshots['test_create_duplicate db'] = {
    '_id': 'u3cuwaoq',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'files': [
    ],
    'hash': '68b60be51a667882d3aaa02a93259dd526e9c990',
    'legacy': False,
    'missing': False,
    'paired': False,
    'parameters': {
        'end_quality': '20',
        'max_error_rate': '0.1',
        'max_indel_rate': '0.03',
        'max_length': None,
        'mean_quality': '25',
        'min_length': '20',
        'mode': 'pe'
    },
    'program': 'skewer-0.2.2',
    'ready': False,
    'sample': {
        'id': 'foo'
    }
}

snapshots['test_create[paired] return'] = {
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'files': [
    ],
    'hash': '68b60be51a667882d3aaa02a93259dd526e9c990',
    'id': '9pfsom1b',
    'legacy': False,
    'missing': False,
    'paired': True,
    'parameters': {
        'end_quality': '20',
        'max_error_rate': '0.1',
        'max_indel_rate': '0.03',
        'max_length': None,
        'mean_quality': '25',
        'min_length': '20',
        'mode': 'pe'
    },
    'program': 'skewer-0.2.2',
    'ready': False,
    'sample': {
        'id': 'foo'
    }
}

snapshots['test_create[paired] db'] = {
    '_id': '9pfsom1b',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'files': [
    ],
    'hash': '68b60be51a667882d3aaa02a93259dd526e9c990',
    'legacy': False,
    'missing': False,
    'paired': True,
    'parameters': {
        'end_quality': '20',
        'max_error_rate': '0.1',
        'max_indel_rate': '0.03',
        'max_length': None,
        'mean_quality': '25',
        'min_length': '20',
        'mode': 'pe'
    },
    'program': 'skewer-0.2.2',
    'ready': False,
    'sample': {
        'id': 'foo'
    }
}

snapshots['test_create[unpaired] return'] = {
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'files': [
    ],
    'hash': '68b60be51a667882d3aaa02a93259dd526e9c990',
    'id': '9pfsom1b',
    'legacy': False,
    'missing': False,
    'paired': False,
    'parameters': {
        'end_quality': '20',
        'max_error_rate': '0.1',
        'max_indel_rate': '0.03',
        'max_length': None,
        'mean_quality': '25',
        'min_length': '20',
        'mode': 'pe'
    },
    'program': 'skewer-0.2.2',
    'ready': False,
    'sample': {
        'id': 'foo'
    }
}

snapshots['test_create[unpaired] db'] = {
    '_id': '9pfsom1b',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'files': [
    ],
    'hash': '68b60be51a667882d3aaa02a93259dd526e9c990',
    'legacy': False,
    'missing': False,
    'paired': False,
    'parameters': {
        'end_quality': '20',
        'max_error_rate': '0.1',
        'max_indel_rate': '0.03',
        'max_length': None,
        'mean_quality': '25',
        'min_length': '20',
        'mode': 'pe'
    },
    'program': 'skewer-0.2.2',
    'ready': False,
    'sample': {
        'id': 'foo'
    }
}

snapshots['test_create_legacy return'] = {
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'files': [
    ],
    'hash': '68b60be51a667882d3aaa02a93259dd526e9c990',
    'id': '9pfsom1b',
    'legacy': True,
    'missing': False,
    'paired': False,
    'parameters': {
        'end_quality': '20',
        'max_error_rate': '0.1',
        'max_indel_rate': '0.03',
        'max_length': None,
        'mean_quality': '25',
        'min_length': '20',
        'mode': 'pe'
    },
    'program': 'skewer-0.2.2',
    'ready': False,
    'sample': {
        'id': 'foo'
    }
}

snapshots['test_create_legacy db'] = {
    '_id': '9pfsom1b',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'files': [
    ],
    'hash': '68b60be51a667882d3aaa02a93259dd526e9c990',
    'legacy': True,
    'missing': False,
    'paired': False,
    'parameters': {
        'end_quality': '20',
        'max_error_rate': '0.1',
        'max_indel_rate': '0.03',
        'max_length': None,
        'mean_quality': '25',
        'min_length': '20',
        'mode': 'pe'
    },
    'program': 'skewer-0.2.2',
    'ready': False,
    'sample': {
        'id': 'foo'
    }
}

snapshots['test_create_program return'] = {
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'files': [
    ],
    'hash': '68b60be51a667882d3aaa02a93259dd526e9c990',
    'id': '9pfsom1b',
    'legacy': False,
    'missing': False,
    'paired': False,
    'parameters': {
        'end_quality': '20',
        'max_error_rate': '0.1',
        'max_indel_rate': '0.03',
        'max_length': None,
        'mean_quality': '25',
        'min_length': '20',
        'mode': 'pe'
    },
    'program': 'trimmomatic-0.2.3',
    'ready': False,
    'sample': {
        'id': 'foo'
    }
}

snapshots['test_create_program db'] = {
    '_id': '9pfsom1b',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'files': [
    ],
    'hash': '68b60be51a667882d3aaa02a93259dd526e9c990',
    'legacy': False,
    'missing': False,
    'paired': False,
    'parameters': {
        'end_quality': '20',
        'max_error_rate': '0.1',
        'max_indel_rate': '0.03',
        'max_length': None,
        'mean_quality': '25',
        'min_length': '20',
        'mode': 'pe'
    },
    'program': 'trimmomatic-0.2.3',
    'ready': False,
    'sample': {
        'id': 'foo'
    }
}
