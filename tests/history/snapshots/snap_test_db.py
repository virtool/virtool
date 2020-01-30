# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import GenericRepr, Snapshot


snapshots = Snapshot()

snapshots['test_patch_to_version[uvloop-True] 1'] = None

snapshots['test_patch_to_version[uvloop-True] 2'] = {
    '_id': '6116cba1',
    'abbreviation': 'TST',
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
    'version': 1
}

snapshots['test_patch_to_version[uvloop-True] 3'] = [
    '6116cba1.removed',
    '6116cba1.3',
    '6116cba1.2'
]

snapshots['test_patch_to_version[uvloop-False] 1'] = {
    '_id': '6116cba1',
    'abbreviation': 'TST',
    'imported': True,
    'isolates': [
    ],
    'last_indexed_version': 0,
    'lower_name': 'prunus virus f',
    'name': 'Test Virus',
    'reference': {
        'id': 'hxn167'
    },
    'schema': [
    ],
    'verified': False,
    'version': 3
}

snapshots['test_patch_to_version[uvloop-False] 2'] = {
    '_id': '6116cba1',
    'abbreviation': 'TST',
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
    'version': 1
}

snapshots['test_patch_to_version[uvloop-False] 3'] = [
    '6116cba1.3',
    '6116cba1.2'
]

snapshots['TestAdd.test[uvloop] change'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Edited Prunus virus E',
    'diff': [
        (
            'change',
            'abbreviation',
            (
                'PVF',
                ''
            )
        ),
        (
            'change',
            'name',
            (
                'Prunus virus F',
                'Prunus virus E'
            )
        ),
        (
            'change',
            'version',
            (
                0,
                1
            )
        )
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

snapshots['TestAdd.test[uvloop] document'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
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

snapshots['TestAdd.test_create[uvloop] 1'] = {
    '_id': '6116cba1.0',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Created Prunus virus F',
    'diff': {
        '_id': '6116cba1',
        'abbreviation': 'PVF',
        'imported': True,
        'isolates': [
            {
                'default': True,
                'isolate_id': 'cab8b360',
                'sequences': [
                    {
                        '_id': 'KX269872',
                        'definition': 'Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene, complete cds.',
                        'host': 'sweet cherry',
                        'isolate_id': 'cab8b360',
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
}

snapshots['TestAdd.test_create[uvloop] 2'] = {
    '_id': '6116cba1.0',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Created Prunus virus F',
    'diff': {
        '_id': '6116cba1',
        'abbreviation': 'PVF',
        'imported': True,
        'isolates': [
            {
                'default': True,
                'isolate_id': 'cab8b360',
                'sequences': [
                    {
                        '_id': 'KX269872',
                        'definition': 'Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene, complete cds.',
                        'host': 'sweet cherry',
                        'isolate_id': 'cab8b360',
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
}

snapshots['TestAdd.test_remove[uvloop] 1'] = {
    '_id': '6116cba1.removed',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Removed Prunus virus F',
    'diff': {
        '_id': '6116cba1',
        'abbreviation': 'PVF',
        'imported': True,
        'isolates': [
            {
                'default': True,
                'isolate_id': 'cab8b360',
                'sequences': [
                    {
                        '_id': 'KX269872',
                        'definition': 'Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene, complete cds.',
                        'host': 'sweet cherry',
                        'isolate_id': 'cab8b360',
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

snapshots['TestAdd.test_remove[uvloop] 2'] = {
    '_id': '6116cba1.removed',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Removed Prunus virus F',
    'diff': {
        '_id': '6116cba1',
        'abbreviation': 'PVF',
        'imported': True,
        'isolates': [
            {
                'default': True,
                'isolate_id': 'cab8b360',
                'sequences': [
                    {
                        '_id': 'KX269872',
                        'definition': 'Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene, complete cds.',
                        'host': 'sweet cherry',
                        'isolate_id': 'cab8b360',
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

snapshots['test_get_most_recent_change[uvloop-True] 1'] = {
    '_id': '6116cba1.2',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Description number 2',
    'method_name': 'update',
    'otu': {
        'id': '6116cba1',
        'name': 'Prunus virus F',
        'version': 2
    },
    'user': {
        'id': 'test'
    }
}

snapshots['test_get_most_recent_change[uvloop-False] 1'] = None
