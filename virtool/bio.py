def read_fasta(path):
    data = list()

    with open(path, "r") as f:
        header = None
        seq = []

        for line in f:
            if line[0] == ">":
                if header:
                    data.append((header, "".join(seq)))

                header = line.rstrip().replace(">", "")
                seq = []
                continue

            if header:
                seq.append(line.rstrip())
                continue

            raise IOError("Illegal FASTA line: {}".format(line))

    return data


def read_fastq(path):
    data = list()

    had_plus = False

    header = None
    seq = None

    with open(path, "r") as f:
        for line in f:
            if line == "+\n":
                had_plus = True
                continue

            if not had_plus:
                if line[0] == "@":
                    header = line.rstrip()
                    continue

                seq = line.rstrip()
                continue

            if had_plus:
                data.append((header, seq, line.rstrip()))

                header = None
                seq = None
                had_plus = False

    return data


def read_fastq_headers(path):
    headers = list()

    had_plus = False

    with open(path, "r") as f:
        for line in f:
            if line == "+\n":
                had_plus = True
                continue

            if not had_plus and line[0] == "@":
                headers.append(line.rstrip())
                continue

            if had_plus:
                had_plus = False

    return headers
