from virtool.pathoscope import sam


def run(isolate_sam, host_sam, snap=False):
    # Get a mapping score for every read mapped to the host genome
    host_scores = sam.all_scores(host_sam, snap=snap)

    # This list will contain the read_ids for all reads that had better mapping qualities against the host
    # genome
    skipped = list()

    subtracted_list = list()

    for line in isolate_sam:
        # Parse the virus SAM file and get the alignment score for each line
        if line[0] in ["#", "@"]:
            subtracted_list.append(line)
            continue

        l = line.split("\t")

        read_id = l[0]

        virus_score = sam.get_score(l, snap=snap)

        # Write each line from the virus SAM to a new file if its score is better against the virus
        # than the host. Discard it if it isn't and add the read_id to the list of skipped reads
        if virus_score is not None:
            try:
                if host_scores[read_id] >= virus_score:
                    subtracted_list.append(line)
                else:
                    skipped.append(read_id)
            except KeyError:
                subtracted_list.append(line)

    # Return the number of read mapping that were eliminated due to higher similarity to the host than to
    # the intitially mapped virus
    return subtracted_list, len((set(skipped)))