# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['test_create_fake_otus[uvloop] otus'] = [
    {
        '_id': '2x6YnyMt',
        'abbreviation': 'ABTV',
        'isolates': [
            {
                'default': True,
                'id': 'c2uyoYJd',
                'source_name': 'A',
                'source_type': 'Isolate'
            }
        ],
        'last_indexed_version': None,
        'lower_name': 'abaca bunchy top virus',
        'name': 'Abaca bunchy top virus',
        'reference': {
            'id': 'reference_1'
        },
        'schema': [
        ],
        'verified': True,
        'version': 6
    },
    {
        '_id': '7a1B1KtN',
        'abbreviation': 'ASPV',
        'isolates': [
            {
                'default': True,
                'id': '902DuXz1',
                'source_name': 'Z',
                'source_type': 'Isolate'
            }
        ],
        'last_indexed_version': None,
        'lower_name': 'apple stem pitting virus',
        'name': 'Apple stem pitting virus',
        'reference': {
            'id': 'reference_1'
        },
        'schema': [
        ],
        'verified': True,
        'version': 2
    },
    {
        '_id': '4IR34Chh',
        'abbreviation': 'TMV',
        'isolates': [
            {
                'default': True,
                'id': '9xFfqLFw',
                'source_name': '1',
                'source_type': 'Isolate'
            },
            {
                'default': False,
                'id': '8l0bRaiq',
                'source_name': '2',
                'source_type': 'Isolate'
            }
        ],
        'last_indexed_version': None,
        'lower_name': 'tobacco mosaic virus',
        'name': 'Tobacco mosaic virus',
        'reference': {
            'id': 'reference_1'
        },
        'schema': [
        ],
        'verified': True,
        'version': 4
    },
    {
        '_id': '7Rsub0Ci',
        'abbreviation': 'LChV1',
        'isolates': [
            {
                'default': True,
                'id': '3R8uwP00',
                'source_name': 'A',
                'source_type': 'Isolate'
            },
            {
                'default': False,
                'id': '2d79qUCq',
                'source_name': 'B',
                'source_type': 'Isolate'
            },
            {
                'default': False,
                'id': '90Izf7jv',
                'source_name': 'C',
                'source_type': 'Isolate'
            }
        ],
        'last_indexed_version': None,
        'lower_name': 'little cherry virus 1',
        'name': 'Little cherry virus 1',
        'reference': {
            'id': 'reference_1'
        },
        'schema': [
        ],
        'verified': True,
        'version': 6
    }
]

snapshots['test_create_fake_otus[uvloop] sequences'] = [
    {
        '_id': '5NxTrGkY',
        'accession': 'foo',
        'definition': 'ABTV sequence 1',
        'host': '',
        'isolate_id': 'c2uyoYJd',
        'otu_id': '2x6YnyMt',
        'reference': {
            'id': 'reference_1'
        },
        'segment': None,
        'sequence': 'ATGAGAGACACATAG'
    },
    {
        '_id': 'p0Th3uDp',
        'accession': 'foo',
        'definition': 'ABTV sequence 2',
        'host': '',
        'isolate_id': 'c2uyoYJd',
        'otu_id': '2x6YnyMt',
        'reference': {
            'id': 'reference_1'
        },
        'segment': None,
        'sequence': 'ATGAGAGACACATAG'
    },
    {
        '_id': 'z1IIKKvq',
        'accession': 'foo',
        'definition': 'ABTV sequence 3',
        'host': '',
        'isolate_id': 'c2uyoYJd',
        'otu_id': '2x6YnyMt',
        'reference': {
            'id': 'reference_1'
        },
        'segment': None,
        'sequence': 'ATGAGAGACACATAG'
    },
    {
        '_id': '9Zmo2yG4',
        'accession': 'foo',
        'definition': 'ABTV sequence 4',
        'host': '',
        'isolate_id': 'c2uyoYJd',
        'otu_id': '2x6YnyMt',
        'reference': {
            'id': 'reference_1'
        },
        'segment': None,
        'sequence': 'ATGAGAGACACATAG'
    },
    {
        '_id': 'pWWE8Vpm',
        'accession': 'foo',
        'definition': 'ABTV sequence 5',
        'host': '',
        'isolate_id': 'c2uyoYJd',
        'otu_id': '2x6YnyMt',
        'reference': {
            'id': 'reference_1'
        },
        'segment': None,
        'sequence': 'ATGAGAGACACATAG'
    },
    {
        '_id': '1LxB7Ddw',
        'accession': 'bar',
        'definition': 'ASPV sequence 1',
        'host': '',
        'isolate_id': '902DuXz1',
        'otu_id': '7a1B1KtN',
        'reference': {
            'id': 'reference_1'
        },
        'segment': None,
        'sequence': 'ATGAGAGACACATAG'
    },
    {
        '_id': 't7ueOV9n',
        'accession': 'bar',
        'definition': 'TMV sequence 1',
        'host': '',
        'isolate_id': '9xFfqLFw',
        'otu_id': '4IR34Chh',
        'reference': {
            'id': 'reference_1'
        },
        'segment': None,
        'sequence': 'ATGAGAGACACATAG'
    },
    {
        '_id': '6BUEdNcZ',
        'accession': 'baz',
        'definition': 'TMV sequence 1',
        'host': '',
        'isolate_id': '8l0bRaiq',
        'otu_id': '4IR34Chh',
        'reference': {
            'id': 'reference_1'
        },
        'segment': None,
        'sequence': 'ATGAGAGACACATAG'
    },
    {
        '_id': 'C1gBTvcu',
        'accession': 'bar',
        'definition': 'LChV1 sequence 1',
        'host': '',
        'isolate_id': '3R8uwP00',
        'otu_id': '7Rsub0Ci',
        'reference': {
            'id': 'reference_1'
        },
        'segment': None,
        'sequence': 'ATGAGAGACACATAG'
    },
    {
        '_id': '7UCa0nKm',
        'accession': 'baz',
        'definition': 'LChV1 sequence 1',
        'host': '',
        'isolate_id': '2d79qUCq',
        'otu_id': '7Rsub0Ci',
        'reference': {
            'id': 'reference_1'
        },
        'segment': None,
        'sequence': 'ATGAGAGACACATAG'
    },
    {
        '_id': 'I4YTKnMk',
        'accession': 'bat',
        'definition': 'LChV1 sequence 1',
        'host': '',
        'isolate_id': '90Izf7jv',
        'otu_id': '7Rsub0Ci',
        'reference': {
            'id': 'reference_1'
        },
        'segment': None,
        'sequence': 'ATGAGAGACACATAG'
    }
]
