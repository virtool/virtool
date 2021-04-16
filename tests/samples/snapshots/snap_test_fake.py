# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import GenericRepr, Snapshot


snapshots = Snapshot()

snapshots['test_create_fake_unpaired[uvloop-False-True] 1'] = {
    '_id': '2x6YnyMt',
    'all_read': True,
    'all_write': True,
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'format': 'fastq',
    'group': 'blood',
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
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'format': 'fastq',
    'group': 'blood',
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
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'format': 'fastq',
    'group': 'blood',
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
    'name': 'cause believe',
    'notes': 'Would mouth relate own chair.',
    'nuvs': False,
    'paired': False,
    'pathoscope': False,
    'quality': {
        'all_read': True,
        'all_write': False,
        'bases': [
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
            ],
            [
                31,
                31,
                31,
                32,
                31
            ],
            [
                31,
                32,
                32,
                31,
                32
            ]
        ],
        'composition': [
            [
                48,
                15,
                5,
                78
            ],
            [
                3,
                25,
                24,
                92
            ],
            [
                16,
                62,
                27,
                1
            ],
            [
                94,
                8,
                1,
                1
            ]
        ],
        'count': 5814499479,
        'encoding': '''Sanger / Illumina 1.9
''',
        'gc': 81,
        'group_read': True,
        'group_write': False,
        'hold': False,
        'length': [
            50,
            88
        ],
        'paired': False,
        'sequences': [
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
            1018,
            2397,
            741,
            437,
            3088,
            6409
        ]
    },
    'reads': [
        {
            'id': 1,
            'name': 'read_1.fq.gz',
            'name_on_disk': 'paired_1.fq.gz',
            'sample': '2x6YnyMt',
            'size': 35441105,
            'upload': None,
            'uploaded_at': None
        },
        {
            'id': 2,
            'name': 'read_2.fq.gz',
            'name_on_disk': 'paired_2.fq.gz',
            'sample': '2x6YnyMt',
            'size': 41550519,
            'upload': None,
            'uploaded_at': None
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
    '_id': 'LB1U6zCj',
    'all_read': True,
    'all_write': True,
    'artifacts': [
    ],
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'format': 'fastq',
    'group': 'range',
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
    'name': 'whom around',
    'notes': 'Suddenly garden economy others.',
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
                32,
                31
            ],
            [
                32,
                31,
                31,
                32,
                32
            ],
            [
                32,
                32,
                31,
                32,
                32
            ],
            [
                32,
                31,
                31,
                31,
                32
            ],
            [
                31,
                31,
                31,
                32,
                32
            ]
        ],
        'composition': [
            [
                92,
                83,
                1,
                1
            ],
            [
                59,
                82,
                1,
                1
            ],
            [
                56,
                48,
                1,
                1
            ],
            [
                69,
                23,
                27,
                1
            ],
            [
                49,
                76,
                1,
                1
            ],
            [
                38,
                2,
                18,
                20
            ],
            [
                35,
                43,
                44,
                1
            ]
        ],
        'count': 5828932087,
        'encoding': '''Sanger / Illumina 1.9
''',
        'gc': 19,
        'group_read': False,
        'group_write': True,
        'hold': True,
        'length': [
            94,
            42
        ],
        'paired': True,
        'sequences': [
            516,
            9297,
            766,
            7296,
            4247,
            7313,
            9198,
            637,
            5340,
            7649,
            6801,
            8987,
            2138,
            6583,
            5180,
            3498,
            38,
            3120,
            9967,
            4954,
            2985,
            7792,
            1332,
            4500,
            1896,
            2185,
            1885,
            4561,
            693,
            3370,
            9148,
            6011,
            9954
        ]
    },
    'reads': [
        {
            'id': 3,
            'name': 'reads.fq.gz',
            'name_on_disk': 'single.fq.gz',
            'sample': 'LB1U6zCj',
            'size': 16700094,
            'upload': None,
            'uploaded_at': None
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
    '_id': 'H2YIEEsB',
    'all_read': True,
    'all_write': True,
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'format': 'fastq',
    'group': 'clearly',
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
    'name': 'structure federal',
    'notes': 'Between training listen subject.',
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

snapshots['test_create_fake_unpaired[uvloop-True-True] 1'] = {
    '_id': '2x6YnyMt',
    'all_read': True,
    'all_write': True,
    'artifacts': [
    ],
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'format': 'fastq',
    'group': 'blood',
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
    'name': 'cause believe',
    'notes': 'Would mouth relate own chair.',
    'nuvs': False,
    'paired': False,
    'pathoscope': False,
    'quality': {
        'all_read': True,
        'all_write': False,
        'bases': [
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
            ],
            [
                31,
                31,
                31,
                32,
                31
            ],
            [
                31,
                32,
                32,
                31,
                32
            ]
        ],
        'composition': [
            [
                48,
                15,
                5,
                78
            ],
            [
                3,
                25,
                24,
                92
            ],
            [
                16,
                62,
                27,
                1
            ],
            [
                94,
                8,
                1,
                1
            ]
        ],
        'count': 5814499479,
        'encoding': '''Sanger / Illumina 1.9
''',
        'gc': 81,
        'group_read': True,
        'group_write': False,
        'hold': False,
        'length': [
            50,
            88
        ],
        'paired': False,
        'sequences': [
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
            1018,
            2397,
            741,
            437,
            3088,
            6409
        ]
    },
    'reads': [
        {
            'id': 1,
            'name': 'read_1.fq.gz',
            'name_on_disk': 'paired_1.fq.gz',
            'sample': '2x6YnyMt',
            'size': 35441105,
            'upload': None,
            'uploaded_at': None
        },
        {
            'id': 2,
            'name': 'read_2.fq.gz',
            'name_on_disk': 'paired_2.fq.gz',
            'sample': '2x6YnyMt',
            'size': 41550519,
            'upload': None,
            'uploaded_at': None
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
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'format': 'fastq',
    'group': 'blood',
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
    'name': 'cause believe',
    'notes': 'Would mouth relate own chair.',
    'nuvs': False,
    'paired': False,
    'pathoscope': False,
    'quality': {
        'all_read': True,
        'all_write': False,
        'bases': [
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
            ],
            [
                31,
                31,
                31,
                32,
                31
            ],
            [
                31,
                32,
                32,
                31,
                32
            ]
        ],
        'composition': [
            [
                48,
                15,
                5,
                78
            ],
            [
                3,
                25,
                24,
                92
            ],
            [
                16,
                62,
                27,
                1
            ],
            [
                94,
                8,
                1,
                1
            ]
        ],
        'count': 5814499479,
        'encoding': '''Sanger / Illumina 1.9
''',
        'gc': 81,
        'group_read': True,
        'group_write': False,
        'hold': False,
        'length': [
            50,
            88
        ],
        'paired': False,
        'sequences': [
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
            1018,
            2397,
            741,
            437,
            3088,
            6409
        ]
    },
    'reads': [
        {
            'id': 1,
            'name': 'reads.fq.gz',
            'name_on_disk': 'single.fq.gz',
            'sample': '2x6YnyMt',
            'size': 16700094,
            'upload': None,
            'uploaded_at': None
        }
    ],
    'ready': True,
    'subtractions': [
    ],
    'user': {
        'id': 'bob'
    }
}
