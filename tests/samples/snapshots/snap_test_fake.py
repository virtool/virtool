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
    'group': 'while',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'host': 'Vine',
    'is_legacy': False,
    'isolate': 'Isolate A1',
    'labels': [
        'beyond',
        'its',
        'particularly'
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
    'group': 'while',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'host': 'Vine',
    'is_legacy': False,
    'isolate': 'Isolate A1',
    'labels': [
        'beyond',
        'its',
        'particularly'
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
    'group': 'while',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'host': 'Vine',
    'is_legacy': False,
    'isolate': 'Isolate A1',
    'labels': [
        'beyond',
        'its',
        'particularly'
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
        'all_write': True,
        'bases': [
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
            ],
            [
                31,
                31,
                32,
                32,
                31
            ],
            [
                32,
                32,
                31,
                32,
                31
            ]
        ],
        'composition': [
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
            ]
        ],
        'count': 6668048404,
        'encoding': '''Sanger / Illumina 1.9
''',
        'gc': 33,
        'group_read': True,
        'group_write': False,
        'hold': True,
        'length': [
            66,
            76
        ],
        'paired': False,
        'sequences': [
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
            596,
            3188,
            2029,
            3450
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
    'group': 'while',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'host': 'Vine',
    'is_legacy': False,
    'isolate': 'Isolate A1',
    'labels': [
        'beyond',
        'its',
        'particularly'
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
        'all_write': True,
        'bases': [
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
            ],
            [
                31,
                31,
                32,
                32,
                31
            ],
            [
                32,
                32,
                31,
                32,
                31
            ]
        ],
        'composition': [
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
            ]
        ],
        'count': 6668048404,
        'encoding': '''Sanger / Illumina 1.9
''',
        'gc': 33,
        'group_read': True,
        'group_write': False,
        'hold': True,
        'length': [
            66,
            76
        ],
        'paired': False,
        'sequences': [
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
            596,
            3188,
            2029,
            3450
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
    'group': 'while',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'host': 'Vine',
    'is_legacy': False,
    'isolate': 'Isolate A1',
    'labels': [
        'beyond',
        'its',
        'particularly'
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
        'all_write': True,
        'bases': [
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
            ],
            [
                31,
                31,
                32,
                32,
                31
            ],
            [
                32,
                32,
                31,
                32,
                31
            ]
        ],
        'composition': [
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
            ]
        ],
        'count': 6668048404,
        'encoding': '''Sanger / Illumina 1.9
''',
        'gc': 33,
        'group_read': True,
        'group_write': False,
        'hold': True,
        'length': [
            66,
            76
        ],
        'paired': False,
        'sequences': [
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
            596,
            3188,
            2029,
            3450
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
    '_id': '9CDjpwAf',
    'all_read': True,
    'all_write': True,
    'artifacts': [
    ],
    'files': [
        {
            'id': 3,
            'name': 'reads.fq.gz',
            'name_on_disk': 'single.fq.gz',
            'sample': '9CDjpwAf',
            'size': 16700094,
            'upload': None
        }
    ],
    'format': 'fastq',
    'group': 'sound',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'host': 'Vine',
    'is_legacy': False,
    'isolate': 'Isolate A1',
    'labels': [
        'school',
        'name',
        'care'
    ],
    'library_type': 'normal',
    'locale': '',
    'name': 'morning bring',
    'notes': 'Program actually race tonight themselves true.',
    'nuvs': False,
    'paired': False,
    'pathoscope': False,
    'quality': {
        'all_read': True,
        'all_write': False,
        'bases': [
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
                31,
                31,
                32,
                32,
                32
            ],
            [
                31,
                32,
                32,
                31,
                31
            ],
            [
                32,
                31,
                32,
                31,
                32
            ]
        ],
        'composition': [
            [
                2,
                18,
                20,
                35
            ],
            [
                43,
                44,
                48,
                1
            ],
            [
                92,
                12,
                1,
                1
            ],
            [
                44,
                80,
                1,
                1
            ],
            [
                5,
                6,
                35,
                21
            ],
            [
                20,
                75,
                38,
                1
            ]
        ],
        'count': 8388636647,
        'encoding': '''Sanger / Illumina 1.9
''',
        'gc': 36,
        'group_read': True,
        'group_write': False,
        'hold': True,
        'length': [
            55,
            88
        ],
        'paired': True,
        'sequences': [
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
            9954,
            7514,
            6102,
            3405,
            9619
        ]
    },
    'reads': [
        {
            'id': 3,
            'name': 'reads.fq.gz',
            'name_on_disk': 'single.fq.gz',
            'sample': '9CDjpwAf',
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
    '_id': 'B34OKB6j',
    'all_read': True,
    'all_write': True,
    'files': [
    ],
    'format': 'fastq',
    'group': 'list',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'host': 'Vine',
    'is_legacy': False,
    'isolate': 'Isolate A1',
    'labels': [
        'account',
        'hour',
        'million'
    ],
    'library_type': 'normal',
    'locale': '',
    'name': 'look record',
    'notes': 'Also friend reach choose coach north.',
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
