import math
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

    def genomes(self):
        unique = set()

        for read_name, refs in self._aligns.items():
            unique.update(list(refs.keys()))

        return list(unique)

    def remove(self, read_id):
        del self._aligns[read_id]

    def reads(self):
        return list(self._aligns.keys())


class Lines(Base):

    def __init__(self, snap=False):
        super().__init__()
        self.snap = snap

    def add(self, line):
        # Store stripped header lines
        if line[0] in ["#", "@"]:
            self._header.append(line.rstrip())
            return

        split = line.rstrip().split("\t")

        ref_id = split[2]

        if ref_id == "*":
            return

        read_id = split[0]

        # Skip unmapped reads
        if int(split[1]) & 0x4 == 4 or split[2] == "*":
            return

        p_score, skip = entry_score(split, 0.01)

        if skip:
            return

        pos = int(split[3])
        length = len(split[9])

        a_score = get_score(split, snap=self.snap)

        self._aligns[read_id][ref_id].append((
            pos,
            length,
            p_score,
            a_score
        ))


class Data(Base):

    def __init__(self):
        super().__init__()

    def add(self, read_id, ref_id, pos, length, p_score, a_score):

        self._aligns[read_id][ref_id].append((
            pos,
            length,
            p_score,
            a_score
        ))


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


def entry_score(line, score_cutoff):
    """ Finds the alignment score + read length for the given entry from sam file """
    skip = False

    score = get_score(line)

    if score is None:
        mapq2 = float(line[4]) / -10
        score = 1 - pow(10, mapq2)
        if score < score_cutoff:
            skip = True

    return score, skip


def get_score(line, snap=False):
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
        if snap:
            score = line[4]
        else:
            score = None
    else:
        score += read_length

    return score


def rewrite_align(u, nu, genomes, reads, sam_lines, out_path, min_pscore=0.01):
    new_sam_lines = list()
    valid_refs = set()

    with open(out_path, 'w') as new_sam:
        for line in sam_lines:
            if line[0] in ["#", "@"]:
                new_sam.write(line + "\n")
                new_sam_lines.append(line)
                continue

            l = line.split("\t")

            readId = l[0]
            refId = l[2]

            valid_refs.add(refId)

            if refId == '*':
                continue

            if int(l[1]) & 0x4 == 4:
                continue

            # Check skip boolean for line score
            if entry_score(l, min_pscore)[1]:
                continue

            gIdx = genomes.get(refId)
            rIdx = reads.get(readId)

            if rIdx in u:
                new_sam.write(line + "\n")
                new_sam_lines.append(line)
                continue

            if rIdx in nu:
                upPscore, pscoreSum = find_updated_score(nu, rIdx, gIdx)

                if upPscore < min_pscore:
                    continue

                if upPscore >= 1.0:
                    upPscore = 0.999999

                mapq2 = math.log10(1 - upPscore)
                l[4] = str(int(round(-10.0 * mapq2)))
                line = "\t".join(l)
                new_sam.write(line + "\n")
                new_sam_lines.append(line)

    return new_sam_lines


def find_updated_score(NU, rIdx, gIdx):
    index = NU[rIdx][0].index(gIdx)
    pscoreSum = 0.0

    for pscore in NU[rIdx][1]:
        pscoreSum += pscore

    pscoreSum /= 100
    upPscore = NU[rIdx][2][index]
    return (upPscore, pscoreSum)