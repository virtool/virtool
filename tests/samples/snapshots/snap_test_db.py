# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


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

snapshots['test_move_sample_files_task[uvloop-False-False] 1'] = {
    '_id': 'foo',
    'is_compressed': False,
    'is_legacy': False
}

snapshots['test_move_sample_files_task[uvloop-True-True] 1'] = {
    '_id': 'foo',
    'is_compressed': True,
    'is_legacy': True
}

snapshots['test_move_sample_files_task[uvloop-True-False] 1'] = {
    '_id': 'foo',
    'files': [
        {
            'download_url': '/download/samples/oictwh/reads_1.fq.gz',
            'from': {
                'id': 'vorbsrmz-17TFP120_S21_R1_001.fastq.gz',
                'name': 'vorbsrmz-17TFP120_S21_R1_001.fastq.gz',
                'size': 239801249712,
                'uploaded_at': None
            },
            'name': 'reads_1.fq.gz',
            'raw': True,
            'size': 213889231
        }
    ],
    'is_compressed': False,
    'is_legacy': True
}
