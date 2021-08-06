import React, { useEffect } from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { getDefaultSubtractions, getSampleDetailId } from "../../../selectors";
import { SampleLabel } from "../../Label";
import { SidebarHeader } from "./Header";
import { SampleSidebarSelector } from "./Selector";

// TODO: add a add/remove default subtraction function (If necessary)

const InlineSampleLabel = styled(SampleLabel)`
    background-color: ${props => props.theme.color.white};
    display: inline;
    margin: 0 5px 5px 0;
`;

const SampleLabelsList = styled.div`
    display: flex;
    flex-flow: wrap;
`;

export const DefaultSubtractions = ({ defaultSubtractions, sampleId, subtractionOptions, onUpdate }) => {
    const sampleLabelComponents = defaultSubtractions.map(subtraction => (
        <InlineSampleLabel key={subtraction.id} name={subtraction.name} />
    ));

    return (
        <React.Fragment>
            <SidebarHeader>Default Subtractions</SidebarHeader>
            <SampleSidebarSelector
                allItems={subtractionOptions}
                selectedItems={defaultSubtractions}
                sampleId={sampleId}
                onUpdate={onUpdate}
            />
            <SampleLabelsList>{sampleLabelComponents}</SampleLabelsList>
        </React.Fragment>
    );
};

export const mapStateToProps = state => ({
    defaultSubtractions: getDefaultSubtractions(state),
    sampleId: getSampleDetailId(state),
    subtractionOptions: state.subtraction.shortlist
});

export const mapDispatchToProps = dispatch => ({
    onUpdate: (sampleId, subtractions) => {
        dispatch(editSample(sampleId, { subtractions }));
    }
});

export default connect(mapStateToProps)(DefaultSubtractions);
