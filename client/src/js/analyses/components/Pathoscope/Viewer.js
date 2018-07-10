import {compact, flatMap, map, max, maxBy, mean, round, sortBy, sum, sumBy} from "lodash-es";
import PropTypes from "prop-types";
import React from "react";

import {Alert} from "../../../base/index";
import {formatIsolateName} from "../../../utils";
import {fillAlign, median} from "../../utils";
import PathoscopeController from "./Controller";

const PathoscopeViewer = (props) => {

    if (props.diagnosis.length > 0) {

        const mappedReadCount = props.read_count;

        const data = map(props.diagnosis, baseOTU => {
            // Go through each isolate associated with the OTU, adding properties for weight, read count,
            // mean depth, and coverage. These values will be calculated from the sequences owned by each isolate.
            let isolates = map(baseOTU.isolates, isolate => {
                // Make a name for the isolate by joining the source type and name, eg. "Isolate" + "Q47".
                let name = formatIsolateName(isolate);

                if (name === "unknown unknown") {
                    name = "Unnamed Isolate";
                }

                const sequences = map(isolate.sequences, sequence => {
                    const filled = fillAlign(sequence);

                    return {
                        ...sequence,
                        reads: round(sequence.pi * mappedReadCount),
                        meanDepth: mean(filled),
                        medianDepth: median(filled),
                        sumDepth: sum(filled),
                        filled
                    };
                });

                const filled = flatMap(sequences, "filled");

                const length = filled.length;

                const coverage = compact(filled).length / length;

                return {
                    ...isolate,
                    name,
                    length,
                    pi: sumBy(sequences, "pi"),
                    reads: sumBy(sequences, "reads"),
                    maxDepth: max(filled),
                    meanDepth: mean(filled),
                    medianDepth: median(filled),
                    coverage: coverage.toFixed(3)
                };
            });

            isolates = sortBy(isolates, "coverage").reverse();

            const pi = sumBy(isolates, "pi");

            return {
                ...baseOTU,
                coverage: maxBy(isolates, "coverage").coverage,
                isolates,
                maxGenomeLength: maxBy(isolates, "length").length,
                maxDepth: maxBy(isolates, "meanDepth").maxDepth,
                meanDepth: maxBy(isolates, "meanDepth").meanDepth,
                medianDepth: maxBy(isolates, "medianDepth").medianDepth,
                pi,
                reads: pi * mappedReadCount
            };
        });

        return <PathoscopeController data={data} maxReadLength={props.maxReadLength} />;
    }

    return (
        <Alert bsStyle="info" className="text-center" icon="info-circle">
            No OTU sequences found in sample
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
