# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import GenericRepr, Snapshot


snapshots = Snapshot()

snapshots['test_compress_sample_reads[uvloop-True] 1'] = {
    '_id': 'foo',
    'files': [
        {
            'download_url': '/download/samples/foo/reads_1.fq.gz',
            'from': {
                'id': 'M_S11_R1_001.fastq',
                'name': 'M_S11_R1_001.fastq',
                'size': 3750821789
            },
            'name': 'reads_1.fq.gz',
            'raw': False,
            'size': 6586501
        },
        {
            'download_url': '/download/samples/foo/reads_2.fq.gz',
            'from': {
                'id': 'M_S11_R1_001.fastq',
                'name': 'M_S11_R1_001.fastq',
                'size': 3750821789
            },
            'name': 'reads_2.fq.gz',
            'raw': False,
            'size': 6586501
        }
    ],
    'paired': True
}

snapshots['test_compress_sample_reads[uvloop-False] 1'] = {
    '_id': 'foo',
    'files': [
        {
            'download_url': '/download/samples/foo/reads_1.fq.gz',
            'from': {
                'id': 'M_S11_R1_001.fastq',
                'name': 'M_S11_R1_001.fastq',
                'size': 3750821789
            },
            'name': 'reads_1.fq.gz',
            'raw': False,
            'size': 6586501
        }
    ],
    'paired': False
}

snapshots['test_create_sample[uvloop] 1'] = {
    '_id': 'a2oj3gfd',
    'all_read': True,
    'all_write': False,
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'format': 'fastq',
    'group': '',
    'group_read': True,
    'group_write': False,
    'hold': True,
    'host': '',
    'is_legacy': False,
    'isolate': '',
    'labels': [
    ],
    'library_type': '',
    'locale': '',
    'name': 'foo',
    'notes': 'test',
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
