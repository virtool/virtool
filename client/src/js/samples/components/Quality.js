import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { Quality } from "../../quality/components/Quality";
import LegacyAlert from "./LegacyAlert";

const QualityLegacyAlert = styled.div`
    margin-bottom: 20px;
`;

export const SampleQuality = props => (
    <React.Fragment>
        <QualityLegacyAlert>
            <LegacyAlert />
        </QualityLegacyAlert>
        <Quality {...props} />
    </React.Fragment>
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
