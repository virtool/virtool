from virtool.pathoscope import matrix
from virtool.pathoscope import report
from virtool.pathoscope import em
from virtool.pathoscope import sam


def run(sam_lines, tsv_path, reassign_path=None, intermediate=False, rewrite_sam=False, verbose=False):
    # Parse SAM file into matrix of read mapping proportions
    U, NU, genomes, reads = matrix.make(sam_lines)

    best_initial = compute_best_hit(
        U,
        NU,
        genomes,
        reads.count
    )

    init_pi, pi, NU = em.run(U, NU, genomes, verbose)

    best_final = compute_best_hit(U, NU, genomes, reads.count)

    reassigned_lines = sam.rewrite_align(U, NU, genomes, reads, sam_lines, reassign_path)

    results = report.write(
        tsv_path,
        reads.count,
        genomes.count,
        pi,
        genomes,
        init_pi,
        best_initial,
        best_final
    )

    return results, reads.count, reassigned_lines


def find_updated_score(nu, read_index, genome_index):
    """ Function to find the updated score after pathoscope reassignment """
    index = nu[read_index][0].index(genome_index)
    pscore_sum = 0

    for pscore in nu[read_index][1]:
        pscore_sum += pscore

    pscore_sum /= 100
    up_pscore = nu[read_index][2][index]

    return up_pscore, pscore_sum


def compute_best_hit(u, nu, genomes, read_count):
    """ Computes the best hit read metrics """
    reads = {}
    hits = {}

    for key in ["best", "level1", "level2"]:
        reads[key] = [0.0] * genomes.count

    for i in u:
        reads["best"][u[i][0]] += 1
        reads["level1"][u[i][0]] += 1

    for j in nu:
        z = nu[j]
        ind = z[0]
        xnorm = z[2]
        best_genome = max(xnorm)
        num_best_genome = 0

        for i in range(len(xnorm)):
            if xnorm[i] == best_genome:
                num_best_genome += 1

        if num_best_genome == 0:
            num_best_genome = 1

        for i in range(len(xnorm)):
            if xnorm[i] == best_genome:
                reads["best"][ind[i]] += 1 / num_best_genome
                if xnorm[i] >= 0.5:
                    reads["level1"][ind[i]] += 1
                elif xnorm[i] >= 0.01:
                    reads["level2"][ind[i]] += 1

    for key in reads.keys():
        hits[key] = [reads[key][k] / read_count for k in range(genomes.count)]

    return {
        "reads": reads["best"],
        "hits": hits
    }