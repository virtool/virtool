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
    sortBy,
    sumBy,
    toNumber,
    uniq
} from "lodash-es";
import { formatIsolateName } from "../utils/utils";

const calculateAnnotatedOrfCount = orfs => reject(orfs, { "hits.length": 0 }).length;

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

/**
 * Transform an array of coordinate pairs into an flat array where the index is the x coordinate and the value is the y
 * coordinate.
 *
 * @param {Array} align - the coordinates
 * @param {Number} length - the length of the generated flat array
 * @returns {Array} - the flat array
 *
 */
export const fillAlign = ({ align, length }) => {
    const filled = Array(length);

    if (!align) {
        return fill(filled, 0);
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
    if (detail.workflow === "pathoscope_bowtie") {
        return formatPathoscopeData(detail);
    }

    if (detail.workflow === "nuvs") {
        return formatNuVsData(detail);
    }

    if (detail.workflow === "aodp") {
        return formatAODPData(detail);
    }
};

export const formatAODPData = detail => {
    const results = map(detail.results, result => {
        const isolates = map(result.isolates, isolate => {
            const sequences = map(isolate.sequences, sequence => {
                return {
                    ...sequence,
                    identities: getSequenceIdentities(sequence)
                };
            });

            return {
                ...isolate,
                sequences,
                identities: getIdentities(sequences)
            };
        });

        const identities = getIdentities(isolates);

        return {
            ...result,
            isolates,
            identities,
            identity: max(identities)
        };
    });

    return { ...detail, results };
};

const getIdentities = data => flatMap(data, item => item.identities);

const getSequenceIdentities = sequence => flatMap(sequence.hits, hit => hit.identity);

export const formatNuVsData = detail => {
    const results = map(detail.results, result => ({
        ...result,
        id: toNumber(result.index),
        annotatedOrfCount: calculateAnnotatedOrfCount(result.orfs),
        e: calculateSequenceMinimumE(result.orfs),
        families: extractFamilies(result.orfs),
        names: extractNames(result.orfs)
    }));

    const longestSequence = maxBy(results, result => result.sequence.length);

    const { cache, created_at, id, ready, user, workflow } = detail;

    return {
        cache,
        created_at,
        id,
        ready,
        results,
        user,
        workflow,
        maxSequenceLength: longestSequence.sequence.length
    };
};

export const formatSequence = (sequence, readCount) => ({
    ...sequence,
    filled: fillAlign(sequence),
    reads: sequence.pi * readCount
});

export const formatPathoscopeData = detail => {
    if (detail.results.length === 0) {
        return detail;
    }

    const {
        cache,
        created_at,
        results,
        id,
        index,
        read_count,
        ready,
        reference,
        subtractions,
        user,
        workflow
    } = detail;

    const formatted = map(results, otu => {
        const isolateNames = [];

        // Go through each isolate associated with the OTU, adding properties for weight, read count,
        // median depth, and coverage. These values will be calculated from the sequences owned by each isolate.
        const isolates = map(otu.isolates, isolate => {
            // Make a name for the isolate by joining the source type and name, eg. "Isolate" + "Q47".
            const name = formatIsolateName(isolate);

            isolateNames.push(name);

            const sequences = sortBy(
                map(isolate.sequences, sequence => formatSequence(sequence, read_count)),
                "length"
            );

            const filled = flatMap(sequences, "filled");

            // Coverage is the number of non-zero depth positions divided by the total number of positions.
            const coverage = compact(filled).length / filled.length;

            return {
                ...isolate,
                name,
                filled,
                coverage,
                sequences,
                maxDepth: max(filled),
                pi: sumBy(sequences, "pi"),
                depth: median(filled)
            };
        });

        const filled = mergeCoverage(isolates);
        const pi = sumBy(isolates, "pi");

        return {
            ...otu,
            filled,
            pi,
            isolates: sortBy(isolates, "coverage").reverse(),
            coverage: maxBy(isolates, "coverage").coverage,
            depth: median(filled),
            isolateNames: reject(uniq(isolateNames), "Unnamed Isolate"),
            maxGenomeLength: maxBy(isolates, "filled.length").length,
            maxDepth: maxBy(isolates, "maxDepth").maxDepth,
            reads: pi * read_count
        };
    });

    return {
        cache,
        created_at,
        id,
        index,
        reference,
        results: formatted,
        read_count,
        ready,
        subtractions,
        subtractedCount: detail.subtracted_count,
        user,
        workflow
    };
};

export const fuseSearchKeys = {
    pathoscope_bowtie: ["name", "abbreviation"],
    nuvs: ["families", "names"],
    aodp: ["name"]
};

/**
 * Calculate the median of an Array of numbers.
 *
 * @param values - an array of numbers
 * @returns {number|*} - the median
 */
export const median = values => {
    const sorted = values.slice().sort((a, b) => a - b);

    const midIndex = (sorted.length - 1) / 2;

    if (midIndex % 1 === 0) {
        return sorted[midIndex];
    }

    const lowerIndex = Math.floor(midIndex);
    const upperIndex = Math.ceil(midIndex);

    return Math.round((sorted[lowerIndex] + sorted[upperIndex]) / 2);
};

/**
 * Merge the coverage arrays for the given isolates. This is used to render a representative coverage chart for the
 * parent OTU.
 *
 * @param isolates
 * @returns {Array}
 */
export const mergeCoverage = isolates => {
    const longest = maxBy(isolates, isolate => isolate.filled.length);
    const coverages = map(isolates, isolate => isolate.filled);
    return map(longest.filled, (depth, index) => max(map(coverages, coverage => coverage[index])));
};
