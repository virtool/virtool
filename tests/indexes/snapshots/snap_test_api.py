# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import GenericRepr, Snapshot


snapshots = Snapshot()

snapshots['TestCreate.test[True-uvloop] 1'] = {
    '_id': 'u3cuwaoq',
    'acquired': False,
    'args': {
        'index_id': 'xjqvxigh',
        'index_version': 9,
        'manifest': 'manifest',
        'ref_id': 'foo',
        'user_id': 'test'
    },
    'key': None,
    'rights': {
        'indexes': {
            'modify': [
                'xjqvxigh'
            ]
        },
        'references': {
            'read': [
                'foo'
            ]
        }
    },
    'state': 'waiting',
    'status': [
        {
            'error': None,
            'progress': 0,
            'stage': None,
            'state': 'waiting',
            'timestamp': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
        }
    ],
    'task': 'build_index',
    'user': {
        'id': 'test'
    }
}

snapshots['TestCreate.test[True-uvloop] 2'] = {
    '_id': 'xjqvxigh',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'has_files': True,
    'has_json': False,
    'job': {
        'id': 'u3cuwaoq'
    },
    'manifest': 'manifest',
    'ready': False,
    'reference': {
        'id': 'foo'
    },
    'user': {
        'id': 'test'
    },
    'version': 9
}

snapshots['TestCreate.test[True-uvloop] 3'] = {
    'created_at': '2015-10-06T20:00:00Z',
    'has_files': True,
    'has_json': False,
    'id': 'xjqvxigh',
    'job': {
        'id': 'u3cuwaoq'
    },
    'manifest': 'manifest',
    'ready': False,
    'reference': {
        'id': 'foo'
    },
    'user': {
        'id': 'test'
    },
    'version': 9
}

snapshots['test[uvloop-None] 1'] = {
    'documents': [
        {
            'id': 'kjs8sa99.3',
            'index': {
                'id': 'foobar',
                'version': 0
            },
            'method_name': 'add_sequence',
            'otu': {
                'id': 'kjs8sa99',
                'name': 'Foo',
                'version': 3
            },
            'user': {
                'id': 'fred'
            }
        },
        {
            'id': 'zxbbvngc.2',
            'index': {
                'id': 'foobar',
                'version': 0
            },
            'method_name': 'add_isolate',
            'otu': {
                'id': 'zxbbvngc',
                'name': 'Test',
                'version': 2
            },
            'user': {
                'id': 'igboyes'
            }
        },
        {
            'id': 'zxbbvngc.1',
            'index': {
                'id': 'foobar',
                'version': 0
            },
            'method_name': 'add_isolate',
            'otu': {
                'id': 'zxbbvngc',
                'name': 'Test',
                'version': 1
            },
            'user': {
                'id': 'igboyes'
            }
        },
        {
            'id': 'zxbbvngc.0',
            'index': {
                'id': 'foobar',
                'version': 0
            },
            'otu': {
                'id': 'zxbbvngc',
                'name': 'Test',
                'version': 0
            },
            'user': {
                'id': 'igboyes'
            }
        }
    ],
    'found_count': 4,
    'page': 1,
    'page_count': 1,
    'per_page': 25,
    'total_count': 6
}

snapshots['test_find[uvloop] 1'] = {
    'change_count': 12,
    'documents': [
        {
            'change_count': 4,
            'created_at': '2015-10-06T20:00:00Z',
            'has_files': True,
            'id': 'bar',
            'job': {
                'id': 'bar'
            },
            'modified_otu_count': 3,
            'ready': False,
            'reference': {
                'id': 'bar'
            },
            'user': {
                'id': 'bob'
            },
            'version': 1
        },
        {
            'change_count': 2,
            'created_at': '2015-10-06T20:00:00Z',
            'has_files': True,
            'id': 'foo',
            'job': {
                'id': 'foo'
            },
            'modified_otu_count': 2,
            'ready': False,
            'reference': {
                'id': 'foo'
            },
            'user': {
                'id': 'bob'
            },
            'version': 0
        }
    ],
    'found_count': 2,
    'modified_otu_count': 3,
    'page': 1,
    'page_count': 1,
    'per_page': 25,
    'total_count': 2,
    'total_otu_count': 123
}

snapshots['test_get[uvloop-None] 1'] = {
    'change_count': 2,
    'contributors': [
        {
            'count': 1,
            'id': 'fred'
        },
        {
            'count': 3,
            'id': 'igboyes'
        }
    ],
    'created_at': '2015-10-06T20:00:00Z',
    'files': [
    ],
    'has_files': True,
    'id': 'foobar',
    'job': {
        'id': 'sj82la'
    },
    'modified_otu_count': 2,
    'otus': [
        {
            'change_count': 1,
            'id': 'kjs8sa99',
            'name': 'Foo'
        },
        {
            'change_count': 3,
            'id': 'zxbbvngc',
            'name': 'Test'
        }
    ],
    'ready': False,
    'user': {
        'id': 'test'
    },
    'version': 0
}

snapshots['test_upload[uvloop-None] 1'] = {
    'id': 1,
    'index': 'foo',
    'name': 'reference.1.bt2',
    'size': 7205747,
    'type': 'bowtie2'
}

snapshots['test_upload[uvloop-404] 1'] = {
    'id': 1,
    'index': 'foo',
    'name': 'reference.1.bt2',
    'size': 7205747,
    'type': 'bowtie2'
}

snapshots['test_upload[uvloop-None] 2'] = {
    '_id': 'foo',
    'reference': {
        'id': 'bar'
    },
    'user': {
        'id': 'test'
    }
}

snapshots['test_upload[uvloop-404] 2'] = {
    '_id': 'foo',
    'reference': {
        'id': 'bar'
    },
    'user': {
        'id': 'test'
    }
}

snapshots['test_finalize[uvloop-None] 1'] = {
    'files': [
        {
            'id': 1,
            'index': 'test_index',
            'name': 'reference.json.gz',
            'size': None,
            'type': 'json'
        },
        {
            'id': 2,
            'index': 'test_index',
            'name': 'reference.fa.gz',
            'size': None,
            'type': 'fasta'
        },
        {
            'id': 3,
            'index': 'test_index',
            'name': 'reference.1.bt2',
            'size': None,
            'type': 'bowtie2'
        },
        {
            'id': 4,
            'index': 'test_index',
            'name': 'reference.2.bt2',
            'size': None,
            'type': 'bowtie2'
        },
        {
            'id': 5,
            'index': 'test_index',
            'name': 'reference.3.bt2',
            'size': None,
            'type': 'bowtie2'
        },
        {
            'id': 6,
            'index': 'test_index',
            'name': 'reference.4.bt2',
            'size': None,
            'type': 'bowtie2'
        },
        {
            'id': 7,
            'index': 'test_index',
            'name': 'reference.rev.1.bt2',
            'size': None,
            'type': 'bowtie2'
        },
        {
            'id': 8,
            'index': 'test_index',
            'name': 'reference.rev.2.bt2',
            'size': None,
            'type': 'bowtie2'
        }
    ],
    'id': 'test_index',
    'ready': True,
    'reference': {
        'id': 'hxn167'
    }
}

snapshots['test_finalize[uvloop-409_genome] 1'] = {
    'id': 'conflict',
    'message': 'Reference requires that all Bowtie2 index files have been uploaded. Missing files: reference.1.bt2, reference.2.bt2, reference.3.bt2, reference.4.bt2, reference.rev.1.bt2, reference.rev.2.bt2'
}

snapshots['test_finalize[uvloop-409_fasta] 1'] = {
    'id': 'conflict',
    'message': 'A FASTA file must be uploaded in order to finalize index'
}

snapshots['test_finalize[uvloop-404_reference] 1'] = {
    'id': 'not_found',
    'message': 'Reference associated with index does not exist'
}
