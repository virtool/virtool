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

snapshots['test_move_sample_files_task[uvloop-True-True-True] 1'] = {
    '_id': 'foo',
    'is_compressed': True,
    'is_legacy': True
}

snapshots['test_move_sample_files_task[uvloop-True-True-False] 1'] = {
    '_id': 'foo',
    'is_compressed': True,
    'is_legacy': False
}

snapshots['test_move_sample_files_task[uvloop-True-False-True] 1'] = {
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
        },
        {
            'download_url': '/download/samples/oictwh/reads_2.fq.gz',
            'from': {
                'id': 'vorbsrmz-17TFP120_S21_R1_002.fastq.gz',
                'name': 'vorbsrmz-17TFP120_S21_R1_002.fastq.gz',
                'size': 239801249712,
                'uploaded_at': None
            },
            'name': 'reads_2.fq.gz',
            'raw': True,
            'size': 213889231
        }
    ],
    'is_compressed': False,
    'is_legacy': True
}

snapshots['test_move_sample_files_task[uvloop-True-False-False] 1'] = {
    '_id': 'foo',
    'is_compressed': False,
    'is_legacy': False
}

snapshots['test_move_sample_files_task[uvloop-False-True-True] 1'] = {
    '_id': 'foo',
    'is_compressed': True,
    'is_legacy': True
}

snapshots['test_move_sample_files_task[uvloop-False-True-False] 1'] = {
    '_id': 'foo',
    'is_compressed': True,
    'is_legacy': False
}

snapshots['test_move_sample_files_task[uvloop-False-False-True] 1'] = {
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

snapshots['test_move_sample_files_task[uvloop-False-False-False] 1'] = {
    '_id': 'foo',
    'is_compressed': False,
    'is_legacy': False
}

snapshots['test_create_sample[uvloop] 1'] = {
    '_id': 'a2oj3gfd',
    'all_read': None,
    'all_write': None,
    'artifacts': [
    ],
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'files': [
    ],
    'format': 'fastq',
    'group': None,
    'group_read': None,
    'group_write': None,
    'hold': True,
    'host': None,
    'is_legacy': False,
    'isolate': None,
    'labels': [
    ],
    'library_type': None,
    'name': 'foo',
    'notes': '',
    'nuvs': False,
    'paired': None,
    'pathoscope': False,
    'quality': None,
    'reads': [
    ],
    'ready': False,
    'subtractions': [
    ],
    'user': {
        'id': 'bob'
    }
}
