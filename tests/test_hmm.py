import os
import gzip
import json
import pytest
import operator
import subprocess

from virtool.virus_hmm import hmmstat, vfam_text_to_json


class TestHMMStat:

    def test_valid(self, hmm_path, hmm_stat_result):
        """
        Test that the correct values are return when hmmstat is run on the test file

        """
        output = hmmstat(hmm_path[1])
        assert output == hmm_stat_result

    def test_bad_file(self, bad_hmm_path):
        """
        Make sure hmmstat call fails for a damaged hmm file.

        """
        with pytest.raises(subprocess.CalledProcessError) as err:
            hmmstat(bad_hmm_path)

        assert "returned non-zero" in str(err)

    def test_missing_file(self):
        """
        Make sure hmmstat fails when the provided path does not exist

        """
        with pytest.raises(FileNotFoundError) as err:
            hmmstat("/home/watson/crick.hmm")

        assert "HMM file does not exist" in str(err)


class TestVFamToJSON:

    def test_valid(self, annotation_path, expected_annotations):
        """
        Test that the collection of vFam text files is correctly translated to JSON.

        """
        result = vfam_text_to_json(annotation_path)

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

        vfam_text_to_json(annotation_path, path)

        assert os.path.isfile(path)

        with gzip.open(path, "rt") as json_file:
            output = json.load(json_file)

        to_check = [{key: r[key] for key in r if key not in ["entries", "genera", "families"]} for r in output]

        to_check = sorted(to_check, key=operator.itemgetter("cluster"))
        expected_annotations = sorted(to_check, key=operator.itemgetter("cluster"))

        assert all(x == y for x, y in zip(to_check, expected_annotations))
