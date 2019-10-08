import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { Icon, WarningAlert } from "../../base";
import { getFilesUndersized } from "../selectors";

export const StyledSampleFileSizeWarning = styled(WarningAlert)`
    align-items: center;
    display: flex;

    strong {
        margin-left: 3px;
    }
`;

export const SampleFileSizeWarning = ({ show }) => {
    if (show) {
        return (
            <StyledSampleFileSizeWarning>
                <Icon name="exclamation-triangle" />
                <strong>The read files in this sample are smaller than expected</strong>
            </StyledSampleFileSizeWarning>
        );
    }

    return null;
};

export const mapStateToProps = state => ({
    show: getFilesUndersized(state)
});

export default connect(mapStateToProps)(SampleFileSizeWarning);
