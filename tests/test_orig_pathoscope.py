import os
import sys
import copy
import pytest

import virtool.pathoscope
import virtool.orig_pathoscope


SAM_PATH = os.path.join(sys.path[0], "tests", "test_files", "test_al.sam")


def convert_sam_to_vta(sam_path, vta_path, p_score_cutoff=0.01):
    with open(sam_path, "r") as sam_handle:
        with open(vta_path, "w") as vta_handle:
            for line in sam_handle:
                if line[0] == "@" or line[0] == "#":
                    continue

                fields = line.split("\t")

                # Bitwise FLAG - 0x4 : segment unmapped
                if int(fields[1]) & 0x4 == 4:
                    continue

                ref_id = fields[2]

                if ref_id == "*":
                    continue

                p_score = virtool.pathoscope.find_sam_align_score(fields)

                # Skip if the p_score does not meet the minimum cutoff.
                if p_score < p_score_cutoff:
                    continue

                print(fields[0])

                vta_handle.write(",".join([
                    fields[0],  # read_id
                    ref_id,
                    fields[3],  # pos
                    str(len(fields[9])),  # length
                    str(p_score)
                ]) + "\n")

    return vta_path


def test_find_sam_align_score(sam_line):
    new_score = virtool.pathoscope.find_sam_align_score(sam_line)
    old_score = virtool.orig_pathoscope.findSamAlignScore(sam_line)

    assert new_score == old_score


def test_build_matrix(tmpdir, test_sam_path):
    vta_path = os.path.join(str(tmpdir), "test.vta")

    print(vta_path)

    convert_sam_to_vta(test_sam_path, vta_path)

    old_result = virtool.orig_pathoscope.conv_align2GRmat(test_sam_path, 0.01, 1)
    new_result = virtool.pathoscope.build_matrix(vta_path, 0.01)

    assert old_result == new_result


@pytest.mark.parametrize("theta_prior", [0, 1e-5])
@pytest.mark.parametrize("pi_prior", [0, 1e-5])
@pytest.mark.parametrize("epsilon", [1e-6, 1e-7, 1e-8])
@pytest.mark.parametrize("max_iter", [5, 10, 20, 30])
def test_em(theta_prior, pi_prior, epsilon, max_iter, test_sam_path):
    matrix_tuple = virtool.pathoscope.build_matrix(test_sam_path, 0.01)

    u, nu, refs, reads = copy.deepcopy(matrix_tuple)
    new_result = virtool.pathoscope.em(u, nu, refs, max_iter, epsilon, pi_prior, theta_prior)

    u, nu, refs, reads = copy.deepcopy(matrix_tuple)
    old_result = virtool.orig_pathoscope.pathoscope_em(u, nu, refs, max_iter, epsilon, False, pi_prior, theta_prior)

    assert new_result == old_result


@pytest.mark.parametrize("cutoff", [0.01, 0.05, 0.1])
def test_compute_best_hit(cutoff, test_sam_path):
    matrix_tuple = virtool.pathoscope.build_matrix(test_sam_path, cutoff)

    u, nu, refs, reads = copy.deepcopy(matrix_tuple)
    new_result = virtool.pathoscope.compute_best_hit(u, nu, refs, reads)

    u, nu, refs, reads = copy.deepcopy(matrix_tuple)
    old_result = virtool.orig_pathoscope.computeBestHit(u, nu, refs, reads)

    assert new_result == old_result


def test_reassign(tmpdir, test_sam_path, capsys):

    class PathoOptions:

        def __init__(self):
            self.out_matrix_flag = False
            self.verbose = False
            self.score_cutoff = 0.01
            self.exp_tag = "vt"
            self.ali_format = "sam"
            self.ali_file = test_sam_path
            self.outdir = str(tmpdir)
            self.emEpsilon = 1e-7
            self.maxIter = 30
            self.noalign = False
            self.piPrior = 0
            self.thetaPrior = 0
            self.noCutOff = False

    old_result = virtool.orig_pathoscope.pathoscope_reassign(PathoOptions())

    realigned_path = os.path.join(str(tmpdir), "realigned.sam")
    report_path = os.path.join(str(tmpdir), "report.tsv")

    new_result = virtool.pathoscope.reassign(test_sam_path, report_path=report_path, realigned_path=realigned_path)

    assert old_result[1:11] == new_result[1:11]

    with open(os.path.join(str(tmpdir), "updated_test_al.sam"), "r") as old_sam_handle:
        with open(os.path.join(str(tmpdir), "realigned.sam"), "r") as new_sam_handle:
            assert old_sam_handle.read() == new_sam_handle.read()

    with open(os.path.join(str(tmpdir), "vt-sam-report.tsv"), "r") as old_report_handle:
        with open(os.path.join(str(tmpdir), "report.tsv"), "r") as new_report_handle:
            assert old_report_handle.read() == new_report_handle.read()
