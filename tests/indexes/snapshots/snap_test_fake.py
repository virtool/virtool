# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import GenericRepr, Snapshot


snapshots = Snapshot()

snapshots['test_create_fake_indexes[uvloop] indexes'] = [
    {
        '_id': '2x6YnyMt',
        'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
        'files': [
        ],
        'has_files': True,
        'has_json': False,
        'job': {
            'id': 'foo'
        },
        'manifest': {
        },
        'ready': True,
        'reference': {
            'id': 'reference_1'
        },
        'user': {
            'id': 'bob'
        },
        'version': 0
    }
]

snapshots['test_create_fake_indexes[uvloop] index_files'] = [
    GenericRepr('<IndexFile(id=1, name=reference.fa.gz, index=2x6YnyMt, type=fasta, size=None'),
    GenericRepr('<IndexFile(id=2, name=reference.1.bt2, index=2x6YnyMt, type=bowtie2, size=None'),
    GenericRepr('<IndexFile(id=3, name=reference.2.bt2, index=2x6YnyMt, type=bowtie2, size=None'),
    GenericRepr('<IndexFile(id=4, name=reference.3.bt2, index=2x6YnyMt, type=bowtie2, size=None'),
    GenericRepr('<IndexFile(id=5, name=reference.4.bt2, index=2x6YnyMt, type=bowtie2, size=None'),
    GenericRepr('<IndexFile(id=6, name=reference.rev.1.bt2, index=2x6YnyMt, type=bowtie2, size=None'),
    GenericRepr('<IndexFile(id=7, name=reference.rev.2.bt2, index=2x6YnyMt, type=bowtie2, size=None')
]
