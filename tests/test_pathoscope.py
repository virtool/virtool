import pytest
import shutil
import pickle
import filecmp
from pathlib import Path

import virtool.pathoscope

BASE_PATH = Path.cwd() / "tests" / "test_files" / "pathoscope"
BEST_HIT_PATH = Path.cwd() / BASE_PATH / "best_hit"
EM_PATH = BASE_PATH / "em"
MATRIX_PATH = BASE_PATH / "ps_matrix"
SAM_PATH = BASE_PATH / "test_al.sam"
SCORES = BASE_PATH / "scores"
TSV_PATH = BASE_PATH / "report.tsv"
UNU_PATH = BASE_PATH / "unu"
UPDATED_VTA_PATH = BASE_PATH / "updated.vta"
VTA_PATH = BASE_PATH / "test.vta"


@pytest.fixture(scope="session")
def expected_em():
    with open(EM_PATH, "rb") as handle:
        em_dict = pickle.load(handle)

    return em_dict


@pytest.fixture(scope="session")
def expected_scores():
    with open(SCORES, "rb") as handle:
        scores = pickle.load(handle)

    return scores


def test_find_sam_align_score(sam_line, expected_scores):
    assert virtool.pathoscope.find_sam_align_score(sam_line) == expected_scores["".join(sam_line)]


def test_build_matrix(tmp_path):
    shutil.copy(VTA_PATH, tmp_path)
    vta_path = tmp_path / "test.vta"

    with open(MATRIX_PATH, "rb") as handle:
        expected = pickle.load(handle)

    actual = virtool.pathoscope.build_matrix(vta_path, 0.01)

    assert expected[0] == actual[0]
    assert expected[1] == actual[1]

    assert sorted(expected[2]) == sorted(actual[2])
    assert sorted(expected[3]) == sorted(actual[3])


@pytest.mark.parametrize("theta_prior", [0, 1e-5])
@pytest.mark.parametrize("pi_prior", [0, 1e-5])
@pytest.mark.parametrize("epsilon", [1e-6, 1e-7, 1e-8])
@pytest.mark.parametrize("max_iter", [5, 10, 20, 30])
def test_em(tmp_path, theta_prior, pi_prior, epsilon, max_iter, expected_em):
    shutil.copy(VTA_PATH, tmp_path)
    vta_path = tmp_path / "test.vta"

    u, nu, refs, _ = virtool.pathoscope.build_matrix(vta_path, 0.01)

    result = virtool.pathoscope.em(u, nu, refs, max_iter, epsilon, pi_prior, theta_prior)

    file_string = "_".join([str(i) for i in ["em", theta_prior, pi_prior, epsilon, max_iter]])

    for i in [0, 1, 2]:
        assert sorted(result[i]) == sorted(expected_em[file_string][i])

    assert result[3] == expected_em[file_string][3]


def test_compute_best_hit():
    """
    Test that :meth:`compute_best_hit` gives the expected result given some input data.

    """
    with open(MATRIX_PATH, "rb") as handle:
        matrix_tuple = pickle.load(handle)

    with open(BEST_HIT_PATH, "rb") as handle:
        assert pickle.load(handle) == virtool.pathoscope.compute_best_hit(*matrix_tuple)


def test_rewrite_align(tmp_path):
    with open(UNU_PATH, "rb") as f:
        u, nu = pickle.load(f)

    shutil.copy(VTA_PATH, tmp_path)
    vta_path = tmp_path / "test.vta"

    rewrite_path = tmp_path / "rewrite.vta"

    virtool.pathoscope.rewrite_align(u, nu, vta_path, 0.01, rewrite_path)

    assert filecmp.cmp(UPDATED_VTA_PATH, rewrite_path)
    assert not filecmp.cmp(vta_path, rewrite_path)


def test_calculate_coverage(tmp_path, test_sam_path):
    ref_lengths = dict()

    shutil.copy(VTA_PATH, tmp_path)
    vta_path = tmp_path / "test.vta"

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


def test_write_report(tmp_path):
    shutil.copy(VTA_PATH, tmp_path)
    vta_path = tmp_path / "test.vta"

    u, nu, refs, reads = virtool.pathoscope.build_matrix(vta_path, 0.01)

    with open(BEST_HIT_PATH, "rb") as handle:
        best_hit_initial_reads, best_hit_initial, level_1_initial, level_2_initial = pickle.load(handle)

    init_pi, pi, _, nu = virtool.pathoscope.em(u, nu, refs, 30, 1e-7, 0, 0)

    best_hit_final_reads, best_hit_final, level_1_final, level_2_final = virtool.pathoscope.compute_best_hit(
        u,
        nu,
        refs,
        reads
    )

    report_path = tmp_path / "report.tsv"

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
