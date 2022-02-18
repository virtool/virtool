# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import GenericRepr, Snapshot


snapshots = Snapshot()

snapshots['test_update[uvloop-None-None-None-True] 1'] = {
    '_id': 'foo',
    'results': [
        {
            'blast': 'bar',
            'index': 2
        },
        {
            'blast': {
                'error': None,
                'interval': 3,
                'last_checked_at': '2015-10-06T20:00:00+00:00',
                'ready': True,
                'result': None,
                'rid': 'ABC123'
            },
            'index': 5
        },
        {
            'blast': 'baz',
            'index': 12
        }
    ],
    'sample': {
        'id': 'sample'
    },
    'updated_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
}

snapshots['test_update[uvloop-None-None-None-False] 1'] = {
    '_id': 'foo',
    'results': [
        {
            'blast': 'bar',
            'index': 2
        },
        {
            'blast': {
                'error': None,
                'interval': 3,
                'last_checked_at': '2015-10-06T20:00:00+00:00',
                'ready': False,
                'result': None,
                'rid': 'ABC123'
            },
            'index': 5
        },
        {
            'blast': 'baz',
            'index': 12
        }
    ],
    'sample': {
        'id': 'sample'
    },
    'updated_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
}

snapshots['test_update[uvloop-None-None-Error-True] 1'] = {
    '_id': 'foo',
    'results': [
        {
            'blast': 'bar',
            'index': 2
        },
        {
            'blast': {
                'error': 'Error',
                'interval': 3,
                'last_checked_at': '2015-10-06T20:00:00+00:00',
                'ready': True,
                'result': None,
                'rid': 'ABC123'
            },
            'index': 5
        },
        {
            'blast': 'baz',
            'index': 12
        }
    ],
    'sample': {
        'id': 'sample'
    },
    'updated_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
}

snapshots['test_update[uvloop-None-None-Error-False] 1'] = {
    '_id': 'foo',
    'results': [
        {
            'blast': 'bar',
            'index': 2
        },
        {
            'blast': {
                'error': 'Error',
                'interval': 3,
                'last_checked_at': '2015-10-06T20:00:00+00:00',
                'ready': False,
                'result': None,
                'rid': 'ABC123'
            },
            'index': 5
        },
        {
            'blast': 'baz',
            'index': 12
        }
    ],
    'sample': {
        'id': 'sample'
    },
    'updated_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
}

snapshots['test_update[uvloop-None-True-None-True] 1'] = {
    '_id': 'foo',
    'results': [
        {
            'blast': 'bar',
            'index': 2
        },
        {
            'blast': {
                'error': None,
                'interval': 3,
                'last_checked_at': '2015-10-06T20:00:00+00:00',
                'ready': True,
                'result': None,
                'rid': 'ABC123'
            },
            'index': 5
        },
        {
            'blast': 'baz',
            'index': 12
        }
    ],
    'sample': {
        'id': 'sample'
    },
    'updated_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
}

snapshots['test_update[uvloop-None-True-None-False] 1'] = {
    '_id': 'foo',
    'results': [
        {
            'blast': 'bar',
            'index': 2
        },
        {
            'blast': {
                'error': None,
                'interval': 3,
                'last_checked_at': '2015-10-06T20:00:00+00:00',
                'ready': True,
                'result': None,
                'rid': 'ABC123'
            },
            'index': 5
        },
        {
            'blast': 'baz',
            'index': 12
        }
    ],
    'sample': {
        'id': 'sample'
    },
    'updated_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
}

snapshots['test_update[uvloop-None-True-Error-True] 1'] = {
    '_id': 'foo',
    'results': [
        {
            'blast': 'bar',
            'index': 2
        },
        {
            'blast': {
                'error': 'Error',
                'interval': 3,
                'last_checked_at': '2015-10-06T20:00:00+00:00',
                'ready': True,
                'result': None,
                'rid': 'ABC123'
            },
            'index': 5
        },
        {
            'blast': 'baz',
            'index': 12
        }
    ],
    'sample': {
        'id': 'sample'
    },
    'updated_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
}

snapshots['test_update[uvloop-None-True-Error-False] 1'] = {
    '_id': 'foo',
    'results': [
        {
            'blast': 'bar',
            'index': 2
        },
        {
            'blast': {
                'error': 'Error',
                'interval': 3,
                'last_checked_at': '2015-10-06T20:00:00+00:00',
                'ready': True,
                'result': None,
                'rid': 'ABC123'
            },
            'index': 5
        },
        {
            'blast': 'baz',
            'index': 12
        }
    ],
    'sample': {
        'id': 'sample'
    },
    'updated_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
}

snapshots['test_update[uvloop-None-False-None-True] 1'] = {
    '_id': 'foo',
    'results': [
        {
            'blast': 'bar',
            'index': 2
        },
        {
            'blast': {
                'error': None,
                'interval': 3,
                'last_checked_at': '2015-10-06T20:00:00+00:00',
                'ready': False,
                'result': None,
                'rid': 'ABC123'
            },
            'index': 5
        },
        {
            'blast': 'baz',
            'index': 12
        }
    ],
    'sample': {
        'id': 'sample'
    },
    'updated_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
}

snapshots['test_update[uvloop-None-False-None-False] 1'] = {
    '_id': 'foo',
    'results': [
        {
            'blast': 'bar',
            'index': 2
        },
        {
            'blast': {
                'error': None,
                'interval': 3,
                'last_checked_at': '2015-10-06T20:00:00+00:00',
                'ready': False,
                'result': None,
                'rid': 'ABC123'
            },
            'index': 5
        },
        {
            'blast': 'baz',
            'index': 12
        }
    ],
    'sample': {
        'id': 'sample'
    },
    'updated_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
}

snapshots['test_update[uvloop-None-False-Error-True] 1'] = {
    '_id': 'foo',
    'results': [
        {
            'blast': 'bar',
            'index': 2
        },
        {
            'blast': {
                'error': 'Error',
                'interval': 3,
                'last_checked_at': '2015-10-06T20:00:00+00:00',
                'ready': False,
                'result': None,
                'rid': 'ABC123'
            },
            'index': 5
        },
        {
            'blast': 'baz',
            'index': 12
        }
    ],
    'sample': {
        'id': 'sample'
    },
    'updated_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
}

snapshots['test_update[uvloop-None-False-Error-False] 1'] = {
    '_id': 'foo',
    'results': [
        {
            'blast': 'bar',
            'index': 2
        },
        {
            'blast': {
                'error': 'Error',
                'interval': 3,
                'last_checked_at': '2015-10-06T20:00:00+00:00',
                'ready': False,
                'result': None,
                'rid': 'ABC123'
            },
            'index': 5
        },
        {
            'blast': 'baz',
            'index': 12
        }
    ],
    'sample': {
        'id': 'sample'
    },
    'updated_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
}

snapshots['test_update[uvloop-result1-None-None-True] 1'] = {
    '_id': 'foo',
    'results': [
        {
            'blast': 'bar',
            'index': 2
        },
        {
            'blast': {
                'error': None,
                'interval': 3,
                'last_checked_at': '2015-10-06T20:00:00+00:00',
                'ready': True,
                'result': {
                    'foo': 'bar'
                },
                'rid': 'ABC123'
            },
            'index': 5
        },
        {
            'blast': 'baz',
            'index': 12
        }
    ],
    'sample': {
        'id': 'sample'
    },
    'updated_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
}

snapshots['test_update[uvloop-result1-None-None-False] 1'] = {
    '_id': 'foo',
    'results': [
        {
            'blast': 'bar',
            'index': 2
        },
        {
            'blast': {
                'error': None,
                'interval': 3,
                'last_checked_at': '2015-10-06T20:00:00+00:00',
                'ready': False,
                'result': {
                    'foo': 'bar'
                },
                'rid': 'ABC123'
            },
            'index': 5
        },
        {
            'blast': 'baz',
            'index': 12
        }
    ],
    'sample': {
        'id': 'sample'
    },
    'updated_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
}

snapshots['test_update[uvloop-result1-None-Error-True] 1'] = {
    '_id': 'foo',
    'results': [
        {
            'blast': 'bar',
            'index': 2
        },
        {
            'blast': {
                'error': 'Error',
                'interval': 3,
                'last_checked_at': '2015-10-06T20:00:00+00:00',
                'ready': True,
                'result': {
                    'foo': 'bar'
                },
                'rid': 'ABC123'
            },
            'index': 5
        },
        {
            'blast': 'baz',
            'index': 12
        }
    ],
    'sample': {
        'id': 'sample'
    },
    'updated_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
}

snapshots['test_update[uvloop-result1-None-Error-False] 1'] = {
    '_id': 'foo',
    'results': [
        {
            'blast': 'bar',
            'index': 2
        },
        {
            'blast': {
                'error': 'Error',
                'interval': 3,
                'last_checked_at': '2015-10-06T20:00:00+00:00',
                'ready': False,
                'result': {
                    'foo': 'bar'
                },
                'rid': 'ABC123'
            },
            'index': 5
        },
        {
            'blast': 'baz',
            'index': 12
        }
    ],
    'sample': {
        'id': 'sample'
    },
    'updated_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
}

snapshots['test_update[uvloop-result1-True-None-True] 1'] = {
    '_id': 'foo',
    'results': [
        {
            'blast': 'bar',
            'index': 2
        },
        {
            'blast': {
                'error': None,
                'interval': 3,
                'last_checked_at': '2015-10-06T20:00:00+00:00',
                'ready': True,
                'result': {
                    'foo': 'bar'
                },
                'rid': 'ABC123'
            },
            'index': 5
        },
        {
            'blast': 'baz',
            'index': 12
        }
    ],
    'sample': {
        'id': 'sample'
    },
    'updated_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
}

snapshots['test_update[uvloop-result1-True-None-False] 1'] = {
    '_id': 'foo',
    'results': [
        {
            'blast': 'bar',
            'index': 2
        },
        {
            'blast': {
                'error': None,
                'interval': 3,
                'last_checked_at': '2015-10-06T20:00:00+00:00',
                'ready': True,
                'result': {
                    'foo': 'bar'
                },
                'rid': 'ABC123'
            },
            'index': 5
        },
        {
            'blast': 'baz',
            'index': 12
        }
    ],
    'sample': {
        'id': 'sample'
    },
    'updated_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
}

snapshots['test_update[uvloop-result1-True-Error-True] 1'] = {
    '_id': 'foo',
    'results': [
        {
            'blast': 'bar',
            'index': 2
        },
        {
            'blast': {
                'error': 'Error',
                'interval': 3,
                'last_checked_at': '2015-10-06T20:00:00+00:00',
                'ready': True,
                'result': {
                    'foo': 'bar'
                },
                'rid': 'ABC123'
            },
            'index': 5
        },
        {
            'blast': 'baz',
            'index': 12
        }
    ],
    'sample': {
        'id': 'sample'
    },
    'updated_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
}

snapshots['test_update[uvloop-result1-True-Error-False] 1'] = {
    '_id': 'foo',
    'results': [
        {
            'blast': 'bar',
            'index': 2
        },
        {
            'blast': {
                'error': 'Error',
                'interval': 3,
                'last_checked_at': '2015-10-06T20:00:00+00:00',
                'ready': True,
                'result': {
                    'foo': 'bar'
                },
                'rid': 'ABC123'
            },
            'index': 5
        },
        {
            'blast': 'baz',
            'index': 12
        }
    ],
    'sample': {
        'id': 'sample'
    },
    'updated_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
}

snapshots['test_update[uvloop-result1-False-None-True] 1'] = {
    '_id': 'foo',
    'results': [
        {
            'blast': 'bar',
            'index': 2
        },
        {
            'blast': {
                'error': None,
                'interval': 3,
                'last_checked_at': '2015-10-06T20:00:00+00:00',
                'ready': False,
                'result': {
                    'foo': 'bar'
                },
                'rid': 'ABC123'
            },
            'index': 5
        },
        {
            'blast': 'baz',
            'index': 12
        }
    ],
    'sample': {
        'id': 'sample'
    },
    'updated_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
}

snapshots['test_update[uvloop-result1-False-None-False] 1'] = {
    '_id': 'foo',
    'results': [
        {
            'blast': 'bar',
            'index': 2
        },
        {
            'blast': {
                'error': None,
                'interval': 3,
                'last_checked_at': '2015-10-06T20:00:00+00:00',
                'ready': False,
                'result': {
                    'foo': 'bar'
                },
                'rid': 'ABC123'
            },
            'index': 5
        },
        {
            'blast': 'baz',
            'index': 12
        }
    ],
    'sample': {
        'id': 'sample'
    },
    'updated_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
}

snapshots['test_update[uvloop-result1-False-Error-True] 1'] = {
    '_id': 'foo',
    'results': [
        {
            'blast': 'bar',
            'index': 2
        },
        {
            'blast': {
                'error': 'Error',
                'interval': 3,
                'last_checked_at': '2015-10-06T20:00:00+00:00',
                'ready': False,
                'result': {
                    'foo': 'bar'
                },
                'rid': 'ABC123'
            },
            'index': 5
        },
        {
            'blast': 'baz',
            'index': 12
        }
    ],
    'sample': {
        'id': 'sample'
    },
    'updated_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
}

snapshots['test_update[uvloop-result1-False-Error-False] 1'] = {
    '_id': 'foo',
    'results': [
        {
            'blast': 'bar',
            'index': 2
        },
        {
            'blast': {
                'error': 'Error',
                'interval': 3,
                'last_checked_at': '2015-10-06T20:00:00+00:00',
                'ready': False,
                'result': {
                    'foo': 'bar'
                },
                'rid': 'ABC123'
            },
            'index': 5
        },
        {
            'blast': 'baz',
            'index': 12
        }
    ],
    'sample': {
        'id': 'sample'
    },
    'updated_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
}

snapshots['test_blast_remove[uvloop-True] 1'] = [
    {
        '_id': 'foo',
        'results': 'file',
        'sample': {
            'id': 'sample'
        },
        'updated_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
    },
    {
        '_id': 'bar',
        'results': [
            {
                'blast': 'bar',
                'index': 3
            },
            {
                'blast': 'baz',
                'index': 9
            }
        ],
        'sample': {
            'id': 'sample'
        },
        'updated_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
    }
]

snapshots['test_blast_remove[uvloop-False] 1'] = [
    {
        '_id': 'foo',
        'results': [
            {
                'blast': 'bar',
                'index': 2
            },
            {
                'blast': None,
                'index': 5
            },
            {
                'blast': 'baz',
                'index': 12
            }
        ],
        'sample': {
            'id': 'sample'
        },
        'updated_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
    },
    {
        '_id': 'bar',
        'results': [
            {
                'blast': 'bar',
                'index': 3
            },
            {
                'blast': 'baz',
                'index': 9
            }
        ],
        'sample': {
            'id': 'sample'
        },
        'updated_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
    }
]

snapshots['test_blast_remove[uvloop-True] 2'] = [
    {
        'blast': 'bar',
        'index': 2
    },
    {
        'blast': None,
        'index': 5
    },
    {
        'blast': 'baz',
        'index': 12
    }
]

snapshots['test_update_nuvs_blast[uvloop-True] 1'] = [
    {
        '_id': 'foo',
        'results': 'file',
        'sample': {
            'id': 'sample'
        },
        'updated_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
    },
    {
        '_id': 'bar',
        'results': [
            {
                'blast': 'bar',
                'index': 3
            },
            {
                'blast': 'baz',
                'index': 9
            }
        ],
        'sample': {
            'id': 'sample'
        },
        'updated_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
    }
]

snapshots['test_update_nuvs_blast[uvloop-False] 1'] = [
    {
        '_id': 'foo',
        'results': [
            {
                'blast': 'bar',
                'index': 2
            },
            {
                'blast': {
                    'error': None,
                    'interval': 3,
                    'last_checked_at': '2015-10-06T20:00:00+00:00',
                    'ready': True,
                    'result': {
                        'updated': True
                    },
                    'rid': 'ABC123'
                },
                'index': 5
            },
            {
                'blast': 'baz',
                'index': 12
            }
        ],
        'sample': {
            'id': 'sample'
        },
        'updated_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
    },
    {
        '_id': 'bar',
        'results': [
            {
                'blast': 'bar',
                'index': 3
            },
            {
                'blast': 'baz',
                'index': 9
            }
        ],
        'sample': {
            'id': 'sample'
        },
        'updated_at': GenericRepr('datetime.datetime(2015, 10, 6, 20, 0)')
    }
]

snapshots['test_update_nuvs_blast[uvloop-True] 2'] = [
    {
        'blast': 'bar',
        'index': 2
    },
    {
        'blast': {
            'error': None,
            'interval': 3,
            'last_checked_at': '2015-10-06T20:00:00+00:00',
            'ready': True,
            'result': {
                'updated': True
            },
            'rid': 'ABC123'
        },
        'index': 5
    },
    {
        'blast': 'baz',
        'index': 12
    }
]
