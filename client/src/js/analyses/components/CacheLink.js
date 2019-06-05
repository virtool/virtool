import React from "react";
import styled from "styled-components";
import { get } from "lodash-es";
import { connect } from "react-redux";
import { Link } from "react-router-dom";

const StyledAnalysisCacheLink = styled(Link)`
    float: right;
    font-size: 14px;
`;

export const AnalysisCacheLink = ({ id, sampleId }) => {
    if (id) {
        return <StyledAnalysisCacheLink to={`/samples/${sampleId}/files/${id}`}>View QC</StyledAnalysisCacheLink>;
    }
    return null;
};

const mapStateToProps = state => ({
    id: get(state, "analyses.detail.cache.id"),
    sampleId: state.samples.detail.id
});

export default connect(mapStateToProps)(AnalysisCacheLink);
