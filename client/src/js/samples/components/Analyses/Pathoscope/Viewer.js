import React from "react";
import { map, max, maxBy, sumBy, reduce, sortBy } from "lodash-es";
import PropTypes from "prop-types";

import { Alert } from "../../../../base";
import { formatIsolateName } from "../../../../utils";

import PathoscopeController from "./Controller";

const calculateIsolateCoverage = (isolate, length) => (
    reduce(isolate.sequences, (sum, sequence) => (
        sum + sequence.coverage * (sequence.length / length)
    ), 0)
);

const PathoscopeViewer = (props) => {

    if (props.diagnosis.length > 0) {

        const mappedReadCount = props.read_count;

        const data = map(props.diagnosis, baseVirus => {
            // Go through each isolate associated with the virus, adding properties for weight, best-hit, read count,
            // and coverage. These values will be calculated from the sequences owned by each isolate.
            let isolates = map(baseVirus.isolates, isolate => {
                // Make a name for the isolate by joining the source type and name, eg. "Isolate" + "Q47".
                let name = formatIsolateName(isolate);

                if (name === "unknown unknown") {
                    name = "Unnamed Isolate";
                }

                const sequences = map(isolate.sequences, sequence => {
                    const reads = Math.round(sequence.pi * mappedReadCount);
                    const depth = sequence.align ? max(map(sequence.align, p => p[1])) : 0;
                    return {...sequence, reads, depth};
                });

                const length = sumBy(sequences, "length");

                const coverage = calculateIsolateCoverage(isolate, length);

                return {
                    ...isolate,
                    name,
                    length,
                    pi: sumBy(sequences, "pi"),
                    best: sumBy(sequences, "best"),
                    reads: sumBy(sequences, "reads"),
                    maxDepth: maxBy(sequences, "depth").depth,
                    coverage
                };
            });

            let coverage;

            if (isolates.length === 1) {
                coverage = isolates[0].coverage;
            } else {
                coverage = maxBy(isolates, "coverage").coverage;
            }

            isolates = sortBy(isolates, "coverage").reverse();

            const pi = sumBy(isolates, "pi");

            return {
                ...baseVirus,
                pi,
                coverage,
                isolates,
                best: sumBy(isolates, "best"),
                reads: pi * mappedReadCount,
                maxGenomeLength: maxBy(isolates, "length"),
                maxDepth: maxBy(isolates, "maxDepth").maxDepth
            };
        });

        return <PathoscopeController data={data} maxReadLength={props.maxReadLength} />;
    }

    return (
        <Alert bsStyle="info" className="text-center" icon="notification">
            No virus sequences found in sample
        </Alert>
    );

};

PathoscopeViewer.propTypes = {
    diagnosis: PropTypes.arrayOf(PropTypes.object),
    showListing: PropTypes.bool,
    read_count: PropTypes.number,
    maxReadLength: PropTypes.number
};

export default PathoscopeViewer;
