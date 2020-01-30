# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import GenericRepr, Snapshot


snapshots = Snapshot()

snapshots['test_find[uvloop] 1'] = [
    {
        'created_at': '2015-10-06T20:00:00Z',
        'description': 'Edited Prunus virus E',
        'id': '6116cba1.1',
        'index': {
            'id': 'unbuilt',
            'version': 'unbuilt'
        },
        'method_name': 'edit',
        'otu': {
            'id': '6116cba1',
            'name': 'Prunus virus F',
            'version': 1
        },
        'reference': {
            'id': 'hxn167'
        },
        'user': {
            'id': 'test'
        }
    },
    {
        'created_at': '2015-10-06T20:00:00Z',
        'description': 'Edited Prunus virus E',
        'id': 'foobar.1',
        'index': {
            'id': 'unbuilt',
            'version': 'unbuilt'
        },
        'method_name': 'edit',
        'otu': {
            'id': '6116cba1',
            'name': 'Prunus virus F',
            'version': 1
        },
        'reference': {
            'id': 'hxn167'
        },
        'user': {
            'id': 'test'
        }
    },
    {
        'created_at': '2015-10-06T20:00:00Z',
        'description': 'Edited Prunus virus E',
        'id': 'foobar.2',
        'index': {
            'id': 'unbuilt',
            'version': 'unbuilt'
        },
        'method_name': 'edit',
        'otu': {
            'id': '6116cba1',
            'name': 'Prunus virus F',
            'version': 1
        },
        'reference': {
            'id': 'hxn167'
        },
        'user': {
            'id': 'test'
        }
    }
]

snapshots['test_get[uvloop-None] json'] = {
    'created_at': '2015-10-06T20:00:00Z',
    'description': 'Edited Prunus virus E',
    'diff': [
        [
            'change',
            'abbreviation',
            [
                'PVF',
                ''
            ]
        ],
        [
            'change',
            'name',
            [
                'Prunus virus F',
                'Prunus virus E'
            ]
        ],
        [
            'change',
            'version',
            [
                0,
                1
            ]
        ]
    ],
    'id': '6116cba1.1',
    'index': {
        'id': 'unbuilt',
        'version': 'unbuilt'
    },
    'method_name': 'edit',
    'otu': {
        'id': '6116cba1',
        'name': 'Prunus virus F',
        'version': 1
    },
    'reference': {
        'id': 'hxn167'
    },
    'user': {
        'id': 'test'
    }
}

snapshots['test_revert[True-uvloop-False-None] 1'] = {
    '_id': '6116cba1',
    'abbreviation': 'TST',
    'imported': True,
    'isolates': [
        {
            'default': True,
            'id': 'cab8b360',
            'source_name': '8816-v2',
            'source_type': 'isolate'
        }
    ],
    'last_indexed_version': 0,
    'lower_name': 'prunus virus f',
    'name': 'Prunus virus F',
    'reference': {
        'id': 'hxn167'
    },
    'schema': [
    ],
    'verified': False,
    'version': 1
}

snapshots['test_revert[True-uvloop-False-None] 2'] = [
    {
        '_id': '6116cba1.0',
        'created_at': GenericRepr('datetime.datetime(2017, 7, 12, 16, 0, 50, 495000)'),
        'description': 'Description',
        'diff': {
            '_id': '6116cba1',
            'abbreviation': 'PVF',
            'imported': True,
            'isolates': [
                {
                    'default': True,
                    'id': 'cab8b360',
                    'sequences': [
                        {
                            '_id': 'KX269872',
                            'definition': 'Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene, complete cds.',
                            'host': 'sweet cherry',
                            'isolate_id': 'cab8b360',
                            'otu_id': '6116cba1',
                            'segment': None,
                            'sequence': 'TGTTTAAGAGATTAAACAACCGCTTTC'
                        }
                    ],
                    'source_name': '8816-v2',
                    'source_type': 'isolate'
                }
            ],
            'last_indexed_version': 0,
            'lower_name': 'prunus virus f',
            'name': 'Prunus virus F',
            'reference': {
                'id': 'hxn167'
            },
            'schema': [
            ],
            'verified': False,
            'version': 0
        },
        'index': {
            'id': 'unbuilt',
            'version': 'unbuilt'
        },
        'method_name': 'create',
        'otu': {
            'id': '6116cba1',
            'name': 'Prunus virus F',
            'version': 0
        },
        'reference': {
            'id': 'hxn167'
        },
        'user': {
            'id': 'test'
        }
    },
    {
        '_id': '6116cba1.1',
        'created_at': GenericRepr('datetime.datetime(2017, 7, 12, 16, 0, 50, 600000)'),
        'description': 'Description',
        'diff': [
            [
                'change',
                'version',
                [
                    0,
                    1
                ]
            ],
            [
                'change',
                'abbreviation',
                [
                    'PVF',
                    'TST'
                ]
            ]
        ],
        'index': {
            'id': 'unbuilt',
            'version': 'unbuilt'
        },
        'method_name': 'update',
        'otu': {
            'id': '6116cba1',
            'name': 'Prunus virus F',
            'version': 1
        },
        'reference': {
            'id': 'hxn167'
        },
        'user': {
            'id': 'test'
        }
    }
]

snapshots['test_revert[True-uvloop-False-None] 3'] = [
    {
        '_id': 'KX269872',
        'definition': 'Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene, complete cds.',
        'host': 'sweet cherry',
        'isolate_id': 'cab8b360',
        'otu_id': '6116cba1',
        'segment': None,
        'sequence': 'TGTTTAAGAGATTAAACAACCGCTTTC'
    }
]

snapshots['test_revert[True-uvloop-True-None] 1'] = {
    '_id': '6116cba1',
    'abbreviation': 'TST',
    'imported': True,
    'isolates': [
        {
            'default': True,
            'id': 'cab8b360',
            'source_name': '8816-v2',
            'source_type': 'isolate'
        }
    ],
    'last_indexed_version': 0,
    'lower_name': 'prunus virus f',
    'name': 'Prunus virus F',
    'reference': {
        'id': 'hxn167'
    },
    'schema': [
    ],
    'verified': False,
    'version': 1
}

snapshots['test_revert[True-uvloop-True-None] 2'] = [
    {
        '_id': '6116cba1.0',
        'created_at': GenericRepr('datetime.datetime(2017, 7, 12, 16, 0, 50, 495000)'),
        'description': 'Description',
        'diff': {
            '_id': '6116cba1',
            'abbreviation': 'PVF',
            'imported': True,
            'isolates': [
                {
                    'default': True,
                    'id': 'cab8b360',
                    'sequences': [
                        {
                            '_id': 'KX269872',
                            'definition': 'Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene, complete cds.',
                            'host': 'sweet cherry',
                            'isolate_id': 'cab8b360',
                            'otu_id': '6116cba1',
                            'segment': None,
                            'sequence': 'TGTTTAAGAGATTAAACAACCGCTTTC'
                        }
                    ],
                    'source_name': '8816-v2',
                    'source_type': 'isolate'
                }
            ],
            'last_indexed_version': 0,
            'lower_name': 'prunus virus f',
            'name': 'Prunus virus F',
            'reference': {
                'id': 'hxn167'
            },
            'schema': [
            ],
            'verified': False,
            'version': 0
        },
        'index': {
            'id': 'unbuilt',
            'version': 'unbuilt'
        },
        'method_name': 'create',
        'otu': {
            'id': '6116cba1',
            'name': 'Prunus virus F',
            'version': 0
        },
        'reference': {
            'id': 'hxn167'
        },
        'user': {
            'id': 'test'
        }
    },
    {
        '_id': '6116cba1.1',
        'created_at': GenericRepr('datetime.datetime(2017, 7, 12, 16, 0, 50, 600000)'),
        'description': 'Description',
        'diff': [
            [
                'change',
                'version',
                [
                    0,
                    1
                ]
            ],
            [
                'change',
                'abbreviation',
                [
                    'PVF',
                    'TST'
                ]
            ]
        ],
        'index': {
            'id': 'unbuilt',
            'version': 'unbuilt'
        },
        'method_name': 'update',
        'otu': {
            'id': '6116cba1',
            'name': 'Prunus virus F',
            'version': 1
        },
        'reference': {
            'id': 'hxn167'
        },
        'user': {
            'id': 'test'
        }
    }
]

snapshots['test_revert[True-uvloop-True-None] 3'] = [
    {
        '_id': 'KX269872',
        'definition': 'Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene, complete cds.',
        'host': 'sweet cherry',
        'isolate_id': 'cab8b360',
        'otu_id': '6116cba1',
        'segment': None,
        'sequence': 'TGTTTAAGAGATTAAACAACCGCTTTC'
    }
]
