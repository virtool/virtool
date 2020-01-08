# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


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
