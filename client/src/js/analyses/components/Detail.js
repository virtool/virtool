import { get } from "lodash-es";
import React, { useEffect } from "react";
import { connect } from "react-redux";
import {
    LoadingPlaceholder,
    NotFound,
    Box,
    RelativeTime,
    SubviewHeader,
    SubviewHeaderAttribution,
    SubviewHeaderTitle
} from "../../base/index";
import { getWorkflowDisplayName } from "../../utils/utils";
import { clearAnalysis, getAnalysis } from "../actions";
import AODPViewer from "./AODP/Viewer";
import AnalysisCache from "./CacheLink";
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
            <Box>
                <LoadingPlaceholder message="Analysis in progress" margin="1.2rem" />
            </Box>
        );
    }

    let content;

    if (detail.workflow === "pathoscope_bowtie") {
        content = <PathoscopeViewer />;
    } else if (detail.workflow === "nuvs") {
        content = <NuVsViewer />;
    } else if (detail.workflow === "aodp") {
        content = <AODPViewer />;
    } else {
        return <div>Unusable analysis detail content</div>;
    }

    return (
        <div>
            <SubviewHeader>
                <SubviewHeaderTitle>
                    {getWorkflowDisplayName(detail.workflow)} for {sampleName}
                    <AnalysisCache />
                </SubviewHeaderTitle>
                <SubviewHeaderAttribution>
                    {detail.user.id} started <RelativeTime time={detail.created_at} />
                </SubviewHeaderAttribution>
            </SubviewHeader>

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

export default connect(mapStateToProps, mapDispatchToProps)(AnalysisDetail);
