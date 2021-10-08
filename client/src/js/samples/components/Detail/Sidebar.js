import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { editSample } from "../../actions";
import { getDefaultSubtractions, getSampleDetailId, getSampleLabels, getSubtractionOptions } from "../../selectors";
import SampleLabels from "./../Sidebar/Labels";
import DefaultSubtractions from "./../Sidebar/Subtractions";

const StyledSidebar = styled.div`
    align-items: stretch;
    flex-direction: column;
    display: flex;
    width: 320px;
    z-index: 0;
`;

export const Sidebar = ({ sampleId, sampleLabels, onLabelUpdate, defaultSubtractions, onSubtractionUpdate }) => {
    return (
        <StyledSidebar>
            <SampleLabels
                onUpdate={labels => {
                    onLabelUpdate(sampleId, labels);
                }}
                sampleLabels={sampleLabels.map(label => label.id)}
            />
            <DefaultSubtractions
                onUpdate={subtractions => {
                    onSubtractionUpdate(sampleId, subtractions);
                }}
                defaultSubtractions={defaultSubtractions.map(subtraction => subtraction.id)}
            />
        </StyledSidebar>
    );
};

export const mapStateToProps = state => ({
    sampleId: getSampleDetailId(state),
    sampleLabels: getSampleLabels(state),
    defaultSubtractions: getDefaultSubtractions(state),
    subtractionOptions: getSubtractionOptions(state)
});

export const mapDispatchToProps = dispatch => ({
    onLabelUpdate: (sampleId, labels) => {
        dispatch(editSample(sampleId, { labels }));
    },
    onSubtractionUpdate: (sampleId, subtractions) => {
        dispatch(editSample(sampleId, { subtractions }));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(Sidebar);
