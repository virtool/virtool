# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import GenericRepr, Snapshot


snapshots = Snapshot()

snapshots['test_create[uvloop-False-False] 1'] = {
    '_id': 'bar',
    'isolates': [
        {
            'id': 'baz',
            'source_name': 'A',
            'source_type': 'isolate'
        }
    ],
    'name': 'Bar Virus',
    'reference': {
        'id': 'foo'
    },
    'verified': True,
    'version': 4
}

snapshots['test_create[uvloop-False-False] 2'] = {
    '_id': '9pfsom1b',
    'accession': 'abc123',
    'definition': 'A made up sequence',
    'host': 'Plant',
    'isolate_id': 'baz',
    'otu_id': 'bar',
    'reference': {
        'id': 'foo'
    },
    'segment': None,
    'sequence': 'ATGCGTGTACTGAGAGTATATTTATACCACAC'
}

snapshots['test_create[uvloop-False-False] 3'] = {
    '_id': 'bar.4',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Created new sequence abc123 in Isolate A',
    'diff': [
        [
            'add',
            [
                'isolates',
                0,
                'sequences'
            ],
            [
                [
                    0,
                    {
                        '_id': '9pfsom1b',
                        'accession': 'abc123',
                        'definition': 'A made up sequence',
                        'host': 'Plant',
                        'isolate_id': 'baz',
                        'otu_id': 'bar',
                        'reference': {
                            'id': 'foo'
                        },
                        'segment': None,
                        'sequence': 'ATGCGTGTACTGAGAGTATATTTATACCACAC'
                    }
                ]
            ]
        ],
        [
            'change',
            'version',
            [
                3,
                4
            ]
        ]
    ],
    'index': {
        'id': 'unbuilt',
        'version': 'unbuilt'
    },
    'method_name': 'create_sequence',
    'otu': {
        'id': 'bar',
        'name': 'Bar Virus',
        'version': 4
    },
    'reference': {
        'id': 'foo'
    },
    'user': {
        'id': 'bob'
    }
}

snapshots['test_create[uvloop-False-True] 1'] = {
    '_id': 'bar',
    'isolates': [
        {
            'id': 'baz',
            'source_name': 'A',
            'source_type': 'isolate'
        }
    ],
    'name': 'Bar Virus',
    'reference': {
        'id': 'foo'
    },
    'verified': True,
    'version': 4
}

snapshots['test_create[uvloop-False-True] 2'] = {
    '_id': '9pfsom1b',
    'accession': 'abc123',
    'definition': 'A made up sequence',
    'host': 'host',
    'isolate_id': 'baz',
    'otu_id': 'bar',
    'reference': {
        'id': 'foo'
    },
    'segment': None,
    'sequence': 'ATGCGTGTACTGAGAGTATATTTATACCACAC'
}

snapshots['test_create[uvloop-False-True] 3'] = {
    '_id': 'bar.4',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Created new sequence abc123 in Isolate A',
    'diff': [
        [
            'add',
            [
                'isolates',
                0,
                'sequences'
            ],
            [
                [
                    0,
                    {
                        '_id': '9pfsom1b',
                        'accession': 'abc123',
                        'definition': 'A made up sequence',
                        'host': 'host',
                        'isolate_id': 'baz',
                        'otu_id': 'bar',
                        'reference': {
                            'id': 'foo'
                        },
                        'segment': None,
                        'sequence': 'ATGCGTGTACTGAGAGTATATTTATACCACAC'
                    }
                ]
            ]
        ],
        [
            'change',
            'version',
            [
                3,
                4
            ]
        ]
    ],
    'index': {
        'id': 'unbuilt',
        'version': 'unbuilt'
    },
    'method_name': 'create_sequence',
    'otu': {
        'id': 'bar',
        'name': 'Bar Virus',
        'version': 4
    },
    'reference': {
        'id': 'foo'
    },
    'user': {
        'id': 'bob'
    }
}

snapshots['test_create[uvloop-True-False] 1'] = {
    '_id': 'bar',
    'isolates': [
        {
            'id': 'baz',
            'source_name': 'A',
            'source_type': 'isolate'
        }
    ],
    'name': 'Bar Virus',
    'reference': {
        'id': 'foo'
    },
    'verified': True,
    'version': 4
}

snapshots['test_create[uvloop-True-False] 2'] = {
    '_id': '9pfsom1b',
    'accession': 'abc123',
    'definition': 'A made up sequence',
    'host': 'Plant',
    'isolate_id': 'baz',
    'otu_id': 'bar',
    'reference': {
        'id': 'foo'
    },
    'segment': 'seg',
    'sequence': 'ATGCGTGTACTGAGAGTATATTTATACCACAC'
}

snapshots['test_create[uvloop-True-False] 3'] = {
    '_id': 'bar.4',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Created new sequence abc123 in Isolate A',
    'diff': [
        [
            'add',
            [
                'isolates',
                0,
                'sequences'
            ],
            [
                [
                    0,
                    {
                        '_id': '9pfsom1b',
                        'accession': 'abc123',
                        'definition': 'A made up sequence',
                        'host': 'Plant',
                        'isolate_id': 'baz',
                        'otu_id': 'bar',
                        'reference': {
                            'id': 'foo'
                        },
                        'segment': 'seg',
                        'sequence': 'ATGCGTGTACTGAGAGTATATTTATACCACAC'
                    }
                ]
            ]
        ],
        [
            'change',
            'version',
            [
                3,
                4
            ]
        ]
    ],
    'index': {
        'id': 'unbuilt',
        'version': 'unbuilt'
    },
    'method_name': 'create_sequence',
    'otu': {
        'id': 'bar',
        'name': 'Bar Virus',
        'version': 4
    },
    'reference': {
        'id': 'foo'
    },
    'user': {
        'id': 'bob'
    }
}

snapshots['test_create[uvloop-True-True] 1'] = {
    '_id': 'bar',
    'isolates': [
        {
            'id': 'baz',
            'source_name': 'A',
            'source_type': 'isolate'
        }
    ],
    'name': 'Bar Virus',
    'reference': {
        'id': 'foo'
    },
    'verified': True,
    'version': 4
}

snapshots['test_create[uvloop-True-True] 2'] = {
    '_id': '9pfsom1b',
    'accession': 'abc123',
    'definition': 'A made up sequence',
    'host': 'host',
    'isolate_id': 'baz',
    'otu_id': 'bar',
    'reference': {
        'id': 'foo'
    },
    'segment': 'seg',
    'sequence': 'ATGCGTGTACTGAGAGTATATTTATACCACAC'
}

snapshots['test_create[uvloop-True-True] 3'] = {
    '_id': 'bar.4',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Created new sequence abc123 in Isolate A',
    'diff': [
        [
            'add',
            [
                'isolates',
                0,
                'sequences'
            ],
            [
                [
                    0,
                    {
                        '_id': '9pfsom1b',
                        'accession': 'abc123',
                        'definition': 'A made up sequence',
                        'host': 'host',
                        'isolate_id': 'baz',
                        'otu_id': 'bar',
                        'reference': {
                            'id': 'foo'
                        },
                        'segment': 'seg',
                        'sequence': 'ATGCGTGTACTGAGAGTATATTTATACCACAC'
                    }
                ]
            ]
        ],
        [
            'change',
            'version',
            [
                3,
                4
            ]
        ]
    ],
    'index': {
        'id': 'unbuilt',
        'version': 'unbuilt'
    },
    'method_name': 'create_sequence',
    'otu': {
        'id': 'bar',
        'name': 'Bar Virus',
        'version': 4
    },
    'reference': {
        'id': 'foo'
    },
    'user': {
        'id': 'bob'
    }
}

snapshots['test_edit[uvloop-False] 1'] = {
    '_id': 'foo',
    'isolates': [
        {
            'id': 'bar',
            'source_name': 'A',
            'source_type': 'isolate'
        }
    ],
    'name': 'Foo Virus',
    'reference': {
        'id': 'foo'
    },
    'verified': True,
    'version': 4
}

snapshots['test_edit[uvloop-False] 2'] = {
    '_id': 'foo.4',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Edited sequence baz in Isolate A',
    'diff': [
        [
            'change',
            [
                'isolates',
                0,
                'sequences',
                0,
                'accession'
            ],
            [
                '123abc',
                '987xyz'
            ]
        ],
        [
            'change',
            [
                'isolates',
                0,
                'sequences',
                0,
                'host'
            ],
            [
                '',
                'Apple'
            ]
        ],
        [
            'change',
            [
                'isolates',
                0,
                'sequences',
                0,
                'definition'
            ],
            [
                'Apple virus organism',
                'Hello world'
            ]
        ],
        [
            'change',
            [
                'isolates',
                0,
                'sequences',
                0,
                'segment'
            ],
            [
                'RNA-B',
                'RNA-A'
            ]
        ],
        [
            'change',
            'version',
            [
                3,
                4
            ]
        ]
    ],
    'index': {
        'id': 'unbuilt',
        'version': 'unbuilt'
    },
    'method_name': 'edit_sequence',
    'otu': {
        'id': 'foo',
        'name': 'Foo Virus',
        'version': 4
    },
    'reference': {
        'id': 'foo'
    },
    'user': {
        'id': 'bob'
    }
}

snapshots['test_edit[uvloop-False] 3'] = {
    '_id': 'baz',
    'accession': '987xyz',
    'definition': 'Hello world',
    'host': 'Apple',
    'isolate_id': 'bar',
    'otu_id': 'foo',
    'segment': 'RNA-A',
    'sequence': 'ATGC'
}

snapshots['test_edit[uvloop-True] 1'] = {
    '_id': 'foo',
    'isolates': [
        {
            'id': 'bar',
            'source_name': 'A',
            'source_type': 'isolate'
        }
    ],
    'name': 'Foo Virus',
    'reference': {
        'id': 'foo'
    },
    'verified': True,
    'version': 4
}

snapshots['test_edit[uvloop-True] 2'] = {
    '_id': 'foo.4',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Edited sequence baz in Isolate A',
    'diff': [
        [
            'change',
            [
                'isolates',
                0,
                'sequences',
                0,
                'accession'
            ],
            [
                '123abc',
                '987xyz'
            ]
        ],
        [
            'change',
            [
                'isolates',
                0,
                'sequences',
                0,
                'host'
            ],
            [
                '',
                'Apple'
            ]
        ],
        [
            'change',
            [
                'isolates',
                0,
                'sequences',
                0,
                'definition'
            ],
            [
                'Apple virus organism',
                'Hello world'
            ]
        ],
        [
            'change',
            [
                'isolates',
                0,
                'sequences',
                0,
                'segment'
            ],
            [
                'RNA-B',
                'RNA-A'
            ]
        ],
        [
            'change',
            [
                'isolates',
                0,
                'sequences',
                0,
                'sequence'
            ],
            [
                'ATGC',
                'ATAGAGGAGTAAGAGTGA'
            ]
        ],
        [
            'change',
            'version',
            [
                3,
                4
            ]
        ]
    ],
    'index': {
        'id': 'unbuilt',
        'version': 'unbuilt'
    },
    'method_name': 'edit_sequence',
    'otu': {
        'id': 'foo',
        'name': 'Foo Virus',
        'version': 4
    },
    'reference': {
        'id': 'foo'
    },
    'user': {
        'id': 'bob'
    }
}

snapshots['test_edit[uvloop-True] 3'] = {
    '_id': 'baz',
    'accession': '987xyz',
    'definition': 'Hello world',
    'host': 'Apple',
    'isolate_id': 'bar',
    'otu_id': 'foo',
    'segment': 'RNA-A',
    'sequence': 'ATAGAGGAGTAAGAGTGA'
}

snapshots['test_get[uvloop-None] 1'] = {
    'id': 'baz',
    'isolate_id': 'bar',
    'otu_id': 'foo',
    'sequence': 'ATGC'
}

snapshots['test_get[uvloop-isolate] 1'] = None

snapshots['test_get[uvloop-otu] 1'] = None

snapshots['test_get[uvloop-sequence] 1'] = None

snapshots['test_increment_otu_version[uvloop] 1'] = {
    '_id': 'foo',
    'verified': False,
    'version': 4
}

snapshots['test_remove[uvloop] 1'] = {
    '_id': '6116cba1',
    'abbreviation': 'PVF',
    'imported': True,
    'isolates': [
        {
            'default': True,
            'id': 'cab8b360',
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

snapshots['test_remove[uvloop] 2'] = {
    '_id': '6116cba1.1',
    'created_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)'),
    'description': 'Removed sequence baz from Isolate 8816-v2',
    'diff': [
        [
            'change',
            'version',
            [
                0,
                1
            ]
        ],
        [
            'remove',
            [
                'isolates',
                0,
                'sequences'
            ],
            [
                [
                    0,
                    {
                        '_id': 'baz',
                        'accession': '123abc',
                        'definition': 'Apple virus organism',
                        'host': '',
                        'isolate_id': 'cab8b360',
                        'otu_id': '6116cba1',
                        'segment': 'RNA-B',
                        'sequence': 'ATGC'
                    }
                ]
            ]
        ]
    ],
    'index': {
        'id': 'unbuilt',
        'version': 'unbuilt'
    },
    'method_name': 'remove_sequence',
    'otu': {
        'id': '6116cba1',
        'name': 'Prunus virus F',
        'version': 1
    },
    'reference': {
        'id': 'hxn167'
    },
    'user': {
        'id': 'bob'
    }
}
