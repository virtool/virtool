__author__ = 'igboyes'

import random

from virtool.pathoscope import sam

def intergenome(sam_path, out_path, max_promiscuity=0.4):
    sam_file = sam.Parse(sam_path)

    # Delete reads that map to a defined fraction of the hit genomes (max_promiscuity)
    to_delete = list()
    max_genomes = int(len(sam_file.genomes()) * 0.4)

    for name in sam_file.reads():
        if len(sam_file.which_genomes(name)) > max_genomes:
            to_delete.append(name)

    for name in to_delete:
        sam_file.remove_name(name)

    sam_file.write_all(out_path)

    return len(to_delete)


def intragenome(sam_path, out_path):
    sam_file = sam.Parse(sam_path)

    # For reads that map multiple times within the same reference, reduce the mapping to one location. Try using the
    # highest mapping score. If further reduction is necessary, map randomly.
    count = 0

    for read_name in sam_file.reads():
        hit_set = sam_file.aligns.pop(read_name)
        new_set = dict()

        for genome_name, hits in hit_set.items():
            best_score = 0
            best = list()

            init_count = len(hits)

            for hit in hits:
                if hit[0] > best_score:
                    best = [hit]
                    best_score = hit[0]
                elif hit[0] == best_score:
                    best.append(hit)
                    best_score = hit[0]

            if len(best) > 1:
                new_set[genome_name] = [random.choice(best)]
            else:
                new_set[genome_name] = best

            if init_count > 1:
                count += init_count - 1

        sam_file.aligns[read_name] = new_set

    sam_file.write_all(out_path)

    return count