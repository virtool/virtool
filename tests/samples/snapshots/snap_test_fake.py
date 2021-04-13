# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

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
        'all_read': False,
        'all_write': False,
        'bases': [
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
                32,
                31,
                32
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
                32,
                32
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
            ],
            [
                87,
                3,
                70,
                1
            ],
            [
                55,
                80,
                1,
                1
            ],
            [
                13,
                34,
                9,
                29
            ],
            [
                10,
                83,
                39,
                1
            ],
            [
                45,
                56,
                1,
                1
            ]
        ],
        'count': 3921362636,
        'encoding': '''Sanger / Illumina 1.9
''',
        'gc': 56,
        'group_read': False,
        'group_write': True,
        'hold': False,
        'length': [
            80,
            71
        ],
        'paired': True,
        'sequences': [
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
            6409,
            6064,
            596
        ]
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
        'all_read': False,
        'all_write': False,
        'bases': [
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
                32,
                31,
                32
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
                32,
                32
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
            ],
            [
                87,
                3,
                70,
                1
            ],
            [
                55,
                80,
                1,
                1
            ],
            [
                13,
                34,
                9,
                29
            ],
            [
                10,
                83,
                39,
                1
            ],
            [
                45,
                56,
                1,
                1
            ]
        ],
        'count': 3921362636,
        'encoding': '''Sanger / Illumina 1.9
''',
        'gc': 56,
        'group_read': False,
        'group_write': True,
        'hold': False,
        'length': [
            80,
            71
        ],
        'paired': True,
        'sequences': [
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
            6409,
            6064,
            596
        ]
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
        'all_read': False,
        'all_write': False,
        'bases': [
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
                32,
                31,
                32
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
                32,
                32
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
            ],
            [
                87,
                3,
                70,
                1
            ],
            [
                55,
                80,
                1,
                1
            ],
            [
                13,
                34,
                9,
                29
            ],
            [
                10,
                83,
                39,
                1
            ],
            [
                45,
                56,
                1,
                1
            ]
        ],
        'count': 3921362636,
        'encoding': '''Sanger / Illumina 1.9
''',
        'gc': 56,
        'group_read': False,
        'group_write': True,
        'hold': False,
        'length': [
            80,
            71
        ],
        'paired': True,
        'sequences': [
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
            6409,
            6064,
            596
        ]
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
    '_id': 'uT3ZIllm',
    'all_read': True,
    'all_write': True,
    'artifacts': [
    ],
    'files': [
        {
            'id': 3,
            'name': 'reads.fq.gz',
            'name_on_disk': 'single.fq.gz',
            'sample': 'uT3ZIllm',
            'size': 16700094,
            'upload': None
        }
    ],
    'format': 'fastq',
    'group': 'government',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'host': 'Vine',
    'is_legacy': False,
    'isolate': 'Isolate A1',
    'labels': [
        'lot',
        'site',
        'bar'
    ],
    'library_type': 'normal',
    'locale': '',
    'name': 'bring TV',
    'notes': 'Actually race tonight themselves.',
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
                31
            ],
            [
                31,
                32,
                32,
                32,
                31
            ],
            [
                32,
                32,
                31,
                31,
                32
            ]
        ],
        'composition': [
            [
                61,
                51,
                1,
                1
            ],
            [
                81,
                11,
                3,
                36
            ],
            [
                58,
                15,
                33,
                1
            ],
            [
                18,
                84,
                1,
                1
            ]
        ],
        'count': 3174060074,
        'encoding': '''Sanger / Illumina 1.9
''',
        'gc': 17,
        'group_read': False,
        'group_write': False,
        'hold': True,
        'length': [
            79,
            45
        ],
        'paired': False,
        'sequences': [
            2583,
            8643,
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
            2985
        ]
    },
    'reads': [
        {
            'id': 3,
            'name': 'reads.fq.gz',
            'name_on_disk': 'single.fq.gz',
            'sample': 'uT3ZIllm',
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
    '_id': 'GJMZq0Gv',
    'all_read': True,
    'all_write': True,
    'files': [
    ],
    'format': 'fastq',
    'group': 'building',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'host': 'Vine',
    'is_legacy': False,
    'isolate': 'Isolate A1',
    'labels': [
        'official',
        'carry',
        'finally'
    ],
    'library_type': 'normal',
    'locale': '',
    'name': 'the condition',
    'notes': 'Onto across character four smile responsibility.',
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
