import math
import collections


class Parse:

    def __init__(self, sam_list):
        self._header = list()
        self.aligns = collections.defaultdict(dict)

        for line in sam_list:
            # Store stripped header lines
            if line[0] in ["#", "@"]:
                self._header.append(line.rstrip())
                continue

            l = line.rstrip().split("\t")

            # Skip unmapped reads
            if int(l[1]) & 0x4 == 4 or l[2] == "*":
                continue

            pScore, skip = entry_score(l, 0.01)

            if skip:
                pScore = None

            read = l[0]
            ref = l[2]

            try:
                self.aligns[read][ref].append((pScore, line))
            except:
                self.aligns[read][ref] = [(pScore, line)]

    def which_genomes(self, name):
        return list(self.aligns[name].keys())

    def genomes(self, ):
        unique = set()

        for read_name, refs in self.aligns.items():
            unique.update(list(refs.keys()))

        return list(unique)

    def reads(self):
        return list(self.aligns.keys())

    def by_read(self, name, no_line=False):
        return self.aligns[name]

    def remove_name(self, read_name):
        del self.aligns[read_name]

    def write_all(self, path):
        with open(path, "w") as output:
            for line in self._header:
                output.write(line)
            for read_name, per_genome in self.aligns.items():
                for genome_name, hits in per_genome.items():
                    for score, line in hits:
                        output.write(line)


class Minimal:

    def __init__(self):
        self._header = []
        self._aligns = collections.defaultdict(lambda: collections.defaultdict(list))

    def add(self, line):
        # Store stripped header lines
        if line[0] in ["#", "@"]:
            self._header.append(line.rstrip())
            return

        split = line.rstrip().split("\t")

        # Skip unmapped reads
        if int(split[1]) & 0x4 == 4 or split[2] == "*":
            return

        p_score, skip = entry_score(split, 0.01)

        if skip:
            p_score = None

        read = split[0]
        ref = split[2]

        self._aligns[read][ref].append((
            p_score,
            line
        ))

    def which_genomes(self, name):
        return list(self._aligns[name].keys())

    def genomes(self, ):
        unique = set()

        for read_name, refs in self._aligns.items():
            unique.update(list(refs.keys()))

        return list(unique)

    def reads(self):
        return list(self._aligns.keys())

    def write_all(self, path):
        with open(path, "w") as output:
            for line in self._header:
                output.write(line)
            for read_name, per_genome in self._aligns.items():
                for genome_name, hits in per_genome.items():
                    for score, line in hits:
                        output.write(line)


def coverage(sam_lines, ref_lengths):
    align = dict()

    for line in sam_lines:
        if line[0] in ["#", "@"]:
            continue

        line = line.split("\t")

        ref_id = line[2]

        if ref_id not in ref_lengths:
            continue

        pos = int(line[3])
        seq_length = len(line[9])

        if ref_id not in align:
            align[ref_id] = [0] * ref_lengths[ref_id]

        for i in range(pos, pos + seq_length):
            try:
                align[ref_id][i] += 1
            except IndexError:
                pass

    depth = {}

    for ref_id in align:
        length = len(align[ref_id])

        depth[ref_id] = {
            "coverage": 1 - align[ref_id].count(0) / length,
            "depth": sum(align[ref_id]) / length,
            "align": align[ref_id]
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


def all_scores(sam_list, snap=False):
    """ Returns a dictionary containing alignment scores for all read_ids in a given SAM alignment file """
    scores = {}

    for ln in sam_list:
        if (ln[0] == '@' or ln[0] == '#'):
            continue

        l = ln.split('\t')
        read_id = l[0]
        aScore = get_score(l, snap=snap)
        if aScore is not None:
            score = scores.get(read_id, None)
            if score is None or score < aScore:
                scores[read_id] = aScore

    return scores


def rewrite_align(U, NU, genomes, reads, sam_lines, out_path, min_pscore=0.01):
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

            if rIdx in U:
                new_sam.write(line + "\n")
                new_sam_lines.append(line)
                continue

            if rIdx in NU:
                upPscore, pscoreSum = find_updated_score(NU, rIdx, gIdx)

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