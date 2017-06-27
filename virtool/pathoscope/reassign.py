import virtool.sam
import virtool.pathoscope.matrix
import virtool.pathoscope.report
import virtool.pathoscope.em


def run(sam, tsv_path, verbose=False):

    min_pscore = 0.01

    # Calculate a Pathoscope matrix from the SAM file (isolates).
    u, nu, genomes, reads = virtool.pathoscope.matrix.make(sam)

    best_initial = compute_best_hit(
        u,
        nu,
        genomes,
        reads.count
    )

    init_pi, pi, nu = virtool.pathoscope.em.run(u, nu, genomes, verbose)

    best_final = compute_best_hit(
        u,
        nu,
        genomes,
        reads.count
    )

    new_sam = virtool.sam.Data()

    for read_id, ref_id, pos, length, p_score, a_score in sam.entries():
        if p_score < min_pscore:
            continue

        read_index = reads.get(read_id)
        genome_index = genomes.get(ref_id)

        if read_index in u:
            new_sam.add(read_id, ref_id, pos, length, p_score, a_score)
            continue

        if read_index in nu:
            updated_pscore, pscore_sum = find_updated_score(nu, read_index, genome_index)

            if updated_pscore < min_pscore:
                continue

            if updated_pscore >= 1.0:
                updated_pscore = 0.999999

            # mapq2 = math.log10(1 - updated_pscore)
            # l[4] = str(int(round(-10.0 * mapq2)))
            # line = "\t".join(l)
            new_sam.add(read_id, ref_id, pos, length, updated_pscore, a_score)

    results = virtool.pathoscope.report.write(
        tsv_path,
        reads.count,
        genomes.count,
        pi,
        genomes,
        init_pi,
        best_initial,
        best_final
    )

    return results, reads.count, new_sam


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