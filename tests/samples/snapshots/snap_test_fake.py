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
    'group': 'enough',
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
    'name': 'such serious',
    'notes': 'American whole magazine truth stop whose.',
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
    'group': 'enough',
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
    'name': 'such serious',
    'notes': 'American whole magazine truth stop whose.',
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
    'group': 'enough',
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
    'name': 'such serious',
    'notes': 'American whole magazine truth stop whose.',
    'nuvs': False,
    'paired': False,
    'pathoscope': False,
    'quality': {
        'all_read': True,
        'all_write': True,
        'bases': [
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
                32,
                32,
                32
            ],
            [
                31,
                31,
                31,
                32,
                31
            ],
            [
                32,
                32,
                31,
                32,
                31
            ],
            [
                31,
                31,
                31,
                31,
                32
            ]
        ],
        'composition': [
            [
                67,
                31,
                28,
                1
            ],
            [
                87,
                76,
                1,
                1
            ],
            [
                54,
                75,
                1,
                1
            ],
            [
                36,
                58,
                64,
                1
            ],
            [
                85,
                83,
                1,
                1
            ],
            [
                90,
                46,
                1,
                1
            ]
        ],
        'count': 4926171705,
        'encoding': '''Sanger / Illumina 1.9
''',
        'gc': 87,
        'group_read': True,
        'group_write': False,
        'hold': False,
        'length': [
            22,
            19
        ],
        'paired': False,
        'sequences': [
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
            8594
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
    'group': 'painting',
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
    'name': 'drug rule',
    'notes': 'Relate head color international.',
    'nuvs': False,
    'paired': False,
    'pathoscope': False,
    'quality': {
        'all_read': True,
        'all_write': True,
        'bases': [
            [
                31,
                32,
                31,
                32,
                31
            ],
            [
                31,
                31,
                31,
                31,
                31
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
            ]
        ],
        'composition': [
            [
                58,
                9,
                34,
                1
            ],
            [
                90,
                21,
                1,
                1
            ],
            [
                58,
                68,
                1,
                1
            ],
            [
                63,
                72,
                1,
                1
            ],
            [
                78,
                97,
                1,
                1
            ]
        ],
        'count': 317824271,
        'encoding': '''Sanger / Illumina 1.9
''',
        'gc': 24,
        'group_read': False,
        'group_write': True,
        'hold': False,
        'length': [
            25,
            91
        ],
        'paired': True,
        'sequences': [
            645,
            6410,
            4262,
            7704,
            3332,
            2592,
            5608,
            1920,
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
            3922,
            7342,
            9308,
            516,
            9297,
            766
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
    'group': 'Republican',
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
    'name': 'anyone state',
    'notes': 'Could yourself plan base rise would.',
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
    'group': 'enough',
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
    'name': 'such serious',
    'notes': 'American whole magazine truth stop whose.',
    'nuvs': False,
    'paired': False,
    'pathoscope': False,
    'quality': {
        'all_read': True,
        'all_write': True,
        'bases': [
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
                32,
                32,
                32
            ],
            [
                31,
                31,
                31,
                32,
                31
            ],
            [
                32,
                32,
                31,
                32,
                31
            ],
            [
                31,
                31,
                31,
                31,
                32
            ]
        ],
        'composition': [
            [
                67,
                31,
                28,
                1
            ],
            [
                87,
                76,
                1,
                1
            ],
            [
                54,
                75,
                1,
                1
            ],
            [
                36,
                58,
                64,
                1
            ],
            [
                85,
                83,
                1,
                1
            ],
            [
                90,
                46,
                1,
                1
            ]
        ],
        'count': 4926171705,
        'encoding': '''Sanger / Illumina 1.9
''',
        'gc': 87,
        'group_read': True,
        'group_write': False,
        'hold': False,
        'length': [
            22,
            19
        ],
        'paired': False,
        'sequences': [
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
            8594
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
    'group': 'enough',
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
    'name': 'such serious',
    'notes': 'American whole magazine truth stop whose.',
    'nuvs': False,
    'paired': False,
    'pathoscope': False,
    'quality': {
        'all_read': True,
        'all_write': True,
        'bases': [
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
                32,
                32,
                32
            ],
            [
                31,
                31,
                31,
                32,
                31
            ],
            [
                32,
                32,
                31,
                32,
                31
            ],
            [
                31,
                31,
                31,
                31,
                32
            ]
        ],
        'composition': [
            [
                67,
                31,
                28,
                1
            ],
            [
                87,
                76,
                1,
                1
            ],
            [
                54,
                75,
                1,
                1
            ],
            [
                36,
                58,
                64,
                1
            ],
            [
                85,
                83,
                1,
                1
            ],
            [
                90,
                46,
                1,
                1
            ]
        ],
        'count': 4926171705,
        'encoding': '''Sanger / Illumina 1.9
''',
        'gc': 87,
        'group_read': True,
        'group_write': False,
        'hold': False,
        'length': [
            22,
            19
        ],
        'paired': False,
        'sequences': [
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
            8594
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
    'group': 'technology',
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
    'name': 'more best',
    'notes': 'Part cup few read. Beyond take however ball.',
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
