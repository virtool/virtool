import React from "react";
import { connect } from "react-redux";

import NuVsExport from "./Export";
import NuVsList from "./List";

export const NuVsViewer = ({ id, maxSequenceLength, results }) => {
    return (
        <div>
            <NuVsExport results={results} />
            <NuVsList data={results} analysisId={id} maxSequenceLength={maxSequenceLength} />
        </div>
    );
};

const mapStateToProps = state => {
    const { maxSequenceLength, results } = state.analyses.data;

    return {
        id: state.analyses.detail.id,
        maxSequenceLength,
        results
    };
};

export default connect(mapStateToProps)(NuVsViewer);
