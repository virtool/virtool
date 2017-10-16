import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { sortBy, assign, filter, reduce } from "lodash";

import NuVsController from "./Controller";

const NuVsViewer = (props) => {

    // The length of the longest sequence will be stored here.
    let maxSequenceLength = 0;

    let sequences = [];

    props.results.forEach(result => {
        // Don't include sequence if there are no ORFs.
        if (result.orfs.length === 0) {
            return;
        }

        const minE = result.orfs.reduce((result, orf) => {
            const orfMinE = orf.hits.reduce((result, hit) => {
                if (hit.full_e < result) {
                    return hit.full_e;
                }
            }, 10);

            if (orfMinE < result) {
                return orfMinE;
            }

            return result;
        }, 10);

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
        <NuVsController
            data={sequences}
            analysisId={props.id}
            maxSequenceLength={maxSequenceLength}
        />
    );
};

const mapStateToProps = (state) => {
    return {
        detail: state.analysisDetail
    };
};

const Container = connect(mapStateToProps)(NuVsViewer);

export default Container;

