# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import GenericRepr, Snapshot


snapshots = Snapshot()

snapshots['test_get_rows[uvloop] 1'] = [
    GenericRepr('<IndexFile(id=1, name=reference.1.bt2, index=foo, type=bowtie2, size=1234567)>'),
    GenericRepr('<IndexFile(id=2, name=reference.2.bt2, index=foo, type=bowtie2, size=1234567)>'),
    GenericRepr('<IndexFile(id=3, name=reference.3.bt2, index=foo, type=bowtie2, size=1234567)>')
]

snapshots['test_get_row[uvloop] 1'] = GenericRepr('<IndexFile(id=1, name=reference.1.bt2, index=foo, type=bowtie2, size=1234567)>')
