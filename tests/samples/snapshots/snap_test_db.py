# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['test_compress_reads[uvloop-True] 1'] = {
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

snapshots['test_compress_reads[uvloop-False] 1'] = {
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
