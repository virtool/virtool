# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import GenericRepr, Snapshot


snapshots = Snapshot()

snapshots['test_create_fake_unpaired[uvloop-True-True] 1'] = {
    '_id': '2x6YnyMt',
    'all_read': True,
    'all_write': True,
    'artifacts': [
    ],
    'files': [
        {
            'id': 1,
            'name': 'read_1.fq.gz',
            'name_on_disk': 'paired_1.fq.gz',
            'sample': '2x6YnyMt',
            'size': 35441105,
            'upload': None
        },
        {
            'id': 2,
            'name': 'read_2.fq.gz',
            'name_on_disk': 'paired_2.fq.gz',
            'sample': '2x6YnyMt',
            'size': 41550519,
            'upload': None
        }
    ],
    'format': 'fastq',
    'group': 'four',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'host': 'Vine',
    'is_legacy': False,
    'isolate': 'Isolate A1',
    'labels': [
        'blood',
        'health',
        'leader'
    ],
    'library_type': 'normal',
    'locale': '',
    'name': 'cause believe',
    'notes': 'Would mouth relate own chair.',
    'nuvs': False,
    'paired': True,
    'pathoscope': False,
    'quality': {
    },
    'reads': [
        {
            'id': 1,
            'name': 'read_1.fq.gz',
            'name_on_disk': 'paired_1.fq.gz',
            'sample': '2x6YnyMt',
            'size': 35441105,
            'upload': None
        },
        {
            'id': 2,
            'name': 'read_2.fq.gz',
            'name_on_disk': 'paired_2.fq.gz',
            'sample': '2x6YnyMt',
            'size': 41550519,
            'upload': None
        }
    ],
    'ready': True,
    'subtractions': [
    ],
    'user': {
        'id': 'bob'
    }
}

snapshots['test_create_fake_unpaired[uvloop-True-False] 1'] = {
    '_id': '2x6YnyMt',
    'all_read': True,
    'all_write': True,
    'artifacts': [
    ],
    'files': [
        {
            'id': 1,
            'name': 'reads.fq.gz',
            'name_on_disk': 'single.fq.gz',
            'sample': '2x6YnyMt',
            'size': 16700094,
            'upload': None
        }
    ],
    'format': 'fastq',
    'group': 'four',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'host': 'Vine',
    'is_legacy': False,
    'isolate': 'Isolate A1',
    'labels': [
        'blood',
        'health',
        'leader'
    ],
    'library_type': 'normal',
    'locale': '',
    'name': 'cause believe',
    'notes': 'Would mouth relate own chair.',
    'nuvs': False,
    'paired': False,
    'pathoscope': False,
    'quality': {
    },
    'reads': [
        {
            'id': 1,
            'name': 'reads.fq.gz',
            'name_on_disk': 'single.fq.gz',
            'sample': '2x6YnyMt',
            'size': 16700094,
            'upload': None
        }
    ],
    'ready': True,
    'subtractions': [
    ],
    'user': {
        'id': 'bob'
    }
}

snapshots['test_create_fake_unpaired[uvloop-False-True] 1'] = {
    '_id': '2x6YnyMt',
    'all_read': True,
    'all_write': True,
    'files': [
    ],
    'format': 'fastq',
    'group': 'four',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'host': 'Vine',
    'is_legacy': False,
    'isolate': 'Isolate A1',
    'labels': [
        'blood',
        'health',
        'leader'
    ],
    'library_type': 'normal',
    'locale': '',
    'name': 'cause believe',
    'notes': 'Would mouth relate own chair.',
    'nuvs': False,
    'paired': False,
    'pathoscope': False,
    'quality': None,
    'ready': False,
    'subtractions': [
    ],
    'user': {
        'id': 'bob'
    }
}

snapshots['test_create_fake_unpaired[uvloop-False-False] 1'] = {
    '_id': '2x6YnyMt',
    'all_read': True,
    'all_write': True,
    'files': [
    ],
    'format': 'fastq',
    'group': 'four',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'host': 'Vine',
    'is_legacy': False,
    'isolate': 'Isolate A1',
    'labels': [
        'blood',
        'health',
        'leader'
    ],
    'library_type': 'normal',
    'locale': '',
    'name': 'cause believe',
    'notes': 'Would mouth relate own chair.',
    'nuvs': False,
    'paired': False,
    'pathoscope': False,
    'quality': None,
    'ready': False,
    'subtractions': [
    ],
    'user': {
        'id': 'bob'
    }
}

snapshots['test_create_fake_samples[uvloop] 1'] = {
    '_id': '2x6YnyMt',
    'all_read': True,
    'all_write': True,
    'artifacts': [
    ],
    'files': [
        {
            'id': 1,
            'name': 'read_1.fq.gz',
            'name_on_disk': 'paired_1.fq.gz',
            'sample': '2x6YnyMt',
            'size': 35441105,
            'upload': None
        },
        {
            'id': 2,
            'name': 'read_2.fq.gz',
            'name_on_disk': 'paired_2.fq.gz',
            'sample': '2x6YnyMt',
            'size': 41550519,
            'upload': None
        }
    ],
    'format': 'fastq',
    'group': 'four',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'host': 'Vine',
    'is_legacy': False,
    'isolate': 'Isolate A1',
    'labels': [
        'blood',
        'health',
        'leader'
    ],
    'library_type': 'normal',
    'locale': '',
    'name': 'cause believe',
    'notes': 'Would mouth relate own chair.',
    'nuvs': False,
    'paired': True,
    'pathoscope': False,
    'quality': {
    },
    'reads': [
        {
            'id': 1,
            'name': 'read_1.fq.gz',
            'name_on_disk': 'paired_1.fq.gz',
            'sample': '2x6YnyMt',
            'size': 35441105,
            'upload': None
        },
        {
            'id': 2,
            'name': 'read_2.fq.gz',
            'name_on_disk': 'paired_2.fq.gz',
            'sample': '2x6YnyMt',
            'size': 41550519,
            'upload': None
        }
    ],
    'ready': True,
    'subtractions': [
    ],
    'user': {
        'id': 'bob'
    }
}

snapshots['test_create_fake_samples[uvloop] 2'] = {
    '_id': '9TrGnYUg',
    'all_read': True,
    'all_write': True,
    'artifacts': [
    ],
    'files': [
        {
            'id': 3,
            'name': 'reads.fq.gz',
            'name_on_disk': 'single.fq.gz',
            'sample': '9TrGnYUg',
            'size': 16700094,
            'upload': None
        }
    ],
    'format': 'fastq',
    'group': 'go',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'host': 'Vine',
    'is_legacy': False,
    'isolate': 'Isolate A1',
    'labels': [
        'seat',
        'capital',
        'officer'
    ],
    'library_type': 'normal',
    'locale': '',
    'name': 'stock four',
    'notes': 'Region as true develop sound central.',
    'nuvs': False,
    'paired': False,
    'pathoscope': False,
    'quality': {
    },
    'reads': [
        {
            'id': 3,
            'name': 'reads.fq.gz',
            'name_on_disk': 'single.fq.gz',
            'sample': '9TrGnYUg',
            'size': 16700094,
            'upload': None
        }
    ],
    'ready': True,
    'subtractions': [
    ],
    'user': {
        'id': 'bob'
    }
}

snapshots['test_create_fake_samples[uvloop] 3'] = {
    '_id': '8aGazZIB',
    'all_read': True,
    'all_write': True,
    'files': [
    ],
    'format': 'fastq',
    'group': 'face',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'host': 'Vine',
    'is_legacy': False,
    'isolate': 'Isolate A1',
    'labels': [
        'that',
        'kind',
        'particularly'
    ],
    'library_type': 'normal',
    'locale': '',
    'name': 'live bed',
    'notes': 'Theory type successful together.',
    'nuvs': False,
    'paired': False,
    'pathoscope': False,
    'quality': None,
    'ready': False,
    'subtractions': [
    ],
    'user': {
        'id': 'bob'
    }
}
