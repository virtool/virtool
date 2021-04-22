import collections
import copy
import csv
import math
import os
import shutil

import aiofiles


def rescale_samscore(u, nu, max_score, min_score):
    if min_score < 0:
        scaling_factor = 100.0 / max_score - min_score
    else:
        scaling_factor = 100.0 / max_score

    for read_index in u:
        if min_score < 0:
            u[read_index][1][0] = u[read_index][1][0] - min_score

        u[read_index][1][0] = math.exp(u[read_index][1][0] * scaling_factor)
        u[read_index][3] = u[read_index][1][0]

    for read_index in nu:
        nu[read_index][3] = 0.0

        for i in range(0, len(nu[read_index][1])):
            if min_score < 0:
                nu[read_index][1][i] = nu[read_index][1][i] - min_score

            nu[read_index][1][i] = math.exp(nu[read_index][1][i] * scaling_factor)

            if nu[read_index][1][i] > nu[read_index][3]:
                nu[read_index][3] = nu[read_index][1][i]

    return u, nu


def find_sam_align_score(fields):
    """
    Find the Bowtie2 alignment score for the given split line (``fields``).

    Searches the SAM fields for the ``AS:i`` substring and extracts the Bowtie2-specific alignment score. This will not
    work for other aligners.

    :param fields: a line that has been split on "\t"
    :type fields: list

    :return: the alignment score
    :rtype: float

    """
    read_length = float(len(fields[9]))

    for field in fields:
        if field.startswith("AS:i:"):
            a_score = int(field[5:])
            return a_score + read_length

    raise ValueError("Could not find alignment score")


def build_matrix(vta_path, p_score_cutoff=0.01):
    u = dict()
    nu = dict()

    h_read_id = {}
    h_ref_id = {}

    refs = []
    reads = []

    ref_count = 0
    read_count = 0

    max_score = 0
    min_score = 0

    with open(vta_path, "r") as handle:
        for line in handle:
            read_id, ref_id, _, _, p_score = line.rstrip().split(",")

            p_score = float(p_score)

            if p_score < p_score_cutoff:
                continue

            min_score = min(min_score, p_score)
            max_score = max(max_score, p_score)

            ref_index = h_ref_id.get(ref_id, -1)

            if ref_index == -1:
                ref_index = ref_count
                h_ref_id[ref_id] = ref_index
                refs.append(ref_id)
                ref_count += 1

            read_index = h_read_id.get(read_id, -1)

            if read_index == -1:
                # hold on this new read. first, wrap previous read profile and see if any previous read has a same
                # profile with that!
                read_index = read_count
                h_read_id[read_id] = read_index
                reads.append(read_id)
                read_count += 1
                u[read_index] = [[ref_index], [p_score], [float(p_score)], p_score]
            else:
                if read_index in u:
                    if ref_index in u[read_index][0]:
                        continue
                    nu[read_index] = u[read_index]
                    del u[read_index]

                if ref_index in nu[read_index][0]:
                    continue

                nu[read_index][0].append(ref_index)
                nu[read_index][1].append(p_score)

                if p_score > nu[read_index][3]:
                    nu[read_index][3] = p_score

    u, nu = rescale_samscore(u, nu, max_score, min_score)

    for read_index in u:
        # keep ref_index and score only
        u[read_index] = [u[read_index][0][0], u[read_index][1][0]]

    for read_index in nu:
        p_score_sum = sum(nu[read_index][1])
        # Normalize p_score.
        nu[read_index][2] = [k / p_score_sum for k in nu[read_index][1]]

    return u, nu, refs, reads


def em(u, nu, genomes, max_iter, epsilon, pi_prior, theta_prior):
    genome_count = len(genomes)

    pi = [1. / genome_count] * genome_count
    init_pi = copy.copy(pi)
    theta = copy.copy(pi)

    pi_sum_0 = [0] * genome_count

    u_weights = [u[i][1] for i in u]

    max_u_weights = 0
    u_total = 0

    if u_weights:
        max_u_weights = max(u_weights)
        u_total = sum(u_weights)

    for i in u:
        pi_sum_0[u[i][0]] += u[i][1]

    nu_weights = [nu[i][3] for i in nu]

    max_nu_weights = 0
    nu_total = 0

    if nu_weights:
        max_nu_weights = max(nu_weights)
        nu_total = sum(nu_weights)

    prior_weight = max(max_u_weights, max_nu_weights)
    nu_length = len(nu)

    if nu_length == 0:
        nu_length = 1

    # EM iterations
    for i in range(max_iter):
        pi_old = pi
        theta_sum = [0 for _ in genomes]

        # E Step
        for j in nu:
            z = nu[j]

            # A set of any genome mapping with j
            ind = z[0]

            # Get relevant pis for the read
            pi_tmp = [pi[k] for k in ind]

            # Get relevant thetas for the read.
            theta_tmp = [theta[k] for k in ind]

            # Calculate non-normalized xs
            x_tmp = [1. * pi_tmp[k] * theta_tmp[k] * z[1][k] for k in range(len(ind))]

            x_sum = sum(x_tmp)

            # Avoid dividing by 0 at all times.
            if x_sum == 0:
                x_norm = [0.0 for _ in x_tmp]
            else:
                # Normalize new xs.
                x_norm = [1. * k / x_sum for k in x_tmp]

            # Update x in nu.
            nu[j][2] = x_norm

            for k, _ in enumerate(ind):
                # Keep weighted running tally for theta
                theta_sum[ind[k]] += x_norm[k] * nu[j][3]

        # M step
        pi_sum = [theta_sum[k] + pi_sum_0[k] for k in range(len(theta_sum))]
        pip = pi_prior * prior_weight

        # Update pi.
        pi = [(1. * k + pip) / (u_total + nu_total + pip * len(pi_sum)) for k in pi_sum]

        if i == 0:
            init_pi = pi

        theta_p = theta_prior * prior_weight

        nu_total_div = nu_total

        if nu_total_div == 0:
            nu_total_div = 1

        theta = [(1. * k + theta_p) / (nu_total_div + theta_p * len(theta_sum)) for k in theta_sum]

        cutoff = 0.0

        for k, _ in enumerate(pi):
            cutoff += abs(pi_old[k] - pi[k])

        if cutoff <= epsilon or nu_length == 1:
            break

    return init_pi, pi, theta, nu


def find_updated_score(nu, read_index, ref_index):
    try:
        index = nu[read_index][0].index(ref_index)
    except ValueError:
        return 0.0, 0.0

    p_score_sum = 0.0

    for p_score in nu[read_index][1]:
        p_score_sum += p_score

    updated_pscore = nu[read_index][2][index]

    return updated_pscore


def compute_best_hit(u, nu, refs, reads):
    ref_count = len(refs)

    best_hit_reads = [0.0] * ref_count
    level_1_reads = [0.0] * ref_count
    level_2_reads = [0.0] * ref_count

    for i in u:
        best_hit_reads[u[i][0]] += 1
        level_1_reads[u[i][0]] += 1

    for j in nu:
        z = nu[j]
        ind = z[0]
        x_norm = z[2]
        best_ref = max(x_norm)
        num_best_ref = 0

        for i, _ in enumerate(x_norm):
            if x_norm[i] == best_ref:
                num_best_ref += 1

        num_best_ref = num_best_ref or 1

        for i, _ in enumerate(x_norm):
            if x_norm[i] == best_ref:
                best_hit_reads[ind[i]] += 1.0 / num_best_ref

                if x_norm[i] >= 0.5:
                    level_1_reads[ind[i]] += 1
                elif x_norm[i] >= 0.01:
                    level_2_reads[ind[i]] += 1

    ref_count = len(refs)
    read_count = len(reads)

    best_hit = [best_hit_reads[k] / read_count for k in range(ref_count)]
    level_1 = [level_1_reads[k] / read_count for k in range(ref_count)]
    level_2 = [level_2_reads[k] / read_count for k in range(ref_count)]

    return best_hit_reads, best_hit, level_1, level_2


def write_report(path, pi, refs, read_count, init_pi, best_hit_initial, best_hit_initial_reads, best_hit_final,
                 best_hit_final_reads, level_1_initial, level_2_initial, level_1_final, level_2_final):
    tmp = zip(
        pi,
        refs,
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

    tmp = sorted(tmp, reverse=True)

    x1, x2, x3, x4, x5, x6, x7, x8, x9, x10, x11 = zip(*tmp)

    no_cutoff = False

    for i, _ in enumerate(x10):
        if not no_cutoff and x1[i] < 0.01 and x10[i] <= 0 and x11[i] <= 0:
            break

        if i == (len(x10) - 1):
            i += 1

    # Changing the column order here
    tmp = zip(
        x2[:i],
        x1[:i],
        x6[:i],
        x7[:i],
        x10[:i],
        x11[:i],
        x3[:i],
        x4[:i],
        x5[:i],
        x8[:i],
        x9[:i]
    )

    with open(path, "w") as handle:
        csv_writer = csv.writer(handle, delimiter='\t')

        header = [
            "Genome",
            "Final Guess",
            "Final Best Hit",
            "Final Best Hit Read Numbers",
            "Final High Confidence Hits",
            "Final Low Confidence Hits",
            "Initial Guess",
            "Initial Best Hit",
            "Initial Best Hit Read Numbers",
            "Initial High Confidence Hits",
            "Initial Low Confidence Hits"
        ]

        header1 = ["Total Number of Aligned Reads:", read_count, "Total Number of Mapped Genomes:", len(refs)]

        csv_writer.writerow(header1)
        csv_writer.writerow(header)
        csv_writer.writerows(tmp)

    results = dict()

    for i, ref_id in enumerate(x2[:i]):
        if x1[i] < 0.01 and x10[i] <= 0 and x11[i] <= 0:
            pass
        else:
            results[ref_id] = {
                "final": {
                    "pi": x1[i],
                    "best": x6[i],
                    "high": x10[i],
                    "low": x11[i],
                    "reads": int(x7[i])
                },
                "initial": {
                    "pi": x3[i],
                    "best": x4[i],
                    "high": x8[i],
                    "low": x9[i],
                    "reads": int(x5[i])
                }
            }

    return results


def rewrite_align(u, nu, vta_path, p_score_cutoff, path):
    with open(path, 'w') as of:
        with open(vta_path, 'r') as in1:
            read_id_dict = {}
            ref_id_dict = {}
            genomes = []
            read = []
            ref_count = 0
            read_count = 0

            for line in in1:
                read_id, ref_id, _, _, p_score = line.split(",")

                p_score = float(p_score)

                if p_score < p_score_cutoff:
                    continue

                ref_index = ref_id_dict.get(ref_id, -1)

                if ref_index == -1:
                    ref_index = ref_count
                    ref_id_dict[ref_id] = ref_index
                    genomes.append(ref_id)
                    ref_count += 1

                read_index = read_id_dict.get(read_id, -1)

                if read_index == -1:
                    # hold on this new read
                    # first, wrap previous read profile and see if any previous read has a same profile with that!
                    read_index = read_count
                    read_id_dict[read_id] = read_index
                    read.append(read_id)
                    read_count += 1
                    if read_index in u:
                        of.write(line)
                        continue

                if read_index in nu:
                    if find_updated_score(nu, read_index, ref_index) < p_score_cutoff:
                        continue

                    of.write(line)


def calculate_coverage(path, ref_lengths):
    coverage_dict = dict()
    pos_length_list = list()

    with open(path, "r") as f:
        for line in f:
            _, ref_id, pos, length, _ = line.split(",")

            coverage_dict[ref_id] = None
            pos_length_list.append((ref_id, int(pos), int(length)))

    for key in coverage_dict:
        coverage_dict[key] = [0] * ref_lengths[key]

    for ref_id, pos, length in pos_length_list:
        start_index = pos - 1

        for i in range(start_index, start_index + length):
            try:
                coverage_dict[ref_id][i] += 1
            except IndexError:
                pass

    return coverage_dict


async def subtract(target_path, output_path, host_scores):
    isolates_high_scores = collections.defaultdict(int)

    async with aiofiles.open(target_path, "r") as f:
        async for line in f:
            fields = line.rstrip().split(",")
            read_id = fields[0]
            isolates_high_scores[read_id] = max(isolates_high_scores[read_id], float(fields[4]))

    subtracted_read_ids = set()

    async with aiofiles.open(target_path, "r") as f_vta:
        async with aiofiles.open(output_path, "w") as f_out:
            async for line in f_vta:
                fields = line.rstrip().split(",")
                read_id = fields[0]
                if isolates_high_scores[read_id] > host_scores.get(read_id, 0):
                    await f_out.write(line)
                else:
                    subtracted_read_ids.add(read_id)

    return len(subtracted_read_ids)


def replace_after_subtraction(src, dest):
    os.remove(dest)
    shutil.move(src, dest)
