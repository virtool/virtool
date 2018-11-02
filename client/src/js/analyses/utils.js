import { compact, fill, flatMap, fromPairs, map, max, maxBy, mean, round, sortBy, sum, sumBy, unzip } from "lodash-es";
import { formatIsolateName } from "../utils/utils";

export const fillAlign = ({ align, length }) => {
    const filled = Array(length - 1);

    if (!align) {
        return fill(Array(length - 1), 0);
    }

    const coords = fromPairs(align);

    let prev = 0;

    return map(filled, (depth, i) => {
        if (coords.hasOwnProperty(i)) {
            prev = coords[i];
        }

        return prev;
    });
};

export const formatData = detail => {
    if (detail.diagnosis.length === 0) {
        return detail.diagnosis;
    }

    const mappedReadCount = detail.read_count;

    return map(detail.diagnosis, otu => {
        // Go through each isolate associated with the OTU, adding properties for weight, read count,
        // mean depth, and coverage. These values will be calculated from the sequences owned by each isolate.
        let isolates = map(otu.isolates, isolate => {
            // Make a name for the isolate by joining the source type and name, eg. "Isolate" + "Q47".
            let name = formatIsolateName(isolate);

            if (name === "unknown unknown") {
                name = "Unnamed Isolate";
            }

            const sequences = sortBy(
                map(isolate.sequences, sequence => {
                    const filled = fillAlign(sequence);

                    return {
                        ...sequence,
                        reads: round(sequence.pi * mappedReadCount),
                        meanDepth: mean(filled),
                        medianDepth: median(filled),
                        sumDepth: sum(filled),
                        filled
                    };
                }),
                "length"
            );

            const filled = flatMap(sequences, "filled");

            const length = filled.length;

            const coverage = compact(filled).length / length;

            return {
                ...isolate,
                name,
                filled,
                length,
                coverage,
                sequences,
                pi: sumBy(sequences, "pi"),
                reads: sumBy(sequences, "reads"),
                maxDepth: max(filled),
                meanDepth: mean(filled),
                medianDepth: median(filled)
            };
        });

        isolates = sortBy(isolates, "coverage").reverse();

        const pi = sumBy(isolates, "pi");

        const zipped = unzip(map(isolates, "sequences"));

        const maxByMean = map(zipped, sequences => maxBy(sequences, "meanDepth"));

        const maxByMedian = map(zipped, sequences => maxBy(sequences, "medianDepth"));

        const meanFilled = flatMap(maxByMean, "filled");
        const medianFilled = flatMap(maxByMedian, "filled");

        return {
            ...otu,
            isolates,
            pi,
            coverage: maxBy(isolates, "coverage").coverage,
            maxGenomeLength: maxBy(isolates, "length").length,
            maxDepth: maxBy(isolates, "maxDepth").maxDepth,
            meanDepth: mean(meanFilled),
            medianDepth: median(medianFilled),
            reads: pi * mappedReadCount
        };
    });
};

export const median = values => {
    const sorted = values.slice().sort();

    const midIndex = (sorted.length - 1) / 2;

    if (midIndex % 1 === 0) {
        return sorted[midIndex];
    }

    const lowerIndex = Math.floor(midIndex);
    const upperIndex = Math.ceil(midIndex);

    return (sorted[lowerIndex] + sorted[upperIndex]) / 2;
};
