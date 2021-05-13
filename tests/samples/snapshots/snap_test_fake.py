# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import GenericRepr, Snapshot


snapshots = Snapshot()

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

snapshots['test_create_fake_samples[uvloop] 1'] = {
    '_id': 'sample_unpaired_finalized',
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
    'name': 'Fake SAMPLE_UNPAIRED_FINALIZED',
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
            'download_url': '/api/samples/sample_unpaired_finalized/reads/reads_1.fq.gz',
            'id': 1,
            'name': 'reads_1.fq.gz',
            'name_on_disk': 'reads_1.fq.gz',
            'sample': 'sample_unpaired_finalized',
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

snapshots['test_create_fake_samples[uvloop] 2'] = {
    '_id': 'sample_paired_finalized',
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
    'name': 'Fake SAMPLE_PAIRED_FINALIZED',
    'notes': 'Have wonder already against.',
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
                31,
                31,
                31
            ],
            [
                32,
                32,
                32,
                31,
                31
            ],
            [
                32,
                31,
                31,
                32,
                31
            ],
            [
                32,
                32,
                32,
                31,
                31
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
                82,
                58,
                1,
                1
            ],
            [
                49,
                91,
                1,
                1
            ],
            [
                87,
                73,
                1,
                1
            ],
            [
                54,
                5,
                52,
                1
            ],
            [
                90,
                73,
                1,
                1
            ]
        ],
        'count': 2917784004,
        'encoding': '''Sanger / Illumina 1.9
''',
        'gc': 79,
        'group_read': False,
        'group_write': False,
        'hold': True,
        'length': [
            79,
            64
        ],
        'paired': True,
        'sequences': [
            2864,
            7727,
            9324,
            5851,
            4111,
            9184,
            7503,
            5503,
            8918,
            2209,
            7894,
            9996,
            5885,
            5083,
            6789,
            24,
            5478,
            3922
        ]
    },
    'reads': [
        {
            'download_url': '/api/samples/sample_paired_finalized/reads/reads_1.fq.gz',
            'id': 2,
            'name': 'reads_1.fq.gz',
            'name_on_disk': 'reads_1.fq.gz',
            'sample': 'sample_paired_finalized',
            'size': 35441105,
            'upload': None,
            'uploaded_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
        },
        {
            'download_url': '/api/samples/sample_paired_finalized/reads/reads_2.fq.gz',
            'id': 3,
            'name': 'reads_2.fq.gz',
            'name_on_disk': 'reads_2.fq.gz',
            'sample': 'sample_paired_finalized',
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

snapshots['test_create_fake_samples[uvloop] 3'] = {
    '_id': 'sample_unpaired',
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
    'name': 'Fake SAMPLE_UNPAIRED',
    'notes': 'Land those traditional page. This manager fine.',
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

snapshots['test_create_fake_samples[uvloop] 4'] = {
    '_id': 'sample_paired',
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
    'name': 'Fake SAMPLE_PAIRED',
    'notes': 'Would I question first.',
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
