import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { SampleLabel } from "../Label";

const StyledSampleLabels = styled.div`
    align-items: stretch;
    display: flex;
    margin-top: 10px;
    gap: 5px;
`;

export const SampleDetailLabels = ({ labels }) => {
    const labelComponents = labels.map(label => <SampleLabel key={label.id} {...label} />);
    return <StyledSampleLabels>{labelComponents}</StyledSampleLabels>;
};

export const mapStateToProps = state => {
    return {
        labels: state.samples.detail.labels
    };
};

export default connect(mapStateToProps)(SampleDetailLabels);
