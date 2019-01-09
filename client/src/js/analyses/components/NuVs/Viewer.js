import React from "react";
import { connect } from "react-redux";
import { forEach, reduce } from "lodash-es";

import NuVsExport from "./Export";
import NuVsList from "./List";

export const NuVsViewer = props => {
    // The length of the longest sequence will be stored here.
    let maxSequenceLength = 0;

    const sequences = [];

    forEach(props.results, result => {
        // Don't include sequence if there are no ORFs.
        if (result.orfs.length === 0) {
            return;
        }

        const minE = reduce(
            result.orfs,
            (result, orf) => {
                const orfMinE = reduce(
                    orf.hits,
                    (result, hit) => {
                        if (hit.full_e < result) {
                            return hit.full_e;
                        }
                    },
                    10
                );

                if (orfMinE < result) {
                    return orfMinE;
                }

                return result;
            },
            10
        );

        // Don't include if there are no significant ORFs
        if (minE > 1e-10) {
            return;
        }

        result.minE = minE;

        if (result.sequence.length > maxSequenceLength) {
            maxSequenceLength = result.sequence.length;
        }

        sequences.push(result);
    });

    return (
        <div>
            <NuVsExport results={sequences} />
            <NuVsList data={sequences} analysisId={props.id} maxSequenceLength={maxSequenceLength} />
        </div>
    );
};

const mapStateToProps = state => state.analyses.detail;

export default connect(mapStateToProps)(NuVsViewer);
