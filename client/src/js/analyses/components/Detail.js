import { get } from "lodash-es";
import React, { useEffect } from "react";
import { Panel } from "react-bootstrap";
import { connect } from "react-redux";
import { LoadingPlaceholder, NotFound, RelativeTime } from "../../base/index";
import { getTaskDisplayName } from "../../utils/utils";
import { clearAnalysis, getAnalysis } from "../actions";
import { AnalysisHeader, AnalysisHeaderAlgorithm, AnalysisHeaderCreated } from "./Header";
import NuVsViewer from "./NuVs/Viewer";
import PathoscopeViewer from "./Pathoscope/Viewer";

export const AnalysisDetail = props => {
    useEffect(() => {
        props.getAnalysis(props.match.params.analysisId);
        return props.clearAnalysis;
    }, [props.match.params.analysisId]);

    if (props.error) {
        return <NotFound />;
    }

    if (props.detail === null) {
        return <LoadingPlaceholder />;
    }

    const { detail, sampleName } = props;

    if (!detail.ready) {
        return (
            <Panel>
                <Panel.Body>
                    <LoadingPlaceholder message="Analysis in progress" margin="1.2rem" />
                </Panel.Body>
            </Panel>
        );
    }

    let content;

    if (detail.algorithm === "pathoscope_bowtie") {
        content = <PathoscopeViewer />;
    } else if (detail.algorithm === "nuvs") {
        content = <NuVsViewer />;
    } else {
        return <div>"Unusable analysis detail content")</div>;
    }

    return (
        <div>
            <AnalysisHeader>
                <AnalysisHeaderAlgorithm>
                    {getTaskDisplayName(detail.algorithm)} for {sampleName}
                </AnalysisHeaderAlgorithm>
                <AnalysisHeaderCreated>
                    {detail.user.id} started <RelativeTime time={detail.created_at} />
                </AnalysisHeaderCreated>
            </AnalysisHeader>

            {content}
        </div>
    );
};

export const mapStateToProps = state => ({
    detail: state.analyses.detail,
    error: get(state, "errors.GET_ANALYSIS_ERROR", null),
    quality: state.samples.detail.quality,
    sampleName: state.samples.detail.name
});

export const mapDispatchToProps = dispatch => ({
    getAnalysis: analysisId => {
        dispatch(getAnalysis(analysisId));
    },

    clearAnalysis: () => {
        dispatch(clearAnalysis());
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(AnalysisDetail);
