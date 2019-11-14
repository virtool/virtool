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

snapshots['TestCreate.test[True-uvloop-None-True] response'] = {
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

snapshots['TestCreate.test[True-uvloop-TMV-True] response'] = {
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

snapshots['TestCreate.test[True-uvloop-True] response'] = {
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

snapshots['TestSetAsDefault.test[True-uvloop] response'] = {
    'default': True,
    'id': 'test',
    'sequences': [
    ],
    'source_name': 'b',
    'source_type': 'isolate'
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
