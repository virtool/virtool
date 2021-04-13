# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import GenericRepr, Snapshot


snapshots = Snapshot()

snapshots['test_edit[uvloop-None] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Changed name to Foo Virus',
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
                'foo virus'
            ]
        ],
        [
            'change',
            'name',
            [
                'Prunus virus F',
                'Foo Virus'
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
        'id': 'bob'
    }
}

snapshots['test_edit[uvloop-None] otu'] = {
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
    'lower_name': 'foo virus',
    'name': 'Foo Virus',
    'reference': {
        'id': 'hxn167'
    },
    'schema': [
    ],
    'verified': False,
    'version': 1
}

snapshots['test_edit[uvloop-TMV] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Changed name to Foo Virus and changed abbreviation to TMV',
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
                'foo virus'
            ]
        ],
        [
            'change',
            'name',
            [
                'Prunus virus F',
                'Foo Virus'
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
        'id': 'bob'
    }
}

snapshots['test_edit[uvloop-TMV] otu'] = {
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
    'lower_name': 'foo virus',
    'name': 'Foo Virus',
    'reference': {
        'id': 'hxn167'
    },
    'schema': [
    ],
    'verified': False,
    'version': 1
}

snapshots['test_edit[uvloop-] otu'] = {
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
    'lower_name': 'foo virus',
    'name': 'Foo Virus',
    'reference': {
        'id': 'hxn167'
    },
    'schema': [
    ],
    'verified': False,
    'version': 1
}

snapshots['test_edit[uvloop-] history'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Changed name to Foo Virus and removed abbreviation PVF',
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
                ''
            ]
        ],
        [
            'change',
            'lower_name',
            [
                'prunus virus f',
                'foo virus'
            ]
        ],
        [
            'change',
            'name',
            [
                'Prunus virus F',
                'Foo Virus'
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
        'id': 'bob'
    }
}

snapshots['test_create_otu[uvloop--TMV] otu'] = {
    '_id': 'TMV',
    'abbreviation': '',
    'isolates': [
    ],
    'last_indexed_version': None,
    'lower_name': 'bar',
    'name': 'Bar',
    'reference': {
        'id': 'foo'
    },
    'schema': [
    ],
    'verified': False,
    'version': 0
}

snapshots['test_create_otu[uvloop--TMV] history'] = {
    '_id': 'TMV.0',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Created Bar',
    'diff': {
        '_id': 'TMV',
        'abbreviation': '',
        'isolates': [
        ],
        'last_indexed_version': None,
        'lower_name': 'bar',
        'name': 'Bar',
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
        'id': 'TMV',
        'name': 'Bar',
        'version': 0
    },
    'reference': {
        'id': 'foo'
    },
    'user': {
        'id': 'bob'
    }
}

snapshots['test_create_otu[uvloop-None-otu] otu'] = {
    '_id': 'otu',
    'abbreviation': None,
    'isolates': [
    ],
    'last_indexed_version': None,
    'lower_name': 'bar',
    'name': 'Bar',
    'reference': {
        'id': 'foo'
    },
    'schema': [
    ],
    'verified': False,
    'version': 0
}

snapshots['test_create_otu[uvloop-None-otu] history'] = {
    '_id': 'otu.0',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Created Bar',
    'diff': {
        '_id': 'otu',
        'abbreviation': None,
        'isolates': [
        ],
        'last_indexed_version': None,
        'lower_name': 'bar',
        'name': 'Bar',
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
        'id': 'otu',
        'name': 'Bar',
        'version': 0
    },
    'reference': {
        'id': 'foo'
    },
    'user': {
        'id': 'bob'
    }
}
