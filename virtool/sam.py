import collections


class Base:

    def __init__(self):
        self._header = []
        self._aligns = collections.defaultdict(lambda: collections.defaultdict(list))

    def entries(self):
        for read_id, per_ref in self._aligns.items():
            for ref_id, hits in per_ref.items():
                for hit in hits:
                    yield (read_id, ref_id, hit[0], hit[1], hit[2], hit[3])

    def high_scores(self):
        """ Returns a dictionary containing alignment scores for all read_ids """
        return {entry[0]: entry[3] for entry in self.entries()}


def coverage(sam, ref_lengths):
    align = dict()

    for read_id, ref_id, pos, length, p_score, a_score in sam.entries():
        if ref_id not in ref_lengths:
            continue

        if ref_id not in align:
            align[ref_id] = [0] * ref_lengths[ref_id]

        for i in range(pos, pos + length):
            try:
                align[ref_id][i] += 1
            except IndexError:
                pass

    depth = dict()

    for ref_id, ref in align.items():
        length = len(ref)

        depth[ref_id] = {
            "coverage": 1 - ref.count(0) / length,
            "depth": sum(ref) / length,
            "align": ref
        }

    return depth


def get_score(line):
    read_length = len(line[9])
    use_mapq = True

    score = None

    for i in range(11, len(line)):
        if use_mapq and line[i].startswith("AS:i:"):
            score = int(line[i][5:])
            use_mapq = False
        elif line[i].startswith("YS:i:"):
            # For paired end we simply multiply read length by 2
            score += int(line[i][5:])
            read_length *= 2
            break

    if use_mapq:
        score = None
    else:
        score += read_length

    return score
