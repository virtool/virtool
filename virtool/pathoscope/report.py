import csv


def write(tsv_path, nR, nG, pi, genomes, initPi, best_initial, best_final):
    """ Function to create the tsv file report """

    with open(tsv_path, 'w', newline="") as tsv_file:
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

        tmp = zip(
            pi,
            genomes.names,
            initPi,
            best_initial["hits"]["best"],
            best_initial["reads"],
            best_final["hits"]["best"],
            best_final["reads"],
            best_initial["hits"]["level1"],
            best_initial["hits"]["level2"],
            best_final["hits"]["level1"],
            best_final["hits"]["level2"]
        )

        # Sorting based on Final Guess
        tmp = sorted(tmp, reverse=True)
        x1, x2, x3, x4, x5, x6, x7, x8, x9, x10, x11 = zip(*tmp)

        for i in range(len(x10)):
            if (x1[i] < 0.01 and x10[i] <= 0 and x11[i] <= 0):
                break

            if i == len(x10) - 1:
                i += 1

        # Changing the column order here
        tmp = zip(x2[:i], x1[:i], x6[:i], x7[:i], x10[:i], x11[:i], x3[:i], x4[:i], x5[:i], x8[:i], x9[:i])

        csv_writer = csv.writer(tsv_file, delimiter='\t')
        csv_writer.writerow(header)
        csv_writer.writerows(tmp)

        # Make dictionary from results
        results = []

        for i, name in enumerate(x2[:i]):
            if x1[i] < 0.01 and x10[i] <= 0 and x11[i] <= 0:
                pass
            else:
                entry = {
                    "genome": name,
                    "final": {
                        "pi": x1[i],
                        "best": x6[i],
                        "high": x10[i],
                        "low": x11[i],
                        "reads": x7[i]
                    },
                    "initial": {
                        "pi": x3[i],
                        "best": x4[i],
                        "high": x8[i],
                        "low": x9[i],
                        "reads": x5[i]
                    }
                }

                results.append(entry)

        return results


def matrix(genomes, reads):
    with open("test-genomeId.txt", "w", newline="") as genome_file:
        writer = csv.writer(genome_file, delimiter="\n")
        writer.writerows([genomes.names])

    with open("test-readId.txt", "w", newline="") as read_file:
        writer = csv.writer(read_file, delimiter="\n")
        writer.writerows([reads.names])