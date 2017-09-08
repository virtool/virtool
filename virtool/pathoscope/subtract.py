def run(isolate_sam, host_sam):
    # Get a mapping score for every read mapped to the host genome
    host_scores = host_sam.high_scores()

    subtracted_count = 0

    for read_id, isolate_high_score in isolate_sam.high_scores().items():
        # Write each line from the virus SAM to a new file if its score is better against the virus
        # than the host. Discard it if it isn't and add the read_id to the list of skipped reads
        try:
            if host_scores[read_id] >= isolate_high_score:
                isolate_sam.remove(read_id)
                subtracted_count += 1
        except KeyError:
            pass

    # Return the number of read mapping that were eliminated due to higher similarity to the host than to
    # the initially mapped virus
    return subtracted_count
