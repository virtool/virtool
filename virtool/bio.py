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
