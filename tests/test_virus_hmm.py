import concurrent.futures
import gzip
import json
import operator
import os
import pytest
import shutil
import subprocess
import sys

import virtool.virus_hmm


TEST_FILE_PATH = os.path.join(sys.path[0], "tests", "test_files")


class TestHMMStat:

    async def test_valid(self, loop, tmpdir):
        """
        Test that the correct values are return when hmmstat is run on the test file

        """
        path = os.path.join(str(tmpdir), "profiles.hmm")

        shutil.copyfile(os.path.join(TEST_FILE_PATH, "test.hmm"), path)

        loop.set_default_executor(concurrent.futures.ThreadPoolExecutor())

        assert await virtool.virus_hmm.hmmstat(loop, path) == [
            {'cluster': 2, 'count': 253, 'length': 356},
            {'cluster': 3, 'count': 216, 'length': 136},
            {'cluster': 4, 'count': 210, 'length': 96},
            {'cluster': 5, 'count': 208, 'length': 133},
            {'cluster': 8, 'count': 101, 'length': 612},
            {'cluster': 9, 'count': 97, 'length': 500},
            {'cluster': 10, 'count': 113, 'length': 505}
        ]

    async def test_bad_file(self, loop, bad_hmm_path):
        """
        Make sure hmmstat call fails for a damaged hmm file.

        """
        loop.set_default_executor(concurrent.futures.ThreadPoolExecutor())

        with pytest.raises(subprocess.CalledProcessError) as err:
            await virtool.virus_hmm.hmmstat(loop, bad_hmm_path)

        assert "returned non-zero" in str(err)

    async def test_missing_file(self, loop):
        """
        Make sure hmmstat fails when the provided path does not exist

        """
        loop.set_default_executor(concurrent.futures.ThreadPoolExecutor())

        with pytest.raises(FileNotFoundError) as err:
            await virtool.virus_hmm.hmmstat(loop, "/home/watson/crick.hmm")

        assert "HMM file does not exist" in str(err)


class TestVFamToJSON:

    def test_valid(self, annotation_path, expected_annotations):
        """
        Test that the collection of vFam text files is correctly translated to JSON.

        """
        result = virtool.virus_hmm.vfam_text_to_json(annotation_path)

        to_check = [{key: r[key] for key in r if key not in ("entries", "genera", "families")} for r in result]

        to_check = sorted(to_check, key=operator.itemgetter("cluster"))
        expected_annotations = sorted(to_check, key=operator.itemgetter("cluster"))

        assert all(x == y for x, y in zip(to_check, expected_annotations))

        assert not os.path.isfile("./annotations.json.gz")

    def test_write_file(self, annotation_path, expected_annotations, tmpdir):
        """
        Test that the JSON data is written to the output path when it is provided.

        """
        path = os.path.join(str(tmpdir), "annotations.json.gz")

        virtool.virus_hmm.vfam_text_to_json(annotation_path, path)

        assert os.path.isfile(path)

        with gzip.open(path, "rt") as json_file:
            output = json.load(json_file)

        to_check = [{key: r[key] for key in r if key not in ["entries", "genera", "families"]} for r in output]

        to_check = sorted(to_check, key=operator.itemgetter("cluster"))
        expected_annotations = sorted(to_check, key=operator.itemgetter("cluster"))

        assert all(x == y for x, y in zip(to_check, expected_annotations))
