
import React from "react";
import { Alert } from "react-bootstrap";
import { Icon } from "virtool/js/components/Base";
import { assign, forEach, sortBy, max } from "lodash";
import { formatIsolateName } from "virtool/js/utils";

import PathoscopeController from "./Controller";

const PathoscopeViewer = (props) => {

    if (props.diagnosis.length > 0) {

        const mappedReadCount = props.read_count;

        const data = props.diagnosis.map((baseVirus) => {

            let virus = assign({}, {
                pi: 0,
                best: 0,
                reads: 0,
                coverage: 0,
                maxGenomeLength: 0,
                maxDepth: 0
            }, baseVirus);

            // Go through each isolate associated with the virus, adding properties for weight, best-hit, read count,
            // and coverage. These values will be calculated from the sequences owned by each isolate.
            forEach(virus.isolates, (isolate) => {
                let isolateDepth = 0;
                let genomeLength = 0;

                // Make a name for the isolate by joining the source type and name, eg. "Isolate" + "Q47".
                isolate.name = formatIsolateName(isolate);

                if (isolate.name === "unknown unknown") {
                    isolate.name = "Unnamed Isolate";
                }

                assign(isolate, {
                    pi: 0,
                    best: 0,
                    reads: 0,
                    coverage: 0
                });

                // Go through each hit/sequence owned by the isolate and composite its values into the overall isolate
                // values of weight, best-hit, read count, and coverage.
                forEach(isolate.sequences, hit => {

                    hit.reads = Math.round(hit.pi * mappedReadCount);

                    // Add the following three values to the totals for the isolate.
                    isolate.pi += hit.pi;
                    isolate.best += hit.best;
                    isolate.reads += hit.reads;

                    const hitDepth = max(hit.align);

                    if (hitDepth > isolateDepth) {
                        isolateDepth = hitDepth;
                    }

                    genomeLength += hit.length;

                    if (hit.coverage > isolate.coverage) {
                        isolate.coverage = hit.coverage;
                    }
                });

                if (genomeLength > virus.maxGenomeLength) {
                    virus.maxGenomeLength = genomeLength;
                }

                if (isolateDepth > virus.maxDepth) {
                    virus.maxDepth = isolateDepth;
                }

                // Add the following three values onto the totals for the virus.
                virus.pi += isolate.pi;
                virus.best += isolate.best;
                virus.reads += isolate.reads;

                // Set the virus coverage to the highest coverage for all of the isolates.
                if (isolate.coverage > virus.coverage) {
                    virus.coverage = isolate.coverage;
                }

            });

            virus.isolates = sortBy(virus.isolates, "coverage").reverse();

            return virus;

        });

        return <PathoscopeController data={data} maxReadLength={props.maxReadLength} />;
    }

    return (
        <Alert bsStyle="info" className="text-center">
            <p>
                <Icon name="notification" /> No virus sequences found in sample
            </p>
        </Alert>
    );

};

PathoscopeViewer.propTypes = {
    diagnosis: React.PropTypes.arrayOf(React.PropTypes.object),
    showListing: React.PropTypes.bool,
    read_count: React.PropTypes.number,
    maxReadLength: React.PropTypes.number
};

export default PathoscopeViewer;
