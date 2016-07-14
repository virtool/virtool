import math
import collections
from virtool.pathoscope import sam

class Store:
    """ Stores read and genome information and provides methods for access and modification """

    def __init__(self):
        self._lookup = {}
        self.count = 0
        self.names = []

    def mod(self, name):
        """ Get the index number for a given read/genome name. If it doesn't exist, create it. """
        try:
            return self._lookup[name]
        except KeyError:
            index = self.count
            self._lookup[name] = index
            self.names.append(name)
            self.count += 1

            return index

    def get(self, name):
        try:
            return self._lookup[name]
        except KeyError:
            raise KeyError("Name was not found in store")

    def exists(self, name):
        """ Returns true is the passed genome/read name exists in the lookup dict """
        return name in self._lookup


def make(sam):
    u = dict()
    nu = dict()

    genomes = Store()
    reads = Store()

    max_score = None
    min_score = None

    for read_id, ref_id, pos, length, p_score, a_score in sam.entries():

        if max_score is None or p_score > max_score:
            max_score = p_score

        if min_score is None or p_score < min_score:
            min_score = p_score

        genome_index = genomes.mod(ref_id)

        if reads.exists(read_id):
            read_index = reads.mod(read_id)

            if read_index in u:
                if genome_index in u[read_index][0]:
                    continue
                nu[read_index] = u[read_index]
                del u[read_index]

            if genome_index in nu[read_index][0]:
                continue

            nu[read_index][0].append(genome_index)
            nu[read_index][1].append(p_score)

            if p_score > nu[read_index][3]:
                nu[read_index][3] = p_score
        else:
            read_index = reads.mod(read_id)
            u[read_index] = [[genome_index], [p_score], [float(p_score)], p_score]

    u, nu = rescale_score(u, nu, max_score, min_score)

    for read_index in u:
        # Keep gIdx and score only
        u[read_index] = [u[read_index][0][0], u[read_index][1][0]]

    for read_index in nu:
        pScoreSum = sum(nu[read_index][1])
        # Normalizing pScore
        nu[read_index][2] = [k / pScoreSum for k in nu[read_index][1]]

    return u, nu, genomes, reads


def rescale_score(u, nu, max_score, min_score):
    """ Rescaling the sam alignment score and taking exponent """
    divisor = max_score

    if min_score < 0:
        divisor -= min_score

    factor = 100 / divisor

    for read_index in u:
        if min_score < 0:
            u[read_index][1][0] -= min_score

        u[read_index][1][0] = math.exp(u[read_index][1][0] * factor)
        u[read_index][3] = u[read_index][1][0]

    for read_index in nu:
        nu[read_index][3] = 0.0

        for i in range(0, len(nu[read_index][1])):
            if min_score < 0:
                nu[read_index][1][i] -= min_score

            nu[read_index][1][i] = math.exp(nu[read_index][1][i] * factor)

            if nu[read_index][1][i] > nu[read_index][3]:
                nu[read_index][3] = nu[read_index][1][i]

    return u, nu


def alignment_read_percentage(sam_path):
    # Variables retained from pathoscope
    genomes = []
    reads = []

    max_score = None
    min_score = None

    ref_scores = {}
    ref_scores_init = {}

    # Dictionaries of reads that are returned by the function; u = unique, nu = non-unique
    u = {}
    nu = {}

    # Count the number of hit references
    genome_count = 0
    read_count = 0

    # A dictionary of lists. Each key is a virus ID. The value is a list of viral sequences associated with
    # that virus_id that were aligned against during the Bowtie2 step.
    virus_hits = collections.defaultdict(list)

    # Initialize dictionaries that keys accessions and read_ids with generated genome_id numbers
    genome_lookup = {}
    read_lookup = {}

    # A dictionary of lists of reads keyed by the reference sequences against which they align
    ref_reads = collections.defaultdict(set)
    ref_scores = {}
    initial_ref_score = {}

    # Store all read sequences
    read_sequences = {}

    with open(sam_path, "r") as sam_file:
        for line in sam_file:
            # Skip header and comments lines
            if line[0] in ["@", "#"]:
                continue

            line = line.split("\t")

            # Get the IDs for the read and the reference sequence against which it is aligned.
            read_id = line[0]
            ref_id = line[1]

            if ref_id == '*':
                continue

            # Parse ref_id in virus ID and Genbank accession
            virus_id, accession = ref_id.split("|")

            # Associate the accession of the aligned read with a virus_id key so we know which representative
            # sequences were hit for each virus_id
            virus_hits[virus_id].append(accession)

            # Get the score the alignment described by the SAM line
            score = sam.get_score(line)

            # Skip the line if there is no alignment score for the read
            if score is None:
                continue

            # Calculate alignment parameters
            mapq = float(line[4])
            mapq2 = mapq / (-10.0)
            p = pow(10, mapq2)

            if p < 0.01:
                continue

            if max_score is None or score > max_score:
                max_score = score

            if min_score is None or score < min_score:
                min_score = score

            try:
                genome_index = genome_lookup[ref_id]
            except KeyError:
                # Tie a new integer genome_id to ref_id
                genome_lookup[ref_id] = genome_count

                # Set initial values
                ref_scores[ref_id] = 0
                initial_ref_score[ref_id] = 0

                # Attach ref_id to hit genomes
                genomes.append(ref_id)

                genome_count += 1

            # Add the read_id to a set of read_ids associated with the reference sequence (ref_id)
            ref_reads[ref_id].add(read_id)

            try:
                # The read is not uniquely mapped. It has already been placed in the read_lookup dictionary.
                # Add the information from the current SAM line to the NU (non-unique) reads dictionary.
                read_index = read_lookup[read_id]

                if read_index in u:
                    # If the read is hitting in a different reference than the current unique hit, move the
                    # to the non-unique (NU) dictionary. Otherwise do nothing
                    if genome_index not in u[read_index][0]:
                        nu[read_index] = u.pop(read_index)

                if genome_index in nu[read_index][0]:
                    continue

                nu[read_index][0].append(genome_index)
                nu[read_index][1].append(score)
                nu[read_index][2].append(p)

                if score > nu[read_index][3]:
                    nu[read_index][3] = score

            except KeyError:
                # The read is unique at this point. This will change if it is mentioned again in the SAM file
                read_lookup[read_id] = read_count
                reads.append(read_id)
                read_sequences[read_id] = line[9]
                read_count += 1

                # Add the read to the unique reads dictionary
                u[read_index] = [[genome_index], [score], [p], score]

    u, nu = rescale_score(u, nu, max_score, min_score)
    u_weights = 0.0

    for read_index in u:
        genome_index = u[read_index][0][0]

        # Keep genome_index and alignment score for weights
        u[read_index] = [genome_index, u[read_index][1][0]]
        u_weights += u[read_index][1]
        ref_scores[genomes[genome_index]] += u[read_index][1]
        ref_scores_init[genomes[genome_index]] += u[read_index][1]
        nu_weights = 0.0

    for read_index in nu:
        p_sum = sum(nu[read_index][2])

        # Normalize p score
        nu[read_index][2] = [k / p_sum for k in nu[read_index][2]]
        init_psum = sum(nu[read_index][1])

        # Normalize p score
        nu[read_index][1] = [k / init_psum for k in nu[read_index][1]]
        nu_weights += nu[read_index][3]

        for j in range(len(nu[read_index][0])):
            genome_index = nu[read_index][0][j]
            ref_scores[genomes[genome_index]] += 1.0 * nu[read_index][2][j] * nu[read_index][3]
            ref_scores_init[genomes[genome_index]] += 1.0 * nu[read_index][1][j] * nu[read_index][3]

    weight = u_weights + nu_weights

    for ref_id in ref_scores:
        ref_scores[ref_id] /= weight
        ref_scores_init[ref_id] /= weight

        # Normalizing p score
        pi = [1.0 * ref_scores[ref_id] for ref_id in genomes]
        pi_init = [1.0 * ref_scores_init[ref_id] for ref_id in genomes]

    return {
        "ref_reads": ref_reads,
        "ref_scires": ref_scores,
        "reads": reads,
        "read_sequences": read_sequences,
        "virus_hits": virus_hits,
        "u": u,
        "nu": nu,
        "genomes": genomes,
        "pi": pi,
        "pi_init": pi_init
    }