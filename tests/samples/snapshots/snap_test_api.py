# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import GenericRepr, Snapshot


snapshots = Snapshot()

snapshots['TestCreate.test[uvloop-none] 1'] = {
    'all_read': True,
    'all_write': True,
    'created_at': '2015-10-06T20:00:00Z',
    'files': [
        {
            'id': 'test.fq'
        }
    ],
    'format': 'fastq',
    'group': 'none',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'id': '9pfsom1b',
    'library_type': 'normal',
    'name': 'Foobar',
    'nuvs': False,
    'paired': False,
    'pathoscope': False,
    'quality': None,
    'ready': False,
    'subtraction': {
        'id': 'apple'
    },
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
            'id': 'test.fq'
        }
    ],
    'format': 'fastq',
    'group': 'technician',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'id': '9pfsom1b',
    'library_type': 'normal',
    'name': 'Foobar',
    'nuvs': False,
    'paired': False,
    'pathoscope': False,
    'quality': None,
    'ready': False,
    'subtraction': {
        'id': 'apple'
    },
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
            'id': 'test.fq'
        }
    ],
    'format': 'fastq',
    'group': 'diagnostics',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'id': '9pfsom1b',
    'library_type': 'normal',
    'name': 'Foobar',
    'nuvs': False,
    'paired': False,
    'pathoscope': False,
    'quality': None,
    'ready': False,
    'subtraction': {
        'id': 'apple'
    },
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
            'id': 'test.fq'
        }
    ],
    'format': 'fastq',
    'group': 'none',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'library_type': 'normal',
    'name': 'Foobar',
    'nuvs': False,
    'paired': False,
    'pathoscope': False,
    'quality': None,
    'ready': False,
    'subtraction': {
        'id': 'apple'
    },
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
            'id': 'test.fq'
        }
    ],
    'format': 'fastq',
    'group': 'technician',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'library_type': 'normal',
    'name': 'Foobar',
    'nuvs': False,
    'paired': False,
    'pathoscope': False,
    'quality': None,
    'ready': False,
    'subtraction': {
        'id': 'apple'
    },
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
            'id': 'test.fq'
        }
    ],
    'format': 'fastq',
    'group': 'diagnostics',
    'group_read': True,
    'group_write': True,
    'hold': True,
    'library_type': 'normal',
    'name': 'Foobar',
    'nuvs': False,
    'paired': False,
    'pathoscope': False,
    'quality': None,
    'ready': False,
    'subtraction': {
        'id': 'apple'
    },
    'user': {
        'id': 'test'
    }
}

snapshots['test_find[uvloop-fred-None-None-d_range5-meta5] 1'] = {
    'documents': [
        {
            'created_at': '2015-10-06T22:00:00Z',
            'host': '',
            'id': 'cb400e6d',
            'isolate': '',
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

snapshots['test_get[uvloop-True-None] 1'] = {
    'caches': [
    ],
    'created_at': '2015-10-06T20:00:00Z',
    'files': [
        {
            'download_url': '/download/samples/files/file_1.fq.gz',
            'id': 'foo',
            'name': 'Bar.fq.gz',
            'replace_url': '/upload/samples/test/files/1'
        }
    ],
    'id': 'test',
    'name': 'Test',
    'ready': True
}

snapshots['test_find[uvloop-None-None-None-d_range0-meta0] 1'] = {
    'documents': [
        {
            'created_at': '2015-10-06T22:00:00Z',
            'host': '',
            'id': 'cb400e6d',
            'isolate': '',
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

snapshots['test_find[uvloop-None-2-1-d_range1-meta1] 1'] = {
    'documents': [
        {
            'created_at': '2015-10-06T22:00:00Z',
            'host': '',
            'id': 'cb400e6d',
            'isolate': '',
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

snapshots['test_find[uvloop-None-2-2-d_range2-meta2] 1'] = {
    'documents': [
        {
            'created_at': '2015-10-06T20:00:00Z',
            'host': '',
            'id': '72bb8b31',
            'isolate': 'Test',
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

snapshots['test_find[uvloop-gv-None-None-d_range3-meta3] 1'] = {
    'documents': [
        {
            'created_at': '2015-10-06T21:00:00Z',
            'host': '',
            'id': 'beb1eb10',
            'isolate': 'Thing',
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

snapshots['test_find[uvloop-sp-None-None-d_range4-meta4] 1'] = {
    'documents': [
        {
            'created_at': '2015-10-06T22:00:00Z',
            'host': '',
            'id': 'cb400e6d',
            'isolate': '',
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

snapshots['test_get[uvloop-False-None] 1'] = {
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
    'name': 'Test',
    'ready': False
}

snapshots['test_find_analyses[uvloop-None-None] 1'] = {
    'documents': [
        {
            'algorithm': 'pathoscope_bowtie',
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
            }
        },
        {
            'algorithm': 'pathoscope_bowtie',
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
            }
        },
        {
            'algorithm': 'pathoscope_bowtie',
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
            }
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
            'algorithm': 'pathoscope_bowtie',
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
            }
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
            'algorithm': 'pathoscope_bowtie',
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
            }
        },
        {
            'algorithm': 'pathoscope_bowtie',
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
            }
        }
    ],
    'found_count': 2,
    'page': 1,
    'page_count': 1,
    'per_page': 25,
    'total_count': 3
}
