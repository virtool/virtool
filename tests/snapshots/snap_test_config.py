# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import GenericRepr, Snapshot


snapshots = Snapshot()

snapshots['test_schema 1'] = {
    'data_path': {
        'default': 'data',
        'type': 'string'
    },
    'db_connection_string': {
        'default': '',
        'type': 'string'
    },
    'db_name': {
        'default': '',
        'type': 'string'
    },
    'force_setup': {
        'coerce': GenericRepr('<function to_bool at 0x100000000>'),
        'default': False,
        'type': 'boolean'
    },
    'force_version': {
        'default': '',
        'type': 'string'
    },
    'host': {
        'default': 'localhost',
        'type': 'string'
    },
    'lg_mem': {
        'coerce': GenericRepr("<class 'int'>"),
        'default': 8,
        'type': 'integer'
    },
    'lg_proc': {
        'coerce': GenericRepr("<class 'int'>"),
        'default': 4,
        'type': 'integer'
    },
    'mem': {
        'coerce': GenericRepr("<class 'int'>"),
        'default': 8,
        'type': 'integer'
    },
    'port': {
        'coerce': GenericRepr("<class 'int'>"),
        'default': 9950,
        'type': 'integer'
    },
    'proc': {
        'coerce': GenericRepr("<class 'int'>"),
        'default': 4,
        'type': 'integer'
    },
    'proxy': {
        'default': '',
        'type': 'string'
    },
    'sm_mem': {
        'coerce': GenericRepr("<class 'int'>"),
        'default': 4,
        'type': 'integer'
    },
    'sm_proc': {
        'coerce': GenericRepr("<class 'int'>"),
        'default': 2,
        'type': 'integer'
    },
    'watch_path': {
        'default': 'watch',
        'type': 'string'
    }
}
