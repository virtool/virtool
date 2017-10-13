import os
import sys
import pytest
import shutil
import pickle
import filecmp

import virtool.pathoscope


SAM_PATH = os.path.join(sys.path[0], "tests", "test_files", "test_al.sam")
VTA_PATH = os.path.join(sys.path[0], "tests", "test_files", "test.vta")
MATRIX_PATH = os.path.join(sys.path[0], "tests", "test_files", "ps_matrix")
BEST_HIT_PATH = os.path.join(sys.path[0], "tests", "test_files", "best_hit")
SCORES = os.path.join(sys.path[0], "tests", "test_files", "scores")
EM_PATH = os.path.join(sys.path[0], "tests", "test_files", "em")
TSV_PATH = os.path.join(sys.path[0], "tests", "test_files", "report.tsv")
UNU_PATH = os.path.join(sys.path[0], "tests", "test_files", "unu")
UPDATED_VTA_PATH = os.path.join(sys.path[0], "tests", "test_files", "updated.vta")


@pytest.fixture("session")
def expected_em():
    with open(EM_PATH, "rb") as handle:
        em_dict = pickle.load(handle)

    return em_dict


@pytest.fixture("session")
def expected_scores():
    with open(SCORES, "rb") as handle:
        scores = pickle.load(handle)

    return scores


def test_find_sam_align_score(sam_line, expected_scores):
    assert virtool.pathoscope.find_sam_align_score(sam_line) == expected_scores["".join(sam_line)]


def test_build_matrix(tmpdir):
    shutil.copy(VTA_PATH, str(tmpdir))
    vta_path = os.path.join(str(tmpdir), "test.vta")

    with open(MATRIX_PATH, "rb") as handle:
        assert pickle.load(handle) == virtool.pathoscope.build_matrix(vta_path, 0.01)


@pytest.mark.parametrize("theta_prior", [0, 1e-5])
@pytest.mark.parametrize("pi_prior", [0, 1e-5])
@pytest.mark.parametrize("epsilon", [1e-6, 1e-7, 1e-8])
@pytest.mark.parametrize("max_iter", [5, 10, 20, 30])
def test_em(tmpdir, theta_prior, pi_prior, epsilon, max_iter, expected_em):
    shutil.copy(VTA_PATH, str(tmpdir))
    vta_path = os.path.join(str(tmpdir), "test.vta")

    u, nu, refs, _ = virtool.pathoscope.build_matrix(vta_path, 0.01)

    result = virtool.pathoscope.em(u, nu, refs, max_iter, epsilon, pi_prior, theta_prior)

    file_string = "_".join([str(i) for i in ["em", theta_prior, pi_prior, epsilon, max_iter]])

    assert result == expected_em[file_string]


def test_compute_best_hit():
    with open(MATRIX_PATH, "rb") as handle:
        matrix_tuple = pickle.load(handle)

    with open(BEST_HIT_PATH, "rb") as handle:
        assert pickle.load(handle) == virtool.pathoscope.compute_best_hit(*matrix_tuple)


async def test_rewrite_align(tmpdir):
    with open(UNU_PATH, "rb") as f:
        u, nu = pickle.load(f)

    shutil.copy(VTA_PATH, str(tmpdir))
    vta_path = os.path.join(str(tmpdir), "test.vta")

    rewrite_path = os.path.join(str(tmpdir), "rewrite.vta")

    virtool.pathoscope.rewrite_align(u, nu, vta_path, 0.01, rewrite_path)

    assert filecmp.cmp(UPDATED_VTA_PATH, rewrite_path)
    assert not filecmp.cmp(vta_path, rewrite_path)


async def test_calculate_coverage(tmpdir, test_sam_path):
    ref_lengths = dict()

    shutil.copy(VTA_PATH, str(tmpdir))
    vta_path = os.path.join(str(tmpdir), "test.vta")

    with open(test_sam_path, "r") as handle:
        for line in handle:
            if line[0:3] == "@SQ":
                ref_id = None
                length = None

                for field in line.rstrip().split("\t"):
                    if "SN:" in field:
                        ref_id = field.split(":")[1]
                    if "LN:" in field:
                        length = int(field.split(":")[1])

                assert ref_id and length
                assert ref_id not in ref_lengths

                ref_lengths[ref_id] = length

    virtool.pathoscope.calculate_coverage(vta_path, ref_lengths)


async def test_write_report(tmpdir):
    shutil.copy(VTA_PATH, str(tmpdir))
    vta_path = os.path.join(str(tmpdir), "test.vta")

    u, nu, refs, reads = virtool.pathoscope.build_matrix(vta_path, 0.01)

    with open(BEST_HIT_PATH, "rb") as handle:
        best_hit_initial_reads, best_hit_initial, level_1_initial, level_2_initial = pickle.load(handle)

    init_pi, pi, theta, nu = virtool.pathoscope.em(u, nu, refs, 30, 1e-7, 0, 0)

    best_hit_final_reads, best_hit_final, level_1_final, level_2_final = virtool.pathoscope.compute_best_hit(
        u,
        nu,
        refs,
        reads
    )

    report_path = os.path.join(str(tmpdir), "report.tsv")

    virtool.pathoscope.write_report(
        report_path,
        pi,
        refs,
        len(reads),
        init_pi,
        best_hit_initial,
        best_hit_initial_reads,
        best_hit_final,
        best_hit_final_reads,
        level_1_initial,
        level_2_initial,
        level_1_final,
        level_2_final
    )

    assert filecmp.cmp(report_path, TSV_PATH)



