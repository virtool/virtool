import {
    compact,
    fill,
    flatMap,
    fromPairs,
    keys,
    map,
    max,
    maxBy,
    min,
    minBy,
    reject,
    round,
    sortBy,
    sum,
    sumBy,
    uniq,
    unzip
} from "lodash-es";
import { formatIsolateName } from "../utils/utils";

const calculateAnnotatedOrfCount = orfs => reject(orfs, orf => orf.hits.length === 0).length;

const calculateORFMinimumE = hits => {
    if (hits.length === 0) {
        return;
    }

    const minHit = minBy(hits, "full_e");
    return minHit.full_e;
};

const calculateSequenceMinimumE = orfs => {
    if (orfs.length === 0) {
        return;
    }

    const minEValues = map(orfs, orf => calculateORFMinimumE(orf.hits));
    return min(minEValues);
};

export const extractFamilies = orfs => {
    const families = uniq(flatMap(orfs, orf => flatMap(orf.hits, hit => keys(hit.families))));
    return reject(families, f => f === "None");
};

export const extractNames = orfs => {
    return uniq(flatMap(orfs, orf => flatMap(orf.hits, hit => hit.names)));
};

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
    if (detail.algorithm === "pathoscope_bowtie") {
        return formatPathoscopeData(detail);
    }

    if (detail.algorithm === "nuvs") {
        return formatNuVsData(detail);
    }
};

export const formatNuVsData = detail => {
    const results = map(detail.results, result => ({
        ...result,
        annotatedOrfCount: calculateAnnotatedOrfCount(result.orfs),
        e: calculateSequenceMinimumE(result.orfs),
        families: extractFamilies(result.orfs),
        names: extractNames(result.orfs)
    }));

    const longestSequence = maxBy(results, result => result.sequence.length);

    return {
        results,
        maxSequenceLength: longestSequence.sequence.length
    };
};

export const formatPathoscopeData = detail => {
    if (detail.diagnosis.length === 0) {
        return detail.diagnosis;
    }

    const mappedReadCount = detail.read_count;

    return map(detail.diagnosis, otu => {
        // Go through each isolate associated with the OTU, adding properties for weight, read count,
        // median depth, and coverage. These values will be calculated from the sequences owned by each isolate.
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
                        depth: median(filled),
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
                depth: median(filled)
            };
        });

        isolates = sortBy(isolates, "coverage").reverse();

        const pi = sumBy(isolates, "pi");

        const zipped = unzip(map(isolates, "sequences"));

        const maxByDepth = map(zipped, sequences => maxBy(sequences, "depth"));

        const filled = flatMap(maxByDepth, "filled");

        return {
            ...otu,
            isolates,
            pi,
            coverage: maxBy(isolates, "coverage").coverage,
            maxGenomeLength: maxBy(isolates, "length").length,
            maxDepth: maxBy(isolates, "maxDepth").maxDepth,
            depth: median(filled),
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
