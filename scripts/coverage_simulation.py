import random
import sys
import collections

path = sys.argv[1]

read_range = range(36, 101)

reference_length = 12000

iterations = 50
i = 0

result = collections.defaultdict(list)

while i < iterations:

    print('iteration ' + str(i))

    read = 1
    read_count = 5000
    reference = [False] * 12000

    while read <= read_count:
        length = random.choice(read_range)
        position = random.choice(range(0, reference_length - length))

        for position in range(position, position + length):
            reference[position] = True

        result[read].append(reference.count(True) / reference_length)

        read += 1

    i += 1

with open(path, 'w') as output:
    for count, coverage in result.items():
        output.write(str(count) + "," + ",".join([str(val) for val in coverage]) + "\n")
