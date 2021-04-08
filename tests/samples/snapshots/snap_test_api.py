# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import GenericRepr, Snapshot


snapshots = Snapshot()

snapshots['test_get[uvloop-True-None] 1'] = {
    'artifacts': [
        {
            'id': 1,
            'name': 'reference.fa.gz',
            'name_on_disk': None,
            'sample': 'test',
            'size': None,
            'type': 'fasta',
            'uploaded_at': None
        }
    ],
    'caches': [
    ],
    'created_at': '2015-10-06T20:00:00Z',
    'files': [
        {
            'download_url': '/download/samples/files/file_1.fq.gz',
            'id': 'foo',
            'name': 'Bar.fq.gz'
        }
    ],
    'id': 'test',
    'labels': [
        {
            'color': '#a83432',
            'description': 'This is a bug',
            'id': 1,
            'name': 'Bug'
        }
    ],
    'name': 'Test',
    'reads': [
        {
            'download_url': '/api/samples/test/reads/reads_1.fq.gz',
            'id': 1,
            'name': 'reads_1.fq.gz',
            'name_on_disk': 'reads_1.fq.gz',
            'sample': 'test',
            'size': None,
            'upload': {
                'created_at': None,
                'id': 1,
                'name': 'test',
                'name_on_disk': None,
                'ready': False,
                'removed': False,
                'removed_at': None,
                'reserved': False,
                'size': None,
                'type': None,
                'uploaded_at': None,
                'user': None
            },
            'uploaded_at': None
        }
    ],
    'ready': True,
    'subtractions': [
        {
            'id': 'foo',
            'name': 'Foo'
        },
        {
            'id': 'bar',
            'name': 'Bar'
        }
    ]
}

snapshots['test_get[uvloop-False-None] 1'] = {
    'artifacts': [
        {
            'id': 1,
            'name': 'reference.fa.gz',
            'name_on_disk': None,
            'sample': 'test',
            'size': None,
            'type': 'fasta',
            'uploaded_at': None
        }
    ],
    'caches': [
    ],
    'created_at': '2015-10-06T20:00:00Z',
    'files': [
        {
            'download_url': '/download/samples/files/file_1.fq.gz',
            'id': 'foo',
            'name': 'Bar.fq.gz'
        }
    ],
    'id': 'test',
    'labels': [
        {
            'color': '#a83432',
            'description': 'This is a bug',
            'id': 1,
            'name': 'Bug'
        }
    ],
    'name': 'Test',
    'reads': [
        {
            'id': 1,
            'name': 'reads_1.fq.gz',
            'name_on_disk': 'reads_1.fq.gz',
            'sample': 'test',
            'size': None,
            'upload': {
                'created_at': None,
                'id': 1,
                'name': 'test',
                'name_on_disk': None,
                'ready': False,
                'removed': False,
                'removed_at': None,
                'reserved': False,
                'size': None,
                'type': None,
                'uploaded_at': None,
                'user': None
            },
            'uploaded_at': None
        }
    ],
    'ready': False,
    'subtractions': [
        {
            'id': 'foo',
            'name': 'Foo'
        },
        {
            'id': 'bar',
            'name': 'Bar'
        }
    ]
}

snapshots['test_find_analyses[uvloop-None-None] 1'] = {
    'documents': [
        {
            'created_at': '2015-10-06T20:00:00Z',
            'id': 'test_1',
            'index': {
                'id': 'foo',
                'version': 2
            },
            'job': {
                'id': 'test'
            },
            'ready': True,
            'reference': {
                'id': 'baz',
                'name': 'Baz'
            },
            'sample': {
                'id': 'test'
            },
            'user': {
                'id': 'bob'
            },
            'workflow': 'pathoscope_bowtie'
        },
        {
            'created_at': '2015-10-06T20:00:00Z',
            'id': 'test_2',
            'index': {
                'id': 'foo',
                'version': 2
            },
            'job': {
                'id': 'test'
            },
            'ready': True,
            'reference': {
                'id': 'baz',
                'name': 'Baz'
            },
            'sample': {
                'id': 'test'
            },
            'user': {
                'id': 'fred'
            },
            'workflow': 'pathoscope_bowtie'
        },
        {
            'created_at': '2015-10-06T20:00:00Z',
            'id': 'test_3',
            'index': {
                'id': 'foo',
                'version': 2
            },
            'job': {
                'id': 'test'
            },
            'ready': True,
            'reference': {
                'id': 'foo',
                'name': 'Foo'
            },
            'sample': {
                'id': 'test'
            },
            'user': {
                'id': 'fred'
            },
            'workflow': 'pathoscope_bowtie'
        }
    ],
    'found_count': 3,
    'page': 1,
    'page_count': 1,
    'per_page': 25,
    'total_count': 3
}

snapshots['test_find_analyses[uvloop-bob-None] 1'] = {
    'documents': [
        {
            'created_at': '2015-10-06T20:00:00Z',
            'id': 'test_1',
            'index': {
                'id': 'foo',
                'version': 2
            },
            'job': {
                'id': 'test'
            },
            'ready': True,
            'reference': {
                'id': 'baz',
                'name': 'Baz'
            },
            'sample': {
                'id': 'test'
            },
            'user': {
                'id': 'bob'
            },
            'workflow': 'pathoscope_bowtie'
        }
    ],
    'found_count': 1,
    'page': 1,
    'page_count': 1,
    'per_page': 25,
    'total_count': 3
}

snapshots['test_find_analyses[uvloop-Baz-None] 1'] = {
    'documents': [
        {
            'created_at': '2015-10-06T20:00:00Z',
            'id': 'test_1',
            'index': {
                'id': 'foo',
                'version': 2
            },
            'job': {
                'id': 'test'
            },
            'ready': True,
            'reference': {
                'id': 'baz',
                'name': 'Baz'
            },
            'sample': {
                'id': 'test'
            },
            'user': {
                'id': 'bob'
            },
            'workflow': 'pathoscope_bowtie'
        },
        {
            'created_at': '2015-10-06T20:00:00Z',
            'id': 'test_2',
            'index': {
                'id': 'foo',
                'version': 2
            },
            'job': {
                'id': 'test'
            },
            'ready': True,
            'reference': {
                'id': 'baz',
                'name': 'Baz'
            },
            'sample': {
                'id': 'test'
            },
            'user': {
                'id': 'fred'
            },
            'workflow': 'pathoscope_bowtie'
        }
    ],
    'found_count': 2,
    'page': 1,
    'page_count': 1,
    'per_page': 25,
    'total_count': 3
}

snapshots['test_find[uvloop-None-None-None-None-d_range0-meta0] 1'] = {
    'documents': [
        {
            'created_at': '2015-10-06T22:00:00Z',
            'host': '',
            'id': 'cb400e6d',
            'isolate': '',
            'labels': [
                {
                    'color': '#0d321d',
                    'description': 'This is a question',
                    'id': 3,
                    'name': 'Question'
                }
            ],
            'name': '16SPP044',
            'nuvs': False,
            'pathoscope': False,
            'ready': True,
            'user': {
                'id': 'fred'
            }
        },
        {
            'created_at': '2015-10-06T21:00:00Z',
            'host': '',
            'id': 'beb1eb10',
            'isolate': 'Thing',
            'labels': [
                {
                    'color': '#a83432',
                    'description': 'This is a bug',
                    'id': 1,
                    'name': 'Bug'
                },
                {
                    'color': '#03fc20',
                    'description': 'This is a info',
                    'id': 2,
                    'name': 'Info'
                }
            ],
            'name': '16GVP042',
            'nuvs': False,
            'pathoscope': False,
            'ready': True,
            'user': {
                'id': 'bob'
            }
        },
        {
            'created_at': '2015-10-06T20:00:00Z',
            'host': '',
            'id': '72bb8b31',
            'isolate': 'Test',
            'labels': [
                {
                    'color': '#a83432',
                    'description': 'This is a bug',
                    'id': 1,
                    'name': 'Bug'
                }
            ],
            'name': '16GVP043',
            'nuvs': False,
            'pathoscope': False,
            'ready': True,
            'user': {
                'id': 'fred'
            }
        }
    ],
    'found_count': 3,
    'page': 1,
    'page_count': 1,
    'per_page': 25,
    'total_count': 3
}

snapshots['test_find[uvloop-None-None-None-label_filter1-d_range1-meta1] 1'] = {
    'documents': [
    ],
    'found_count': 0,
    'page': 1,
    'page_count': 0,
    'per_page': 25,
    'total_count': 3
}

snapshots['test_find[uvloop-None-2-1-None-d_range2-meta2] 1'] = {
    'documents': [
        {
            'created_at': '2015-10-06T22:00:00Z',
            'host': '',
            'id': 'cb400e6d',
            'isolate': '',
            'labels': [
                {
                    'color': '#0d321d',
                    'description': 'This is a question',
                    'id': 3,
                    'name': 'Question'
                }
            ],
            'name': '16SPP044',
            'nuvs': False,
            'pathoscope': False,
            'ready': True,
            'user': {
                'id': 'fred'
            }
        },
        {
            'created_at': '2015-10-06T21:00:00Z',
            'host': '',
            'id': 'beb1eb10',
            'isolate': 'Thing',
            'labels': [
                {
                    'color': '#a83432',
                    'description': 'This is a bug',
                    'id': 1,
                    'name': 'Bug'
                },
                {
                    'color': '#03fc20',
                    'description': 'This is a info',
                    'id': 2,
                    'name': 'Info'
                }
            ],
            'name': '16GVP042',
            'nuvs': False,
            'pathoscope': False,
            'ready': True,
            'user': {
                'id': 'bob'
            }
        }
    ],
    'found_count': 3,
    'page': 1,
    'page_count': 2,
    'per_page': 2,
    'total_count': 3
}

snapshots['test_find[uvloop-None-2-2-None-d_range3-meta3] 1'] = {
    'documents': [
        {
            'created_at': '2015-10-06T20:00:00Z',
            'host': '',
            'id': '72bb8b31',
            'isolate': 'Test',
            'labels': [
                {
                    'color': '#a83432',
                    'description': 'This is a bug',
                    'id': 1,
                    'name': 'Bug'
                }
            ],
            'name': '16GVP043',
            'nuvs': False,
            'pathoscope': False,
            'ready': True,
            'user': {
                'id': 'fred'
            }
        }
    ],
    'found_count': 3,
    'page': 2,
    'page_count': 2,
    'per_page': 2,
    'total_count': 3
}

snapshots['test_find[uvloop-gv-None-None-None-d_range4-meta4] 1'] = {
    'documents': [
        {
            'created_at': '2015-10-06T21:00:00Z',
            'host': '',
            'id': 'beb1eb10',
            'isolate': 'Thing',
            'labels': [
                {
                    'color': '#a83432',
                    'description': 'This is a bug',
                    'id': 1,
                    'name': 'Bug'
                },
                {
                    'color': '#03fc20',
                    'description': 'This is a info',
                    'id': 2,
                    'name': 'Info'
                }
            ],
            'name': '16GVP042',
            'nuvs': False,
            'pathoscope': False,
            'ready': True,
            'user': {
                'id': 'bob'
            }
        },
        {
            'created_at': '2015-10-06T20:00:00Z',
            'host': '',
            'id': '72bb8b31',
            'isolate': 'Test',
            'labels': [
                {
                    'color': '#a83432',
                    'description': 'This is a bug',
                    'id': 1,
                    'name': 'Bug'
                }
            ],
            'name': '16GVP043',
            'nuvs': False,
            'pathoscope': False,
            'ready': True,
            'user': {
                'id': 'fred'
            }
        }
    ],
    'found_count': 2,
    'page': 1,
    'page_count': 1,
    'per_page': 25,
    'total_count': 3
}

snapshots['test_find[uvloop-sp-None-None-None-d_range5-meta5] 1'] = {
    'documents': [
        {
            'created_at': '2015-10-06T22:00:00Z',
            'host': '',
            'id': 'cb400e6d',
            'isolate': '',
            'labels': [
                {
                    'color': '#0d321d',
                    'description': 'This is a question',
                    'id': 3,
                    'name': 'Question'
                }
            ],
            'name': '16SPP044',
            'nuvs': False,
            'pathoscope': False,
            'ready': True,
            'user': {
                'id': 'fred'
            }
        }
    ],
    'found_count': 1,
    'page': 1,
    'page_count': 1,
    'per_page': 25,
    'total_count': 3
}

snapshots['test_find[uvloop-fred-None-None-None-d_range6-meta6] 1'] = {
    'documents': [
        {
            'created_at': '2015-10-06T22:00:00Z',
            'host': '',
            'id': 'cb400e6d',
            'isolate': '',
            'labels': [
                {
                    'color': '#0d321d',
                    'description': 'This is a question',
                    'id': 3,
                    'name': 'Question'
                }
            ],
            'name': '16SPP044',
            'nuvs': False,
            'pathoscope': False,
            'ready': True,
            'user': {
                'id': 'fred'
            }
        },
        {
            'created_at': '2015-10-06T20:00:00Z',
            'host': '',
            'id': '72bb8b31',
            'isolate': 'Test',
            'labels': [
                {
                    'color': '#a83432',
                    'description': 'This is a bug',
                    'id': 1,
                    'name': 'Bug'
                }
            ],
            'name': '16GVP043',
            'nuvs': False,
            'pathoscope': False,
            'ready': True,
            'user': {
                'id': 'fred'
            }
        }
    ],
    'found_count': 2,
    'page': 1,
    'page_count': 1,
    'per_page': 25,
    'total_count': 3
}

snapshots['test_finalize[uvloop-quality] 1'] = {
    'artifacts': [
        {
            'id': 1,
            'name': 'reference.fa.gz',
            'name_on_disk': None,
            'sample': 'test',
            'size': None,
            'type': 'fasta',
            'uploaded_at': None
        }
    ],
    'id': 'test',
    'quality': {
    },
    'reads': [
        {
            'id': 1,
            'name': 'reads_1.fq.gz',
            'name_on_disk': 'reads_1.fq.gz',
            'sample': 'test',
            'size': None,
            'upload': None,
            'uploaded_at': None
        }
    ],
    'ready': True
}

snapshots['test_get_cache[uvloop-None] 1'] = {
    'id': 'bar',
    'key': 'abc123',
    'program': 'skewer-0.2.2',
    'sample': {
        'id': 'foo'
    }
}

snapshots['test_finalize_cache[uvloop-quality] 1'] = {
    'id': 'test',
    'key': 'aodp-abcdefgh',
    'quality': {
    },
    'ready': True,
    'sample': {
        'id': 'test'
    }
}

snapshots['TestCreate.test[uvloop-none] 1'] = {
    'all_read': True,
    'all_write': True,
    'created_at': '2015-10-06T20:00:00Z',
    'files': [
        {
            'id': 1,
            'name': 'test.fq.gz',
            'size': 123456
        }
    ],
    'format': 'fastq',
    'group': 'none',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'host': '',
    'id': '9pfsom1b',
    'is_legacy': False,
    'isolate': '',
    'labels': [
        {
            'color': '#FF0000',
            'description': None,
            'id': 1,
            'name': 'bug'
        }
    ],
    'library_type': 'normal',
    'locale': '',
    'name': 'Foobar',
    'notes': '',
    'nuvs': False,
    'paired': False,
    'pathoscope': False,
    'quality': None,
    'ready': False,
    'subtractions': [
        'apple'
    ],
    'user': {
        'id': 'test'
    }
}

snapshots['TestCreate.test[uvloop-none] 2'] = {
    '_id': '9pfsom1b',
    'all_read': True,
    'all_write': True,
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'files': [
        {
            'id': 1,
            'name': 'test.fq.gz',
            'size': 123456
        }
    ],
    'format': 'fastq',
    'group': 'none',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'host': '',
    'is_legacy': False,
    'isolate': '',
    'labels': [
        1
    ],
    'library_type': 'normal',
    'locale': '',
    'name': 'Foobar',
    'notes': '',
    'nuvs': False,
    'paired': False,
    'pathoscope': False,
    'quality': None,
    'ready': False,
    'subtractions': [
        'apple'
    ],
    'user': {
        'id': 'test'
    }
}

snapshots['TestCreate.test[uvloop-users_primary_group] 1'] = {
    'all_read': True,
    'all_write': True,
    'created_at': '2015-10-06T20:00:00Z',
    'files': [
        {
            'id': 1,
            'name': 'test.fq.gz',
            'size': 123456
        }
    ],
    'format': 'fastq',
    'group': 'technician',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'host': '',
    'id': '9pfsom1b',
    'is_legacy': False,
    'isolate': '',
    'labels': [
        {
            'color': '#FF0000',
            'description': None,
            'id': 1,
            'name': 'bug'
        }
    ],
    'library_type': 'normal',
    'locale': '',
    'name': 'Foobar',
    'notes': '',
    'nuvs': False,
    'paired': False,
    'pathoscope': False,
    'quality': None,
    'ready': False,
    'subtractions': [
        'apple'
    ],
    'user': {
        'id': 'test'
    }
}

snapshots['TestCreate.test[uvloop-users_primary_group] 2'] = {
    '_id': '9pfsom1b',
    'all_read': True,
    'all_write': True,
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'files': [
        {
            'id': 1,
            'name': 'test.fq.gz',
            'size': 123456
        }
    ],
    'format': 'fastq',
    'group': 'technician',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'host': '',
    'is_legacy': False,
    'isolate': '',
    'labels': [
        1
    ],
    'library_type': 'normal',
    'locale': '',
    'name': 'Foobar',
    'notes': '',
    'nuvs': False,
    'paired': False,
    'pathoscope': False,
    'quality': None,
    'ready': False,
    'subtractions': [
        'apple'
    ],
    'user': {
        'id': 'test'
    }
}

snapshots['TestCreate.test[uvloop-force_choice] 1'] = {
    'all_read': True,
    'all_write': True,
    'created_at': '2015-10-06T20:00:00Z',
    'files': [
        {
            'id': 1,
            'name': 'test.fq.gz',
            'size': 123456
        }
    ],
    'format': 'fastq',
    'group': 'diagnostics',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'host': '',
    'id': '9pfsom1b',
    'is_legacy': False,
    'isolate': '',
    'labels': [
        {
            'color': '#FF0000',
            'description': None,
            'id': 1,
            'name': 'bug'
        }
    ],
    'library_type': 'normal',
    'locale': '',
    'name': 'Foobar',
    'notes': '',
    'nuvs': False,
    'paired': False,
    'pathoscope': False,
    'quality': None,
    'ready': False,
    'subtractions': [
        'apple'
    ],
    'user': {
        'id': 'test'
    }
}

snapshots['TestCreate.test[uvloop-force_choice] 2'] = {
    '_id': '9pfsom1b',
    'all_read': True,
    'all_write': True,
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'files': [
        {
            'id': 1,
            'name': 'test.fq.gz',
            'size': 123456
        }
    ],
    'format': 'fastq',
    'group': 'diagnostics',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'host': '',
    'is_legacy': False,
    'isolate': '',
    'labels': [
        1
    ],
    'library_type': 'normal',
    'locale': '',
    'name': 'Foobar',
    'notes': '',
    'nuvs': False,
    'paired': False,
    'pathoscope': False,
    'quality': None,
    'ready': False,
    'subtractions': [
        'apple'
    ],
    'user': {
        'id': 'test'
    }
}

snapshots['TestCreateCache.test[uvloop-key] 1'] = {
    'created_at': '2015-10-06T20:00:00Z',
    'files': [
    ],
    'id': 'a1b2c3d4',
    'key': 'aodp-abcdefgh',
    'legacy': False,
    'missing': False,
    'paired': False,
    'ready': False,
    'sample': {
        'id': 'test'
    }
}

snapshots['TestEdit.test[uvloop] 1'] = {
    'id': 'test',
    'labels': [
        {
            'color': '#a83432',
            'description': 'This is a bug',
            'id': 1,
            'name': 'Bug'
        }
    ],
    'name': 'test_sample',
    'notes': 'This is a test.',
    'subtractions': [
        'foo'
    ]
}

snapshots['TestEdit.test_subtraction_exists[uvloop-True] 1'] = {
    'id': 'test',
    'labels': [
    ],
    'name': 'Test',
    'subtractions': [
        'foo',
        'bar'
    ]
}

snapshots['TestEdit.test_name_exists[uvloop-False] 1'] = {
    'id': 'foo',
    'labels': [
    ],
    'name': 'Bar'
}

snapshots['test_upload_artifacts[uvloop-fastq] 1'] = {
    'id': 1,
    'name': 'small.fq',
    'name_on_disk': '1-small.fq',
    'sample': 'test',
    'size': 3130756,
    'type': 'fastq',
    'uploaded_at': '2015-10-06T20:00:00Z'
}

snapshots['TestUploadReads.test_upload_reads[uvloop-True] 1'] = {
    'id': 1,
    'name': 'reads_1.fq.gz',
    'name_on_disk': 'reads_1.fq.gz',
    'sample': 'test',
    'size': 9081,
    'upload': 1,
    'uploaded_at': '2015-10-06T20:00:00Z'
}

snapshots['test_upload_artifact_cache[uvloop-fastq] 1'] = {
    'id': 1,
    'name': 'small.fq',
    'name_on_disk': '1-small.fq',
    'sample': 'test',
    'size': 3130756,
    'type': 'fastq',
    'uploaded_at': '2015-10-06T20:00:00Z'
}

snapshots['test_upload_reads_cache[uvloop-True] 1'] = {
    'id': 2,
    'name': 'reads_2.fq.gz',
    'name_on_disk': 'reads_2.fq.gz',
    'sample': 'test',
    'size': 9081,
    'upload': None,
    'uploaded_at': '2015-10-06T20:00:00Z'
}

snapshots['test_upload_reads_cache[uvloop-False] 1'] = {
    'id': 1,
    'name': 'reads_1.fq.gz',
    'name_on_disk': 'reads_1.fq.gz',
    'sample': 'test',
    'size': 9081,
    'upload': None,
    'uploaded_at': '2015-10-06T20:00:00Z'
}

snapshots['TestEdit.test_label_exists[uvloop-True] 1'] = {
    'id': 'foo',
    'labels': [
        {
            'color': '#a83432',
            'description': 'This is a bug',
            'id': 1,
            'name': 'Bug'
        }
    ],
    'name': 'Foo'
}
