import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { Quality } from "../../quality/components/Quality";
import LegacyAlert from "./LegacyAlert";

const SampleQualityLegacyAlert = styled(LegacyAlert)`
    margin-bottom: 20px;
`;

const StyledSampleQuality = styled.div`
    display: flex;
    flex-direction: column;
`;

export const SampleQuality = props => (
    <StyledSampleQuality>
        <SampleQualityLegacyAlert />
        <Quality {...props} />
    </StyledSampleQuality>
);

const mapStateToProps = state => {
    const { bases, composition, sequences } = state.samples.detail.quality;

    return {
        bases,
        composition,
        sequences
    };
};

export default connect(mapStateToProps)(SampleQuality);
