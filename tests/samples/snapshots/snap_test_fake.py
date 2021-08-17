# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import GenericRepr, Snapshot


snapshots = Snapshot()

snapshots['test_create_fake_unpaired[uvloop-False-False] 1'] = {
    '_id': 'sample_1',
    'all_read': True,
    'all_write': True,
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'format': 'fastq',
    'group': 'none',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'host': 'Vine',
    'is_legacy': False,
    'isolate': 'Isolate A1',
    'labels': [
    ],
    'library_type': 'normal',
    'locale': '',
    'name': 'Fake SAMPLE_1',
    'notes': 'Serious inside else memory if six.',
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

snapshots['test_create_fake_unpaired[uvloop-False-True] 1'] = {
    '_id': 'sample_1',
    'all_read': True,
    'all_write': True,
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'format': 'fastq',
    'group': 'none',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'host': 'Vine',
    'is_legacy': False,
    'isolate': 'Isolate A1',
    'labels': [
    ],
    'library_type': 'normal',
    'locale': '',
    'name': 'Fake SAMPLE_1',
    'notes': 'Serious inside else memory if six.',
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

snapshots['test_create_fake_unpaired[uvloop-True-False] 1'] = {
    '_id': 'sample_1',
    'all_read': True,
    'all_write': True,
    'artifacts': [
    ],
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'format': 'fastq',
    'group': 'none',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'host': 'Vine',
    'is_legacy': False,
    'isolate': 'Isolate A1',
    'labels': [
    ],
    'library_type': 'normal',
    'locale': '',
    'name': 'Fake SAMPLE_1',
    'notes': 'Serious inside else memory if six.',
    'nuvs': False,
    'paired': False,
    'pathoscope': False,
    'quality': {
        'all_read': False,
        'all_write': False,
        'bases': [
            [
                31,
                32,
                31,
                31,
                32
            ],
            [
                32,
                31,
                32,
                32,
                32
            ],
            [
                31,
                32,
                32,
                32,
                31
            ],
            [
                31,
                31,
                32,
                31,
                32
            ],
            [
                32,
                31,
                32,
                31,
                31
            ]
        ],
        'composition': [
            [
                19,
                90,
                1,
                1
            ],
            [
                29,
                6,
                74,
                1
            ],
            [
                82,
                69,
                1,
                1
            ],
            [
                78,
                88,
                1,
                1
            ]
        ],
        'count': 8997239604,
        'encoding': '''Sanger / Illumina 1.9
''',
        'gc': 90,
        'group_read': False,
        'group_write': False,
        'hold': False,
        'length': [
            42,
            78
        ],
        'paired': True,
        'sequences': [
            3909,
            8896,
            1494,
            5243,
            1786,
            9031,
            2044,
            8852,
            9882,
            7290,
            9769,
            5194,
            4756,
            3102,
            540,
            7807,
            1471,
            2450,
            1314,
            8594,
            8549,
            3525,
            9497,
            7382,
            5855,
            5313,
            7969,
            3119,
            265,
            1919,
            6095,
            5448,
            1018
        ]
    },
    'reads': [
        {
            'download_url': '/api/samples/sample_1/reads/reads_1.fq.gz',
            'id': 1,
            'name': 'reads_1.fq.gz',
            'name_on_disk': 'reads_1.fq.gz',
            'sample': 'sample_1',
            'size': 16700094,
            'upload': None,
            'uploaded_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
        }
    ],
    'ready': True,
    'subtractions': [
    ],
    'user': {
        'id': 'bob'
    }
}

snapshots['test_create_fake_unpaired[uvloop-True-True] 1'] = {
    '_id': 'sample_1',
    'all_read': True,
    'all_write': True,
    'artifacts': [
    ],
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'format': 'fastq',
    'group': 'none',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'host': 'Vine',
    'is_legacy': False,
    'isolate': 'Isolate A1',
    'labels': [
    ],
    'library_type': 'normal',
    'locale': '',
    'name': 'Fake SAMPLE_1',
    'notes': 'Serious inside else memory if six.',
    'nuvs': False,
    'paired': False,
    'pathoscope': False,
    'quality': {
        'all_read': False,
        'all_write': False,
        'bases': [
            [
                31,
                32,
                31,
                31,
                32
            ],
            [
                32,
                31,
                32,
                32,
                32
            ],
            [
                31,
                32,
                32,
                32,
                31
            ],
            [
                31,
                31,
                32,
                31,
                32
            ],
            [
                32,
                31,
                32,
                31,
                31
            ]
        ],
        'composition': [
            [
                19,
                90,
                1,
                1
            ],
            [
                29,
                6,
                74,
                1
            ],
            [
                82,
                69,
                1,
                1
            ],
            [
                78,
                88,
                1,
                1
            ]
        ],
        'count': 8997239604,
        'encoding': '''Sanger / Illumina 1.9
''',
        'gc': 90,
        'group_read': False,
        'group_write': False,
        'hold': False,
        'length': [
            42,
            78
        ],
        'paired': True,
        'sequences': [
            3909,
            8896,
            1494,
            5243,
            1786,
            9031,
            2044,
            8852,
            9882,
            7290,
            9769,
            5194,
            4756,
            3102,
            540,
            7807,
            1471,
            2450,
            1314,
            8594,
            8549,
            3525,
            9497,
            7382,
            5855,
            5313,
            7969,
            3119,
            265,
            1919,
            6095,
            5448,
            1018
        ]
    },
    'reads': [
        {
            'download_url': '/api/samples/sample_1/reads/reads_1.fq.gz',
            'id': 1,
            'name': 'reads_1.fq.gz',
            'name_on_disk': 'reads_1.fq.gz',
            'sample': 'sample_1',
            'size': 35441105,
            'upload': None,
            'uploaded_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
        },
        {
            'download_url': '/api/samples/sample_1/reads/reads_2.fq.gz',
            'id': 2,
            'name': 'reads_2.fq.gz',
            'name_on_disk': 'reads_2.fq.gz',
            'sample': 'sample_1',
            'size': 41550519,
            'upload': None,
            'uploaded_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
        }
    ],
    'ready': True,
    'subtractions': [
    ],
    'user': {
        'id': 'bob'
    }
}
