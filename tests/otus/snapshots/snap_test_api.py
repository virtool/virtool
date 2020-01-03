# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import GenericRepr, Snapshot


snapshots = Snapshot()

snapshots['TestCreate.test[True-uvloop-None-True] history'] = {
    '_id': '9pfsom1b.0',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Created Tobacco mosaic virus',
    'diff': {
        '_id': '9pfsom1b',
        'abbreviation': '',
        'isolates': [
        ],
        'last_indexed_version': None,
        'lower_name': 'tobacco mosaic virus',
        'name': 'Tobacco mosaic virus',
        'reference': {
            'id': 'foo'
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
        'id': '9pfsom1b',
        'name': 'Tobacco mosaic virus',
        'version': 0
    },
    'reference': {
        'id': 'foo'
    },
    'user': {
        'id': 'test'
    }
}

snapshots['TestCreate.test[True-uvloop-None-True] otu'] = {
    '_id': '9pfsom1b',
    'abbreviation': '',
    'isolates': [
    ],
    'last_indexed_version': None,
    'lower_name': 'tobacco mosaic virus',
    'name': 'Tobacco mosaic virus',
    'reference': {
        'id': 'foo'
    },
    'schema': [
    ],
    'verified': False,
    'version': 0
}

snapshots['TestCreate.test[True-uvloop-TMV-True] history'] = {
    '_id': '9pfsom1b.0',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Created Tobacco mosaic virus (TMV)',
    'diff': {
        '_id': '9pfsom1b',
        'abbreviation': 'TMV',
        'isolates': [
        ],
        'last_indexed_version': None,
        'lower_name': 'tobacco mosaic virus',
        'name': 'Tobacco mosaic virus',
        'reference': {
            'id': 'foo'
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
        'id': '9pfsom1b',
        'name': 'Tobacco mosaic virus',
        'version': 0
    },
    'reference': {
        'id': 'foo'
    },
    'user': {
        'id': 'test'
    }
}

snapshots['TestCreate.test[True-uvloop-TMV-True] otu'] = {
    '_id': '9pfsom1b',
    'abbreviation': 'TMV',
    'isolates': [
    ],
    'last_indexed_version': None,
    'lower_name': 'tobacco mosaic virus',
    'name': 'Tobacco mosaic virus',
    'reference': {
        'id': 'foo'
    },
    'schema': [
    ],
    'verified': False,
    'version': 0
}

snapshots['TestCreate.test[True-uvloop-True] history'] = {
    '_id': '9pfsom1b.0',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Created Tobacco mosaic virus',
    'diff': {
        '_id': '9pfsom1b',
        'abbreviation': '',
        'isolates': [
        ],
        'last_indexed_version': None,
        'lower_name': 'tobacco mosaic virus',
        'name': 'Tobacco mosaic virus',
        'reference': {
            'id': 'foo'
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
        'id': '9pfsom1b',
        'name': 'Tobacco mosaic virus',
        'version': 0
    },
    'reference': {
        'id': 'foo'
    },
    'user': {
        'id': 'test'
    }
}

snapshots['TestCreate.test[True-uvloop-True] otu'] = {
    '_id': '9pfsom1b',
    'abbreviation': '',
    'isolates': [
    ],
    'last_indexed_version': None,
    'lower_name': 'tobacco mosaic virus',
    'name': 'Tobacco mosaic virus',
    'reference': {
        'id': 'foo'
    },
    'schema': [
    ],
    'verified': False,
    'version': 0
}

snapshots['TestSetAsDefault.test[True-uvloop] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Set Isolate b as default',
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
        'id': 'test'
    }
}

snapshots['TestSetAsDefault.test[True-uvloop] joined'] = {
    '_id': '6116cba1',
    'abbreviation': 'PVF',
    'imported': True,
    'isolates': [
        {
            'default': False,
            'id': 'cab8b360',
            'sequences': [
            ],
            'source_name': '8816-v2',
            'source_type': 'isolate'
        },
        {
            'default': True,
            'id': 'test',
            'sequences': [
            ],
            'source_name': 'b',
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

snapshots['TestSetAsDefault.test_no_change[True-uvloop] joined'] = {
    '_id': '6116cba1',
    'abbreviation': 'PVF',
    'imported': True,
    'isolates': [
        {
            'default': True,
            'id': 'cab8b360',
            'sequences': [
            ],
            'source_name': '8816-v2',
            'source_type': 'isolate'
        },
        {
            'default': False,
            'id': 'test',
            'sequences': [
            ],
            'source_name': 'b',
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
}

snapshots['TestSetAsDefault.test_no_change[True-uvloop] response'] = {
    'default': True,
    'id': 'cab8b360',
    'sequences': [
    ],
    'source_name': '8816-v2',
    'source_type': 'isolate'
}

snapshots['test_get[uvloop-None] 1'] = {
    'abbreviation': 'PVF',
    'id': '6116cba1',
    'imported': True,
    'isolates': [
        {
            'default': True,
            'id': 'cab8b360',
            'sequences': [
                {
                    'definition': 'Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene, complete cds.',
                    'host': 'sweet cherry',
                    'id': 'KX269872',
                    'segment': None,
                    'sequence': 'TGTTTAAGAGATTAAACAACCGCTTTC'
                }
            ],
            'source_name': '8816-v2',
            'source_type': 'isolate'
        }
    ],
    'issues': None,
    'last_indexed_version': 0,
    'most_recent_change': None,
    'name': 'Prunus virus F',
    'reference': {
        'id': 'hxn167'
    },
    'schema': [
    ],
    'verified': False,
    'version': 0
}

snapshots['TestEdit.test[True-uvloop-data0-TMV-Changed name to Tobacco mosaic otu] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Changed name to Tobacco mosaic otu',
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
            'lower_name',
            [
                'prunus virus f',
                'tobacco mosaic otu'
            ]
        ],
        [
            'change',
            'name',
            [
                'Prunus virus F',
                'Tobacco mosaic otu'
            ]
        ]
    ],
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

snapshots['TestEdit.test[True-uvloop-data1-PVF-Changed name to Tobacco mosaic otu and changed abbreviation to TMV] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Changed name to Tobacco mosaic otu and changed abbreviation to TMV',
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
                'TMV'
            ]
        ],
        [
            'change',
            'lower_name',
            [
                'prunus virus f',
                'tobacco mosaic otu'
            ]
        ],
        [
            'change',
            'name',
            [
                'Prunus virus F',
                'Tobacco mosaic otu'
            ]
        ]
    ],
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

snapshots['TestEdit.test[True-uvloop-data2-PVF-Changed abbreviation to TMV] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Changed abbreviation to TMV',
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
                'TMV'
            ]
        ]
    ],
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

snapshots['TestEdit.test[True-uvloop-data3-TMV-Changed name to Tobacco mosaic otu] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Changed name to Tobacco mosaic otu',
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
            'lower_name',
            [
                'prunus virus f',
                'tobacco mosaic otu'
            ]
        ],
        [
            'change',
            'name',
            [
                'Prunus virus F',
                'Tobacco mosaic otu'
            ]
        ]
    ],
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

snapshots['TestEdit.test[True-uvloop-data4-TMV-Changed name to Tobacco mosaic otu and removed abbreviation TMV] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Changed name to Tobacco mosaic otu and removed abbreviation TMV',
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
                'TMV',
                ''
            ]
        ],
        [
            'change',
            'lower_name',
            [
                'prunus virus f',
                'tobacco mosaic otu'
            ]
        ],
        [
            'change',
            'name',
            [
                'Prunus virus F',
                'Tobacco mosaic otu'
            ]
        ]
    ],
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

snapshots['TestEdit.test[True-uvloop-data5--Changed name to Tobacco mosaic otu and added abbreviation TMV] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Changed name to Tobacco mosaic otu and added abbreviation TMV',
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
                '',
                'TMV'
            ]
        ],
        [
            'change',
            'lower_name',
            [
                'prunus virus f',
                'tobacco mosaic otu'
            ]
        ],
        [
            'change',
            'name',
            [
                'Prunus virus F',
                'Tobacco mosaic otu'
            ]
        ]
    ],
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

snapshots['TestEdit.test[True-uvloop-data6-PVF-Changed abbreviation to TMV] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Changed abbreviation to TMV',
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
                'TMV'
            ]
        ]
    ],
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

snapshots['TestEdit.test[True-uvloop-data7-PVF-Changed abbreviation to TMV] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Changed abbreviation to TMV',
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
                'TMV'
            ]
        ]
    ],
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

snapshots['TestEdit.test[True-uvloop-data8--Added abbreviation TMV] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Added abbreviation TMV',
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
                '',
                'TMV'
            ]
        ]
    ],
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

snapshots['TestEdit.test[True-uvloop-data9-TMV-Removed abbreviation TMV] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Removed abbreviation TMV',
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
                'TMV',
                ''
            ]
        ]
    ],
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

snapshots['TestEdit.test_no_change[True-uvloop-Tobacco mosaic otu-TMV-data0] 1'] = {
    'abbreviation': 'TMV',
    'id': 'test',
    'isolates': [
    ],
    'issues': {
        'empty_isolate': False,
        'empty_otu': True,
        'empty_sequence': False,
        'isolate_inconsistency': False
    },
    'most_recent_change': None,
    'name': 'Tobacco mosaic otu',
    'reference': {
        'id': 'foo'
    }
}

snapshots['TestEdit.test_no_change[True-uvloop-Tobacco mosaic otu-TMV-data1] 1'] = {
    'abbreviation': 'TMV',
    'id': 'test',
    'isolates': [
    ],
    'issues': {
        'empty_isolate': False,
        'empty_otu': True,
        'empty_sequence': False,
        'isolate_inconsistency': False
    },
    'most_recent_change': None,
    'name': 'Tobacco mosaic otu',
    'reference': {
        'id': 'foo'
    }
}

snapshots['TestEdit.test_no_change[True-uvloop-Tobacco mosaic otu-TMV-data2] 1'] = {
    'abbreviation': 'TMV',
    'id': 'test',
    'isolates': [
    ],
    'issues': {
        'empty_isolate': False,
        'empty_otu': True,
        'empty_sequence': False,
        'isolate_inconsistency': False
    },
    'most_recent_change': None,
    'name': 'Tobacco mosaic otu',
    'reference': {
        'id': 'foo'
    }
}

snapshots['test_remove[True-uvloop--True] history'] = {
    '_id': '6116cba1.removed',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Removed Prunus virus F',
    'diff': {
        '_id': '6116cba1',
        'abbreviation': '',
        'imported': True,
        'isolates': [
            {
                'default': True,
                'id': 'cab8b360',
                'sequences': [
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
    'method_name': 'remove',
    'otu': {
        'id': '6116cba1',
        'name': 'Prunus virus F',
        'version': 'removed'
    },
    'reference': {
        'id': 'hxn167'
    },
    'user': {
        'id': 'test'
    }
}

snapshots['test_remove[True-uvloop-PVF-True] history'] = {
    '_id': '6116cba1.removed',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Removed Prunus virus F (PVF)',
    'diff': {
        '_id': '6116cba1',
        'abbreviation': 'PVF',
        'imported': True,
        'isolates': [
            {
                'default': True,
                'id': 'cab8b360',
                'sequences': [
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
    'method_name': 'remove',
    'otu': {
        'id': '6116cba1',
        'name': 'Prunus virus F',
        'version': 'removed'
    },
    'reference': {
        'id': 'hxn167'
    },
    'user': {
        'id': 'test'
    }
}

snapshots['test_get_isolate[uvloop-None] 1'] = {
    'default': True,
    'id': 'cab8b360',
    'sequences': [
        {
            'definition': 'Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene, complete cds.',
            'host': 'sweet cherry',
            'id': 'KX269872',
            'segment': None,
            'sequence': 'TGTTTAAGAGATTAAACAACCGCTTTC'
        }
    ],
    'source_name': '8816-v2',
    'source_type': 'isolate'
}

snapshots['TestEditIsolate.test[True-uvloop-data0-Renamed Isolate b to Variant b] json'] = {
    'default': False,
    'id': 'test',
    'sequences': [
    ],
    'source_name': 'b',
    'source_type': 'variant'
}

snapshots['TestEditIsolate.test[True-uvloop-data0-Renamed Isolate b to Variant b] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Renamed Isolate b to Variant b',
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
                1,
                'source_type'
            ],
            [
                'isolate',
                'variant'
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
        'id': 'test'
    }
}

snapshots['TestEditIsolate.test[True-uvloop-data1-Renamed Isolate b to Variant b] json'] = {
    'default': False,
    'id': 'test',
    'sequences': [
    ],
    'source_name': 'b',
    'source_type': 'variant'
}

snapshots['TestEditIsolate.test[True-uvloop-data1-Renamed Isolate b to Variant b] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Renamed Isolate b to Variant b',
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
                1,
                'source_type'
            ],
            [
                'isolate',
                'variant'
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
        'id': 'test'
    }
}

snapshots['TestEditIsolate.test[True-uvloop-data2-Renamed Isolate b to Variant A] json'] = {
    'default': False,
    'id': 'test',
    'sequences': [
    ],
    'source_name': 'A',
    'source_type': 'variant'
}

snapshots['TestEditIsolate.test[True-uvloop-data2-Renamed Isolate b to Variant A] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Renamed Isolate b to Variant A',
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
                1,
                'source_name'
            ],
            [
                'b',
                'A'
            ]
        ],
        [
            'change',
            [
                'isolates',
                1,
                'source_type'
            ],
            [
                'isolate',
                'variant'
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
        'id': 'test'
    }
}

snapshots['TestEditIsolate.test[True-uvloop-data3-Renamed Isolate b to Isolate A] json'] = {
    'default': False,
    'id': 'test',
    'sequences': [
    ],
    'source_name': 'A',
    'source_type': 'isolate'
}

snapshots['TestEditIsolate.test[True-uvloop-data3-Renamed Isolate b to Isolate A] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Renamed Isolate b to Isolate A',
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
                1,
                'source_name'
            ],
            [
                'b',
                'A'
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
        'id': 'test'
    }
}

snapshots['TestEditIsolate.test_force_case[True-uvloop] json'] = {
    'default': True,
    'id': 'cab8b360',
    'sequences': [
    ],
    'source_name': '8816-v2',
    'source_type': 'variant'
}

snapshots['TestEditIsolate.test_force_case[True-uvloop] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Renamed Isolate 8816-v2 to Variant 8816-v2',
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
                'source_type'
            ],
            [
                'isolate',
                'variant'
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
        'id': 'test'
    }
}

snapshots['TestCreate.test[True-uvloop-None-True] json'] = {
    'abbreviation': '',
    'id': '9pfsom1b',
    'isolates': [
    ],
    'issues': {
        'empty_isolate': False,
        'empty_otu': True,
        'empty_sequence': False,
        'isolate_inconsistency': False
    },
    'last_indexed_version': None,
    'most_recent_change': {
        'created_at': '2015-10-06T20:00:00Z',
        'description': 'Created Tobacco mosaic virus',
        'diff': {
            '_id': '9pfsom1b',
            'abbreviation': '',
            'isolates': [
            ],
            'last_indexed_version': None,
            'lower_name': 'tobacco mosaic virus',
            'name': 'Tobacco mosaic virus',
            'reference': {
                'id': 'foo'
            },
            'schema': [
            ],
            'verified': False,
            'version': 0
        },
        'id': '9pfsom1b.0',
        'index': {
            'id': 'unbuilt',
            'version': 'unbuilt'
        },
        'method_name': 'create',
        'otu': {
            'id': '9pfsom1b',
            'name': 'Tobacco mosaic virus',
            'version': 0
        },
        'reference': {
            'id': 'foo'
        },
        'user': {
            'id': 'test'
        }
    },
    'name': 'Tobacco mosaic virus',
    'reference': {
        'id': 'foo'
    },
    'schema': [
    ],
    'verified': False,
    'version': 0
}

snapshots['TestCreate.test[True-uvloop-True] json'] = {
    'abbreviation': '',
    'id': '9pfsom1b',
    'isolates': [
    ],
    'issues': {
        'empty_isolate': False,
        'empty_otu': True,
        'empty_sequence': False,
        'isolate_inconsistency': False
    },
    'last_indexed_version': None,
    'most_recent_change': {
        'created_at': '2015-10-06T20:00:00Z',
        'description': 'Created Tobacco mosaic virus',
        'diff': {
            '_id': '9pfsom1b',
            'abbreviation': '',
            'isolates': [
            ],
            'last_indexed_version': None,
            'lower_name': 'tobacco mosaic virus',
            'name': 'Tobacco mosaic virus',
            'reference': {
                'id': 'foo'
            },
            'schema': [
            ],
            'verified': False,
            'version': 0
        },
        'id': '9pfsom1b.0',
        'index': {
            'id': 'unbuilt',
            'version': 'unbuilt'
        },
        'method_name': 'create',
        'otu': {
            'id': '9pfsom1b',
            'name': 'Tobacco mosaic virus',
            'version': 0
        },
        'reference': {
            'id': 'foo'
        },
        'user': {
            'id': 'test'
        }
    },
    'name': 'Tobacco mosaic virus',
    'reference': {
        'id': 'foo'
    },
    'schema': [
    ],
    'verified': False,
    'version': 0
}

snapshots['TestCreate.test[True-uvloop-TMV-True] json'] = {
    'abbreviation': 'TMV',
    'id': '9pfsom1b',
    'isolates': [
    ],
    'issues': {
        'empty_isolate': False,
        'empty_otu': True,
        'empty_sequence': False,
        'isolate_inconsistency': False
    },
    'last_indexed_version': None,
    'most_recent_change': {
        'created_at': '2015-10-06T20:00:00Z',
        'description': 'Created Tobacco mosaic virus (TMV)',
        'diff': {
            '_id': '9pfsom1b',
            'abbreviation': 'TMV',
            'isolates': [
            ],
            'last_indexed_version': None,
            'lower_name': 'tobacco mosaic virus',
            'name': 'Tobacco mosaic virus',
            'reference': {
                'id': 'foo'
            },
            'schema': [
            ],
            'verified': False,
            'version': 0
        },
        'id': '9pfsom1b.0',
        'index': {
            'id': 'unbuilt',
            'version': 'unbuilt'
        },
        'method_name': 'create',
        'otu': {
            'id': '9pfsom1b',
            'name': 'Tobacco mosaic virus',
            'version': 0
        },
        'reference': {
            'id': 'foo'
        },
        'user': {
            'id': 'test'
        }
    },
    'name': 'Tobacco mosaic virus',
    'reference': {
        'id': 'foo'
    },
    'schema': [
    ],
    'verified': False,
    'version': 0
}

snapshots['TestEdit.test[True-uvloop-data0-TMV-Changed name to Tobacco mosaic otu] json'] = {
    'abbreviation': 'TMV',
    'id': '6116cba1',
    'imported': True,
    'isolates': [
        {
            'default': True,
            'id': 'cab8b360',
            'sequences': [
            ],
            'source_name': '8816-v2',
            'source_type': 'isolate'
        }
    ],
    'issues': {
        'empty_isolate': [
            'cab8b360'
        ],
        'empty_otu': False,
        'empty_sequence': False,
        'isolate_inconsistency': False
    },
    'last_indexed_version': 0,
    'most_recent_change': {
        'created_at': '2015-10-06T20:00:00Z',
        'description': 'Changed name to Tobacco mosaic otu',
        'id': '6116cba1.1',
        'method_name': 'edit',
        'otu': {
            'id': '6116cba1',
            'name': 'Prunus virus F',
            'version': 1
        },
        'user': {
            'id': 'test'
        }
    },
    'name': 'Tobacco mosaic otu',
    'reference': {
        'id': 'hxn167'
    },
    'schema': [
    ],
    'verified': False,
    'version': 1
}

snapshots['TestEdit.test[True-uvloop-data0-TMV-Changed name to Tobacco mosaic otu] otu'] = {
    '_id': '6116cba1',
    'abbreviation': 'TMV',
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
    'lower_name': 'tobacco mosaic otu',
    'name': 'Tobacco mosaic otu',
    'reference': {
        'id': 'hxn167'
    },
    'schema': [
    ],
    'verified': False,
    'version': 1
}

snapshots['TestEdit.test[True-uvloop-data1-PVF-Changed name to Tobacco mosaic otu and changed abbreviation to TMV] json'] = {
    'abbreviation': 'TMV',
    'id': '6116cba1',
    'imported': True,
    'isolates': [
        {
            'default': True,
            'id': 'cab8b360',
            'sequences': [
            ],
            'source_name': '8816-v2',
            'source_type': 'isolate'
        }
    ],
    'issues': {
        'empty_isolate': [
            'cab8b360'
        ],
        'empty_otu': False,
        'empty_sequence': False,
        'isolate_inconsistency': False
    },
    'last_indexed_version': 0,
    'most_recent_change': {
        'created_at': '2015-10-06T20:00:00Z',
        'description': 'Changed name to Tobacco mosaic otu and changed abbreviation to TMV',
        'id': '6116cba1.1',
        'method_name': 'edit',
        'otu': {
            'id': '6116cba1',
            'name': 'Prunus virus F',
            'version': 1
        },
        'user': {
            'id': 'test'
        }
    },
    'name': 'Tobacco mosaic otu',
    'reference': {
        'id': 'hxn167'
    },
    'schema': [
    ],
    'verified': False,
    'version': 1
}

snapshots['TestEdit.test[True-uvloop-data1-PVF-Changed name to Tobacco mosaic otu and changed abbreviation to TMV] otu'] = {
    '_id': '6116cba1',
    'abbreviation': 'TMV',
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
    'lower_name': 'tobacco mosaic otu',
    'name': 'Tobacco mosaic otu',
    'reference': {
        'id': 'hxn167'
    },
    'schema': [
    ],
    'verified': False,
    'version': 1
}

snapshots['TestEdit.test[True-uvloop-data2-PVF-Changed abbreviation to TMV] json'] = {
    'abbreviation': 'TMV',
    'id': '6116cba1',
    'imported': True,
    'isolates': [
        {
            'default': True,
            'id': 'cab8b360',
            'sequences': [
            ],
            'source_name': '8816-v2',
            'source_type': 'isolate'
        }
    ],
    'issues': {
        'empty_isolate': [
            'cab8b360'
        ],
        'empty_otu': False,
        'empty_sequence': False,
        'isolate_inconsistency': False
    },
    'last_indexed_version': 0,
    'most_recent_change': {
        'created_at': '2015-10-06T20:00:00Z',
        'description': 'Changed abbreviation to TMV',
        'id': '6116cba1.1',
        'method_name': 'edit',
        'otu': {
            'id': '6116cba1',
            'name': 'Prunus virus F',
            'version': 1
        },
        'user': {
            'id': 'test'
        }
    },
    'name': 'Prunus virus F',
    'reference': {
        'id': 'hxn167'
    },
    'schema': [
    ],
    'verified': False,
    'version': 1
}

snapshots['TestEdit.test[True-uvloop-data2-PVF-Changed abbreviation to TMV] otu'] = {
    '_id': '6116cba1',
    'abbreviation': 'TMV',
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

snapshots['TestEdit.test[True-uvloop-data3-TMV-Changed name to Tobacco mosaic otu] json'] = {
    'abbreviation': 'TMV',
    'id': '6116cba1',
    'imported': True,
    'isolates': [
        {
            'default': True,
            'id': 'cab8b360',
            'sequences': [
            ],
            'source_name': '8816-v2',
            'source_type': 'isolate'
        }
    ],
    'issues': {
        'empty_isolate': [
            'cab8b360'
        ],
        'empty_otu': False,
        'empty_sequence': False,
        'isolate_inconsistency': False
    },
    'last_indexed_version': 0,
    'most_recent_change': {
        'created_at': '2015-10-06T20:00:00Z',
        'description': 'Changed name to Tobacco mosaic otu',
        'id': '6116cba1.1',
        'method_name': 'edit',
        'otu': {
            'id': '6116cba1',
            'name': 'Prunus virus F',
            'version': 1
        },
        'user': {
            'id': 'test'
        }
    },
    'name': 'Tobacco mosaic otu',
    'reference': {
        'id': 'hxn167'
    },
    'schema': [
    ],
    'verified': False,
    'version': 1
}

snapshots['TestEdit.test[True-uvloop-data3-TMV-Changed name to Tobacco mosaic otu] otu'] = {
    '_id': '6116cba1',
    'abbreviation': 'TMV',
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
    'lower_name': 'tobacco mosaic otu',
    'name': 'Tobacco mosaic otu',
    'reference': {
        'id': 'hxn167'
    },
    'schema': [
    ],
    'verified': False,
    'version': 1
}

snapshots['TestEdit.test[True-uvloop-data4-TMV-Changed name to Tobacco mosaic otu and removed abbreviation TMV] json'] = {
    'abbreviation': '',
    'id': '6116cba1',
    'imported': True,
    'isolates': [
        {
            'default': True,
            'id': 'cab8b360',
            'sequences': [
            ],
            'source_name': '8816-v2',
            'source_type': 'isolate'
        }
    ],
    'issues': {
        'empty_isolate': [
            'cab8b360'
        ],
        'empty_otu': False,
        'empty_sequence': False,
        'isolate_inconsistency': False
    },
    'last_indexed_version': 0,
    'most_recent_change': {
        'created_at': '2015-10-06T20:00:00Z',
        'description': 'Changed name to Tobacco mosaic otu and removed abbreviation TMV',
        'id': '6116cba1.1',
        'method_name': 'edit',
        'otu': {
            'id': '6116cba1',
            'name': 'Prunus virus F',
            'version': 1
        },
        'user': {
            'id': 'test'
        }
    },
    'name': 'Tobacco mosaic otu',
    'reference': {
        'id': 'hxn167'
    },
    'schema': [
    ],
    'verified': False,
    'version': 1
}

snapshots['TestEdit.test[True-uvloop-data4-TMV-Changed name to Tobacco mosaic otu and removed abbreviation TMV] otu'] = {
    '_id': '6116cba1',
    'abbreviation': '',
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
    'lower_name': 'tobacco mosaic otu',
    'name': 'Tobacco mosaic otu',
    'reference': {
        'id': 'hxn167'
    },
    'schema': [
    ],
    'verified': False,
    'version': 1
}

snapshots['TestEdit.test[True-uvloop-data5--Changed name to Tobacco mosaic otu and added abbreviation TMV] json'] = {
    'abbreviation': 'TMV',
    'id': '6116cba1',
    'imported': True,
    'isolates': [
        {
            'default': True,
            'id': 'cab8b360',
            'sequences': [
            ],
            'source_name': '8816-v2',
            'source_type': 'isolate'
        }
    ],
    'issues': {
        'empty_isolate': [
            'cab8b360'
        ],
        'empty_otu': False,
        'empty_sequence': False,
        'isolate_inconsistency': False
    },
    'last_indexed_version': 0,
    'most_recent_change': {
        'created_at': '2015-10-06T20:00:00Z',
        'description': 'Changed name to Tobacco mosaic otu and added abbreviation TMV',
        'id': '6116cba1.1',
        'method_name': 'edit',
        'otu': {
            'id': '6116cba1',
            'name': 'Prunus virus F',
            'version': 1
        },
        'user': {
            'id': 'test'
        }
    },
    'name': 'Tobacco mosaic otu',
    'reference': {
        'id': 'hxn167'
    },
    'schema': [
    ],
    'verified': False,
    'version': 1
}

snapshots['TestEdit.test[True-uvloop-data5--Changed name to Tobacco mosaic otu and added abbreviation TMV] otu'] = {
    '_id': '6116cba1',
    'abbreviation': 'TMV',
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
    'lower_name': 'tobacco mosaic otu',
    'name': 'Tobacco mosaic otu',
    'reference': {
        'id': 'hxn167'
    },
    'schema': [
    ],
    'verified': False,
    'version': 1
}

snapshots['TestEdit.test[True-uvloop-data6-PVF-Changed abbreviation to TMV] json'] = {
    'abbreviation': 'TMV',
    'id': '6116cba1',
    'imported': True,
    'isolates': [
        {
            'default': True,
            'id': 'cab8b360',
            'sequences': [
            ],
            'source_name': '8816-v2',
            'source_type': 'isolate'
        }
    ],
    'issues': {
        'empty_isolate': [
            'cab8b360'
        ],
        'empty_otu': False,
        'empty_sequence': False,
        'isolate_inconsistency': False
    },
    'last_indexed_version': 0,
    'most_recent_change': {
        'created_at': '2015-10-06T20:00:00Z',
        'description': 'Changed abbreviation to TMV',
        'id': '6116cba1.1',
        'method_name': 'edit',
        'otu': {
            'id': '6116cba1',
            'name': 'Prunus virus F',
            'version': 1
        },
        'user': {
            'id': 'test'
        }
    },
    'name': 'Prunus virus F',
    'reference': {
        'id': 'hxn167'
    },
    'schema': [
    ],
    'verified': False,
    'version': 1
}

snapshots['TestEdit.test[True-uvloop-data6-PVF-Changed abbreviation to TMV] otu'] = {
    '_id': '6116cba1',
    'abbreviation': 'TMV',
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

snapshots['TestEdit.test[True-uvloop-data7-PVF-Changed abbreviation to TMV] json'] = {
    'abbreviation': 'TMV',
    'id': '6116cba1',
    'imported': True,
    'isolates': [
        {
            'default': True,
            'id': 'cab8b360',
            'sequences': [
            ],
            'source_name': '8816-v2',
            'source_type': 'isolate'
        }
    ],
    'issues': {
        'empty_isolate': [
            'cab8b360'
        ],
        'empty_otu': False,
        'empty_sequence': False,
        'isolate_inconsistency': False
    },
    'last_indexed_version': 0,
    'most_recent_change': {
        'created_at': '2015-10-06T20:00:00Z',
        'description': 'Changed abbreviation to TMV',
        'id': '6116cba1.1',
        'method_name': 'edit',
        'otu': {
            'id': '6116cba1',
            'name': 'Prunus virus F',
            'version': 1
        },
        'user': {
            'id': 'test'
        }
    },
    'name': 'Prunus virus F',
    'reference': {
        'id': 'hxn167'
    },
    'schema': [
    ],
    'verified': False,
    'version': 1
}

snapshots['TestEdit.test[True-uvloop-data7-PVF-Changed abbreviation to TMV] otu'] = {
    '_id': '6116cba1',
    'abbreviation': 'TMV',
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

snapshots['TestEdit.test[True-uvloop-data8--Added abbreviation TMV] json'] = {
    'abbreviation': 'TMV',
    'id': '6116cba1',
    'imported': True,
    'isolates': [
        {
            'default': True,
            'id': 'cab8b360',
            'sequences': [
            ],
            'source_name': '8816-v2',
            'source_type': 'isolate'
        }
    ],
    'issues': {
        'empty_isolate': [
            'cab8b360'
        ],
        'empty_otu': False,
        'empty_sequence': False,
        'isolate_inconsistency': False
    },
    'last_indexed_version': 0,
    'most_recent_change': {
        'created_at': '2015-10-06T20:00:00Z',
        'description': 'Added abbreviation TMV',
        'id': '6116cba1.1',
        'method_name': 'edit',
        'otu': {
            'id': '6116cba1',
            'name': 'Prunus virus F',
            'version': 1
        },
        'user': {
            'id': 'test'
        }
    },
    'name': 'Prunus virus F',
    'reference': {
        'id': 'hxn167'
    },
    'schema': [
    ],
    'verified': False,
    'version': 1
}

snapshots['TestEdit.test[True-uvloop-data8--Added abbreviation TMV] otu'] = {
    '_id': '6116cba1',
    'abbreviation': 'TMV',
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

snapshots['TestEdit.test[True-uvloop-data9-TMV-Removed abbreviation TMV] json'] = {
    'abbreviation': '',
    'id': '6116cba1',
    'imported': True,
    'isolates': [
        {
            'default': True,
            'id': 'cab8b360',
            'sequences': [
            ],
            'source_name': '8816-v2',
            'source_type': 'isolate'
        }
    ],
    'issues': {
        'empty_isolate': [
            'cab8b360'
        ],
        'empty_otu': False,
        'empty_sequence': False,
        'isolate_inconsistency': False
    },
    'last_indexed_version': 0,
    'most_recent_change': {
        'created_at': '2015-10-06T20:00:00Z',
        'description': 'Removed abbreviation TMV',
        'id': '6116cba1.1',
        'method_name': 'edit',
        'otu': {
            'id': '6116cba1',
            'name': 'Prunus virus F',
            'version': 1
        },
        'user': {
            'id': 'test'
        }
    },
    'name': 'Prunus virus F',
    'reference': {
        'id': 'hxn167'
    },
    'schema': [
    ],
    'verified': False,
    'version': 1
}

snapshots['TestEdit.test[True-uvloop-data9-TMV-Removed abbreviation TMV] otu'] = {
    '_id': '6116cba1',
    'abbreviation': '',
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

snapshots['test_list_isolates[uvloop-None] json'] = [
    {
        'default': True,
        'id': 'cab8b360',
        'sequences': [
        ],
        'source_name': '8816-v2',
        'source_type': 'isolate'
    },
    {
        'default': False,
        'id': 'bcb9b352',
        'sequences': [
        ],
        'source_name': '7865',
        'source_type': 'isolate'
    }
]

snapshots['TestAddIsolate.test_first[True-uvloop] json'] = {
    'default': True,
    'id': '9pf',
    'sequences': [
    ],
    'source_name': 'b',
    'source_type': 'isolate'
}

snapshots['TestAddIsolate.test_first[True-uvloop] otu'] = {
    '_id': '6116cba1',
    'abbreviation': 'PVF',
    'imported': True,
    'isolates': [
        {
            'default': True,
            'id': '9pf',
            'source_name': 'b',
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

snapshots['TestAddIsolate.test_first[True-uvloop] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Added Isolate b as default',
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
                        'source_name': 'b',
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
        'id': 'test'
    }
}

snapshots['TestAddIsolate.test_force_case[True-uvloop] json'] = {
    'default': False,
    'id': '9pf',
    'sequences': [
    ],
    'source_name': 'Beta',
    'source_type': 'isolate'
}

snapshots['TestAddIsolate.test_force_case[True-uvloop] otu'] = {
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
            'source_name': 'Beta',
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

snapshots['TestAddIsolate.test_force_case[True-uvloop] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Added Isolate Beta',
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
                        'source_name': 'Beta',
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
        'id': 'test'
    }
}

snapshots['TestAddIsolate.test_empty[True-uvloop] json'] = {
    'default': False,
    'id': '9pf',
    'sequences': [
    ],
    'source_name': '',
    'source_type': ''
}

snapshots['TestAddIsolate.test_empty[True-uvloop] otu'] = {
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
            'source_name': '',
            'source_type': ''
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

snapshots['TestAddIsolate.test_empty[True-uvloop] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Added Unnamed Isolate',
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
                        'source_name': '',
                        'source_type': ''
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
        'id': 'test'
    }
}

snapshots['TestEditIsolate.test[True-uvloop-data0-Renamed Isolate b to Variant b] otu'] = {
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
            'id': 'test',
            'source_name': 'b',
            'source_type': 'variant'
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

snapshots['TestEditIsolate.test[True-uvloop-data1-Renamed Isolate b to Variant b] otu'] = {
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
            'id': 'test',
            'source_name': 'b',
            'source_type': 'variant'
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

snapshots['TestEditIsolate.test[True-uvloop-data2-Renamed Isolate b to Variant A] otu'] = {
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
            'id': 'test',
            'source_name': 'A',
            'source_type': 'variant'
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

snapshots['TestEditIsolate.test[True-uvloop-data3-Renamed Isolate b to Isolate A] otu'] = {
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
            'id': 'test',
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

snapshots['TestEditIsolate.test_force_case[True-uvloop] otu'] = {
    '_id': '6116cba1',
    'abbreviation': 'PVF',
    'imported': True,
    'isolates': [
        {
            'default': True,
            'id': 'cab8b360',
            'source_name': '8816-v2',
            'source_type': 'variant'
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

snapshots['TestSetAsDefault.test[True-uvloop] json'] = {
    'default': True,
    'id': 'test',
    'sequences': [
    ],
    'source_name': 'b',
    'source_type': 'isolate'
}

snapshots['TestRemoveIsolate.test_change_default[True-uvloop] otu'] = {
    '_id': '6116cba1',
    'abbreviation': 'PVF',
    'imported': True,
    'isolates': [
        {
            'default': True,
            'id': 'bcb9b352',
            'source_name': '7865',
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

snapshots['TestRemoveIsolate.test_change_default[True-uvloop] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Removed Isolate 8816-v2 and set Isolate 7865 as default',
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
                'bcb9b352'
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
                '7865'
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
                        'id': 'bcb9b352',
                        'sequences': [
                        ],
                        'source_name': '7865',
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
        'id': 'test'
    }
}

snapshots['test_list_sequences[uvloop-None] json'] = [
    {
        'definition': 'Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene, complete cds.',
        'host': 'sweet cherry',
        'id': 'KX269872',
        'segment': None,
        'sequence': 'TGTTTAAGAGATTAAACAACCGCTTTC'
    }
]

snapshots['test_get_sequence[uvloop-None] json'] = {
    'definition': 'Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene, complete cds.',
    'host': 'sweet cherry',
    'id': 'KX269872',
    'isolate_id': 'cab8b360',
    'otu_id': '6116cba1',
    'segment': None,
    'sequence': 'TGTTTAAGAGATTAAACAACCGCTTTC'
}

snapshots['test_create_sequence[True-uvloop-None] json'] = {
    'accession': 'foobar',
    'definition': 'A made up sequence',
    'host': 'Plant',
    'id': '9pfsom1b',
    'isolate_id': 'cab8b360',
    'otu_id': '6116cba1',
    'reference': {
        'id': 'hxn167'
    },
    'segment': None,
    'sequence': 'ATGCGTGTACTG'
}

snapshots['test_create_sequence[True-uvloop-None] otu'] = {
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

snapshots['test_create_sequence[True-uvloop-None] sequence'] = {
    '_id': '9pfsom1b',
    'accession': 'foobar',
    'definition': 'A made up sequence',
    'host': 'Plant',
    'isolate_id': 'cab8b360',
    'otu_id': '6116cba1',
    'reference': {
        'id': 'hxn167'
    },
    'segment': None,
    'sequence': 'ATGCGTGTACTG'
}

snapshots['test_create_sequence[True-uvloop-None] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Created new sequence foobar in Isolate 8816-v2',
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
            [
                'isolates',
                0,
                'sequences'
            ],
            [
                [
                    0,
                    {
                        '_id': '9pfsom1b',
                        'accession': 'foobar',
                        'definition': 'A made up sequence',
                        'host': 'Plant',
                        'isolate_id': 'cab8b360',
                        'otu_id': '6116cba1',
                        'reference': {
                            'id': 'hxn167'
                        },
                        'segment': None,
                        'sequence': 'ATGCGTGTACTG'
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
    'method_name': 'create_sequence',
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

snapshots['test_edit_sequence[True-uvloop-None] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Edited sequence KX269872 in Isolate 8816-v2',
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
                'sequences',
                0,
                'definition'
            ],
            [
                'Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene, complete cds.',
                'A made up sequence'
            ]
        ],
        [
            'change',
            [
                'isolates',
                0,
                'sequences',
                0,
                'host'
            ],
            [
                'sweet cherry',
                'Grapevine'
            ]
        ],
        [
            'change',
            [
                'isolates',
                0,
                'sequences',
                0,
                'sequence'
            ],
            [
                'TGTTTAAGAGATTAAACAACCGCTTTC',
                'ATGCGTGTACTG'
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
    'method_name': 'edit_sequence',
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

snapshots['test_edit_sequence[True-uvloop-None] otu'] = {
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

snapshots['test_edit_sequence[True-uvloop-None] sequence'] = {
    '_id': 'KX269872',
    'definition': 'A made up sequence',
    'host': 'Grapevine',
    'isolate_id': 'cab8b360',
    'otu_id': '6116cba1',
    'segment': None,
    'sequence': 'ATGCGTGTACTG'
}

snapshots['test_remove_sequence[True-uvloop-None] otu'] = {
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
    'verified': False,
    'version': 1
}

snapshots['test_remove_sequence[True-uvloop-None] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Removed sequence KX269872 from Isolate 8816-v2',
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
        ]
    ],
    'index': {
        'id': 'unbuilt',
        'version': 'unbuilt'
    },
    'method_name': 'remove_sequence',
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

snapshots['test_edit_sequence[True-uvloop-None] json'] = {
    'definition': 'A made up sequence',
    'host': 'Grapevine',
    'id': 'KX269872',
    'isolate_id': 'cab8b360',
    'otu_id': '6116cba1',
    'segment': None,
    'sequence': 'ATGCGTGTACTG'
}

snapshots['TestAddIsolate.test_default[True-uvloop-True] json'] = {
    'default': True,
    'id': '9pf',
    'sequences': [
    ],
    'source_name': 'b',
    'source_type': 'isolate'
}

snapshots['TestAddIsolate.test_default[True-uvloop-True] otu'] = {
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
            'source_name': 'b',
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

snapshots['TestAddIsolate.test_default[True-uvloop-True] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Added Isolate b as default',
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
                        'source_name': 'b',
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
        'id': 'test'
    }
}

snapshots['TestAddIsolate.test_default[True-uvloop-False] json'] = {
    'default': False,
    'id': '9pf',
    'sequences': [
    ],
    'source_name': 'b',
    'source_type': 'isolate'
}

snapshots['TestAddIsolate.test_default[True-uvloop-False] otu'] = {
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
            'source_name': 'b',
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

snapshots['TestAddIsolate.test_default[True-uvloop-False] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Added Isolate b',
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
                        'source_name': 'b',
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
        'id': 'test'
    }
}

snapshots['TestRemoveIsolate.test[True-uvloop] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Removed Isolate 8816-v2',
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
                    0,
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
        'id': 'test'
    }
}
