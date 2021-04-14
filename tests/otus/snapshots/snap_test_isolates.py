# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import GenericRepr, Snapshot


snapshots = Snapshot()

snapshots['test_edit[uvloop] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Renamed Isolate 8816-v2 to Strain 0',
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
            [
                'isolates',
                0,
                'source_name'
            ],
            [
                '8816-v2',
                '0'
            ]
        ],
        [
            'change',
            [
                'isolates',
                0,
                'source_type'
            ],
            [
                'isolate',
                'strain'
            ]
        ]
    ],
    'index': {
        'id': 'unbuilt',
        'version': 'unbuilt'
    },
    'method_name': 'edit_isolate',
    'otu': {
        'id': '6116cba1',
        'name': 'Prunus virus F',
        'version': 1
    },
    'reference': {
        'id': 'hxn167'
    },
    'user': {
        'id': 'bob'
    }
}

snapshots['test_edit[uvloop] otu'] = {
    '_id': '6116cba1',
    'abbreviation': 'PVF',
    'imported': True,
    'isolates': [
        {
            'default': True,
            'id': 'cab8b360',
            'source_name': '0',
            'source_type': 'strain'
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

snapshots['test_remove[uvloop-bar] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Removed Isolate A',
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
            'remove',
            'isolates',
            [
                [
                    1,
                    {
                        'default': False,
                        'id': 'bar',
                        'sequences': [
                        ],
                        'source_name': 'A',
                        'source_type': 'isolate'
                    }
                ]
            ]
        ],
        [
            'change',
            'verified',
            [
                False,
                True
            ]
        ]
    ],
    'index': {
        'id': 'unbuilt',
        'version': 'unbuilt'
    },
    'method_name': 'remove_isolate',
    'otu': {
        'id': '6116cba1',
        'name': 'Prunus virus F',
        'version': 1
    },
    'reference': {
        'id': 'hxn167'
    },
    'user': {
        'id': 'bob'
    }
}

snapshots['test_remove[uvloop-bar] otu'] = {
    '_id': '6116cba1',
    'abbreviation': 'PVF',
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
    'verified': True,
    'version': 1
}

snapshots['test_remove[uvloop-bar] sequences'] = [
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

snapshots['test_remove[uvloop-cab8b360] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Removed Isolate 8816-v2 and set Isolate A as default',
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
            [
                'isolates',
                0,
                'id'
            ],
            [
                'cab8b360',
                'bar'
            ]
        ],
        [
            'change',
            [
                'isolates',
                0,
                'source_name'
            ],
            [
                '8816-v2',
                'A'
            ]
        ],
        [
            'remove',
            [
                'isolates',
                0,
                'sequences'
            ],
            [
                [
                    0,
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
            ]
        ],
        [
            'remove',
            'isolates',
            [
                [
                    1,
                    {
                        'default': False,
                        'id': 'bar',
                        'sequences': [
                        ],
                        'source_name': 'A',
                        'source_type': 'isolate'
                    }
                ]
            ]
        ]
    ],
    'index': {
        'id': 'unbuilt',
        'version': 'unbuilt'
    },
    'method_name': 'remove_isolate',
    'otu': {
        'id': '6116cba1',
        'name': 'Prunus virus F',
        'version': 1
    },
    'reference': {
        'id': 'hxn167'
    },
    'user': {
        'id': 'bob'
    }
}

snapshots['test_remove[uvloop-cab8b360] otu'] = {
    '_id': '6116cba1',
    'abbreviation': 'PVF',
    'imported': True,
    'isolates': [
        {
            'default': True,
            'id': 'bar',
            'source_name': 'A',
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

snapshots['test_remove[uvloop-cab8b360] sequences'] = [
]

snapshots['test_set_default[uvloop] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Set Isolate A as default',
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
            [
                'isolates',
                0,
                'default'
            ],
            [
                True,
                False
            ]
        ],
        [
            'change',
            [
                'isolates',
                1,
                'default'
            ],
            [
                False,
                True
            ]
        ]
    ],
    'index': {
        'id': 'unbuilt',
        'version': 'unbuilt'
    },
    'method_name': 'set_as_default',
    'otu': {
        'id': '6116cba1',
        'name': 'Prunus virus F',
        'version': 1
    },
    'reference': {
        'id': 'hxn167'
    },
    'user': {
        'id': 'bob'
    }
}

snapshots['test_set_default[uvloop] otu'] = {
    '_id': '6116cba1',
    'abbreviation': 'PVF',
    'imported': True,
    'isolates': [
        {
            'default': False,
            'id': 'cab8b360',
            'source_name': '8816-v2',
            'source_type': 'isolate'
        },
        {
            'default': True,
            'id': 'bar',
            'source_name': 'A',
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

snapshots['test_set_default[uvloop] return_value'] = {
    'default': True,
    'id': 'bar',
    'sequences': [
    ],
    'source_name': 'A',
    'source_type': 'isolate'
}

snapshots['test_add[uvloop-None-True-empty-True] otu'] = {
    '_id': '6116cba1',
    'abbreviation': 'PVF',
    'imported': True,
    'isolates': [
        {
            'default': True,
            'id': '9pf',
            'source_name': 'B',
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

snapshots['test_add[uvloop-None-True-empty-True] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Added Isolate B as default',
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
            'add',
            'isolates',
            [
                [
                    0,
                    {
                        'default': True,
                        'id': '9pf',
                        'sequences': [
                        ],
                        'source_name': 'B',
                        'source_type': 'isolate'
                    }
                ]
            ]
        ]
    ],
    'index': {
        'id': 'unbuilt',
        'version': 'unbuilt'
    },
    'method_name': 'add_isolate',
    'otu': {
        'id': '6116cba1',
        'name': 'Prunus virus F',
        'version': 1
    },
    'reference': {
        'id': 'hxn167'
    },
    'user': {
        'id': 'bob'
    }
}

snapshots['test_add[uvloop-None-True-empty-True] return_value'] = {
    'default': True,
    'id': '9pf',
    'sequences': [
    ],
    'source_name': 'B',
    'source_type': 'isolate'
}

snapshots['test_add[uvloop-None-True-empty-False] otu'] = {
    '_id': '6116cba1',
    'abbreviation': 'PVF',
    'imported': True,
    'isolates': [
        {
            'default': True,
            'id': '9pf',
            'source_name': 'B',
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

snapshots['test_add[uvloop-None-True-empty-False] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Added Isolate B as default',
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
            'add',
            'isolates',
            [
                [
                    0,
                    {
                        'default': True,
                        'id': '9pf',
                        'sequences': [
                        ],
                        'source_name': 'B',
                        'source_type': 'isolate'
                    }
                ]
            ]
        ]
    ],
    'index': {
        'id': 'unbuilt',
        'version': 'unbuilt'
    },
    'method_name': 'add_isolate',
    'otu': {
        'id': '6116cba1',
        'name': 'Prunus virus F',
        'version': 1
    },
    'reference': {
        'id': 'hxn167'
    },
    'user': {
        'id': 'bob'
    }
}

snapshots['test_add[uvloop-None-True-empty-False] return_value'] = {
    'default': True,
    'id': '9pf',
    'sequences': [
    ],
    'source_name': 'B',
    'source_type': 'isolate'
}

snapshots['test_add[uvloop-None-True-not_empty-True] otu'] = {
    '_id': '6116cba1',
    'abbreviation': 'PVF',
    'imported': True,
    'isolates': [
        {
            'default': False,
            'id': 'cab8b360',
            'source_name': '8816-v2',
            'source_type': 'isolate'
        },
        {
            'default': True,
            'id': '9pf',
            'source_name': 'B',
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

snapshots['test_add[uvloop-None-True-not_empty-True] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Added Isolate B as default',
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
            [
                'isolates',
                0,
                'default'
            ],
            [
                True,
                False
            ]
        ],
        [
            'add',
            'isolates',
            [
                [
                    1,
                    {
                        'default': True,
                        'id': '9pf',
                        'sequences': [
                        ],
                        'source_name': 'B',
                        'source_type': 'isolate'
                    }
                ]
            ]
        ]
    ],
    'index': {
        'id': 'unbuilt',
        'version': 'unbuilt'
    },
    'method_name': 'add_isolate',
    'otu': {
        'id': '6116cba1',
        'name': 'Prunus virus F',
        'version': 1
    },
    'reference': {
        'id': 'hxn167'
    },
    'user': {
        'id': 'bob'
    }
}

snapshots['test_add[uvloop-None-True-not_empty-True] return_value'] = {
    'default': True,
    'id': '9pf',
    'sequences': [
    ],
    'source_name': 'B',
    'source_type': 'isolate'
}

snapshots['test_add[uvloop-None-True-not_empty-False] otu'] = {
    '_id': '6116cba1',
    'abbreviation': 'PVF',
    'imported': True,
    'isolates': [
        {
            'default': True,
            'id': 'cab8b360',
            'source_name': '8816-v2',
            'source_type': 'isolate'
        },
        {
            'default': False,
            'id': '9pf',
            'source_name': 'B',
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

snapshots['test_add[uvloop-None-True-not_empty-False] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Added Isolate B',
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
            'add',
            'isolates',
            [
                [
                    1,
                    {
                        'default': False,
                        'id': '9pf',
                        'sequences': [
                        ],
                        'source_name': 'B',
                        'source_type': 'isolate'
                    }
                ]
            ]
        ]
    ],
    'index': {
        'id': 'unbuilt',
        'version': 'unbuilt'
    },
    'method_name': 'add_isolate',
    'otu': {
        'id': '6116cba1',
        'name': 'Prunus virus F',
        'version': 1
    },
    'reference': {
        'id': 'hxn167'
    },
    'user': {
        'id': 'bob'
    }
}

snapshots['test_add[uvloop-None-True-not_empty-False] return_value'] = {
    'default': False,
    'id': '9pf',
    'sequences': [
    ],
    'source_name': 'B',
    'source_type': 'isolate'
}

snapshots['test_add[uvloop-None-False-empty-True] otu'] = {
    '_id': '6116cba1',
    'abbreviation': 'PVF',
    'imported': True,
    'isolates': [
        {
            'default': True,
            'id': '9pf',
            'source_name': 'B',
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

snapshots['test_add[uvloop-None-False-empty-True] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Added Isolate B as default',
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
            'add',
            'isolates',
            [
                [
                    0,
                    {
                        'default': True,
                        'id': '9pf',
                        'sequences': [
                        ],
                        'source_name': 'B',
                        'source_type': 'isolate'
                    }
                ]
            ]
        ]
    ],
    'index': {
        'id': 'unbuilt',
        'version': 'unbuilt'
    },
    'method_name': 'add_isolate',
    'otu': {
        'id': '6116cba1',
        'name': 'Prunus virus F',
        'version': 1
    },
    'reference': {
        'id': 'hxn167'
    },
    'user': {
        'id': 'bob'
    }
}

snapshots['test_add[uvloop-None-False-empty-True] return_value'] = {
    'default': True,
    'id': '9pf',
    'sequences': [
    ],
    'source_name': 'B',
    'source_type': 'isolate'
}

snapshots['test_add[uvloop-None-False-empty-False] otu'] = {
    '_id': '6116cba1',
    'abbreviation': 'PVF',
    'imported': True,
    'isolates': [
        {
            'default': True,
            'id': '9pf',
            'source_name': 'B',
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

snapshots['test_add[uvloop-None-False-empty-False] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Added Isolate B as default',
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
            'add',
            'isolates',
            [
                [
                    0,
                    {
                        'default': True,
                        'id': '9pf',
                        'sequences': [
                        ],
                        'source_name': 'B',
                        'source_type': 'isolate'
                    }
                ]
            ]
        ]
    ],
    'index': {
        'id': 'unbuilt',
        'version': 'unbuilt'
    },
    'method_name': 'add_isolate',
    'otu': {
        'id': '6116cba1',
        'name': 'Prunus virus F',
        'version': 1
    },
    'reference': {
        'id': 'hxn167'
    },
    'user': {
        'id': 'bob'
    }
}

snapshots['test_add[uvloop-None-False-empty-False] return_value'] = {
    'default': True,
    'id': '9pf',
    'sequences': [
    ],
    'source_name': 'B',
    'source_type': 'isolate'
}

snapshots['test_add[uvloop-None-False-not_empty-True] otu'] = {
    '_id': '6116cba1',
    'abbreviation': 'PVF',
    'imported': True,
    'isolates': [
        {
            'default': False,
            'id': 'cab8b360',
            'source_name': '8816-v2',
            'source_type': 'isolate'
        },
        {
            'default': True,
            'id': '9pf',
            'source_name': 'B',
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

snapshots['test_add[uvloop-None-False-not_empty-True] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Added Isolate B as default',
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
            'add',
            'isolates',
            [
                [
                    1,
                    {
                        'default': True,
                        'id': '9pf',
                        'sequences': [
                        ],
                        'source_name': 'B',
                        'source_type': 'isolate'
                    }
                ]
            ]
        ]
    ],
    'index': {
        'id': 'unbuilt',
        'version': 'unbuilt'
    },
    'method_name': 'add_isolate',
    'otu': {
        'id': '6116cba1',
        'name': 'Prunus virus F',
        'version': 1
    },
    'reference': {
        'id': 'hxn167'
    },
    'user': {
        'id': 'bob'
    }
}

snapshots['test_add[uvloop-None-False-not_empty-True] return_value'] = {
    'default': True,
    'id': '9pf',
    'sequences': [
    ],
    'source_name': 'B',
    'source_type': 'isolate'
}

snapshots['test_add[uvloop-None-False-not_empty-False] otu'] = {
    '_id': '6116cba1',
    'abbreviation': 'PVF',
    'imported': True,
    'isolates': [
        {
            'default': False,
            'id': 'cab8b360',
            'source_name': '8816-v2',
            'source_type': 'isolate'
        },
        {
            'default': False,
            'id': '9pf',
            'source_name': 'B',
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

snapshots['test_add[uvloop-None-False-not_empty-False] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Added Isolate B',
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
            'add',
            'isolates',
            [
                [
                    1,
                    {
                        'default': False,
                        'id': '9pf',
                        'sequences': [
                        ],
                        'source_name': 'B',
                        'source_type': 'isolate'
                    }
                ]
            ]
        ]
    ],
    'index': {
        'id': 'unbuilt',
        'version': 'unbuilt'
    },
    'method_name': 'add_isolate',
    'otu': {
        'id': '6116cba1',
        'name': 'Prunus virus F',
        'version': 1
    },
    'reference': {
        'id': 'hxn167'
    },
    'user': {
        'id': 'bob'
    }
}

snapshots['test_add[uvloop-None-False-not_empty-False] return_value'] = {
    'default': False,
    'id': '9pf',
    'sequences': [
    ],
    'source_name': 'B',
    'source_type': 'isolate'
}

snapshots['test_add[uvloop-isolate-True-empty-True] otu'] = {
    '_id': '6116cba1',
    'abbreviation': 'PVF',
    'imported': True,
    'isolates': [
        {
            'default': True,
            'id': 'isolate',
            'source_name': 'B',
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

snapshots['test_add[uvloop-isolate-True-empty-True] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Added Isolate B as default',
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
            'add',
            'isolates',
            [
                [
                    0,
                    {
                        'default': True,
                        'id': 'isolate',
                        'sequences': [
                        ],
                        'source_name': 'B',
                        'source_type': 'isolate'
                    }
                ]
            ]
        ]
    ],
    'index': {
        'id': 'unbuilt',
        'version': 'unbuilt'
    },
    'method_name': 'add_isolate',
    'otu': {
        'id': '6116cba1',
        'name': 'Prunus virus F',
        'version': 1
    },
    'reference': {
        'id': 'hxn167'
    },
    'user': {
        'id': 'bob'
    }
}

snapshots['test_add[uvloop-isolate-True-empty-True] return_value'] = {
    'default': True,
    'id': 'isolate',
    'sequences': [
    ],
    'source_name': 'B',
    'source_type': 'isolate'
}

snapshots['test_add[uvloop-isolate-True-empty-False] otu'] = {
    '_id': '6116cba1',
    'abbreviation': 'PVF',
    'imported': True,
    'isolates': [
        {
            'default': True,
            'id': 'isolate',
            'source_name': 'B',
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

snapshots['test_add[uvloop-isolate-True-empty-False] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Added Isolate B as default',
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
            'add',
            'isolates',
            [
                [
                    0,
                    {
                        'default': True,
                        'id': 'isolate',
                        'sequences': [
                        ],
                        'source_name': 'B',
                        'source_type': 'isolate'
                    }
                ]
            ]
        ]
    ],
    'index': {
        'id': 'unbuilt',
        'version': 'unbuilt'
    },
    'method_name': 'add_isolate',
    'otu': {
        'id': '6116cba1',
        'name': 'Prunus virus F',
        'version': 1
    },
    'reference': {
        'id': 'hxn167'
    },
    'user': {
        'id': 'bob'
    }
}

snapshots['test_add[uvloop-isolate-True-empty-False] return_value'] = {
    'default': True,
    'id': 'isolate',
    'sequences': [
    ],
    'source_name': 'B',
    'source_type': 'isolate'
}

snapshots['test_add[uvloop-isolate-True-not_empty-True] otu'] = {
    '_id': '6116cba1',
    'abbreviation': 'PVF',
    'imported': True,
    'isolates': [
        {
            'default': False,
            'id': 'cab8b360',
            'source_name': '8816-v2',
            'source_type': 'isolate'
        },
        {
            'default': True,
            'id': 'isolate',
            'source_name': 'B',
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

snapshots['test_add[uvloop-isolate-True-not_empty-True] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Added Isolate B as default',
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
            [
                'isolates',
                0,
                'default'
            ],
            [
                True,
                False
            ]
        ],
        [
            'add',
            'isolates',
            [
                [
                    1,
                    {
                        'default': True,
                        'id': 'isolate',
                        'sequences': [
                        ],
                        'source_name': 'B',
                        'source_type': 'isolate'
                    }
                ]
            ]
        ]
    ],
    'index': {
        'id': 'unbuilt',
        'version': 'unbuilt'
    },
    'method_name': 'add_isolate',
    'otu': {
        'id': '6116cba1',
        'name': 'Prunus virus F',
        'version': 1
    },
    'reference': {
        'id': 'hxn167'
    },
    'user': {
        'id': 'bob'
    }
}

snapshots['test_add[uvloop-isolate-True-not_empty-True] return_value'] = {
    'default': True,
    'id': 'isolate',
    'sequences': [
    ],
    'source_name': 'B',
    'source_type': 'isolate'
}

snapshots['test_add[uvloop-isolate-True-not_empty-False] otu'] = {
    '_id': '6116cba1',
    'abbreviation': 'PVF',
    'imported': True,
    'isolates': [
        {
            'default': True,
            'id': 'cab8b360',
            'source_name': '8816-v2',
            'source_type': 'isolate'
        },
        {
            'default': False,
            'id': 'isolate',
            'source_name': 'B',
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

snapshots['test_add[uvloop-isolate-True-not_empty-False] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Added Isolate B',
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
            'add',
            'isolates',
            [
                [
                    1,
                    {
                        'default': False,
                        'id': 'isolate',
                        'sequences': [
                        ],
                        'source_name': 'B',
                        'source_type': 'isolate'
                    }
                ]
            ]
        ]
    ],
    'index': {
        'id': 'unbuilt',
        'version': 'unbuilt'
    },
    'method_name': 'add_isolate',
    'otu': {
        'id': '6116cba1',
        'name': 'Prunus virus F',
        'version': 1
    },
    'reference': {
        'id': 'hxn167'
    },
    'user': {
        'id': 'bob'
    }
}

snapshots['test_add[uvloop-isolate-True-not_empty-False] return_value'] = {
    'default': False,
    'id': 'isolate',
    'sequences': [
    ],
    'source_name': 'B',
    'source_type': 'isolate'
}

snapshots['test_add[uvloop-isolate-False-empty-True] otu'] = {
    '_id': '6116cba1',
    'abbreviation': 'PVF',
    'imported': True,
    'isolates': [
        {
            'default': True,
            'id': 'isolate',
            'source_name': 'B',
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

snapshots['test_add[uvloop-isolate-False-empty-True] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Added Isolate B as default',
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
            'add',
            'isolates',
            [
                [
                    0,
                    {
                        'default': True,
                        'id': 'isolate',
                        'sequences': [
                        ],
                        'source_name': 'B',
                        'source_type': 'isolate'
                    }
                ]
            ]
        ]
    ],
    'index': {
        'id': 'unbuilt',
        'version': 'unbuilt'
    },
    'method_name': 'add_isolate',
    'otu': {
        'id': '6116cba1',
        'name': 'Prunus virus F',
        'version': 1
    },
    'reference': {
        'id': 'hxn167'
    },
    'user': {
        'id': 'bob'
    }
}

snapshots['test_add[uvloop-isolate-False-empty-True] return_value'] = {
    'default': True,
    'id': 'isolate',
    'sequences': [
    ],
    'source_name': 'B',
    'source_type': 'isolate'
}

snapshots['test_add[uvloop-isolate-False-empty-False] otu'] = {
    '_id': '6116cba1',
    'abbreviation': 'PVF',
    'imported': True,
    'isolates': [
        {
            'default': True,
            'id': 'isolate',
            'source_name': 'B',
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

snapshots['test_add[uvloop-isolate-False-empty-False] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Added Isolate B as default',
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
            'add',
            'isolates',
            [
                [
                    0,
                    {
                        'default': True,
                        'id': 'isolate',
                        'sequences': [
                        ],
                        'source_name': 'B',
                        'source_type': 'isolate'
                    }
                ]
            ]
        ]
    ],
    'index': {
        'id': 'unbuilt',
        'version': 'unbuilt'
    },
    'method_name': 'add_isolate',
    'otu': {
        'id': '6116cba1',
        'name': 'Prunus virus F',
        'version': 1
    },
    'reference': {
        'id': 'hxn167'
    },
    'user': {
        'id': 'bob'
    }
}

snapshots['test_add[uvloop-isolate-False-empty-False] return_value'] = {
    'default': True,
    'id': 'isolate',
    'sequences': [
    ],
    'source_name': 'B',
    'source_type': 'isolate'
}

snapshots['test_add[uvloop-isolate-False-not_empty-True] otu'] = {
    '_id': '6116cba1',
    'abbreviation': 'PVF',
    'imported': True,
    'isolates': [
        {
            'default': False,
            'id': 'cab8b360',
            'source_name': '8816-v2',
            'source_type': 'isolate'
        },
        {
            'default': True,
            'id': 'isolate',
            'source_name': 'B',
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

snapshots['test_add[uvloop-isolate-False-not_empty-True] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Added Isolate B as default',
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
            'add',
            'isolates',
            [
                [
                    1,
                    {
                        'default': True,
                        'id': 'isolate',
                        'sequences': [
                        ],
                        'source_name': 'B',
                        'source_type': 'isolate'
                    }
                ]
            ]
        ]
    ],
    'index': {
        'id': 'unbuilt',
        'version': 'unbuilt'
    },
    'method_name': 'add_isolate',
    'otu': {
        'id': '6116cba1',
        'name': 'Prunus virus F',
        'version': 1
    },
    'reference': {
        'id': 'hxn167'
    },
    'user': {
        'id': 'bob'
    }
}

snapshots['test_add[uvloop-isolate-False-not_empty-True] return_value'] = {
    'default': True,
    'id': 'isolate',
    'sequences': [
    ],
    'source_name': 'B',
    'source_type': 'isolate'
}

snapshots['test_add[uvloop-isolate-False-not_empty-False] otu'] = {
    '_id': '6116cba1',
    'abbreviation': 'PVF',
    'imported': True,
    'isolates': [
        {
            'default': False,
            'id': 'cab8b360',
            'source_name': '8816-v2',
            'source_type': 'isolate'
        },
        {
            'default': False,
            'id': 'isolate',
            'source_name': 'B',
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

snapshots['test_add[uvloop-isolate-False-not_empty-False] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Added Isolate B',
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
            'add',
            'isolates',
            [
                [
                    1,
                    {
                        'default': False,
                        'id': 'isolate',
                        'sequences': [
                        ],
                        'source_name': 'B',
                        'source_type': 'isolate'
                    }
                ]
            ]
        ]
    ],
    'index': {
        'id': 'unbuilt',
        'version': 'unbuilt'
    },
    'method_name': 'add_isolate',
    'otu': {
        'id': '6116cba1',
        'name': 'Prunus virus F',
        'version': 1
    },
    'reference': {
        'id': 'hxn167'
    },
    'user': {
        'id': 'bob'
    }
}

snapshots['test_add[uvloop-isolate-False-not_empty-False] return_value'] = {
    'default': False,
    'id': 'isolate',
    'sequences': [
    ],
    'source_name': 'B',
    'source_type': 'isolate'
}
