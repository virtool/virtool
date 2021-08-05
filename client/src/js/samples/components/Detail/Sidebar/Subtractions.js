import React, { useEffect } from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { routerLocationHasState } from "../../../../utils/utils";
import { getDefaultSubtractions, getSampleDetailId } from "../../../selectors";
import { SampleLabel } from "../../Label";
import { SidebarHeader } from "./Header";
import { SampleLabelsSelector } from "./Selector";

// TODO: add a add/remove default subtraction function (If necessary)

const SampleLabelsList = styled.div`
    display: flex;
    flex-flow: wrap;
`;

const InlineSampleLabel = styled(SampleLabel)`
    background-color: ${props => props.theme.color.white};
    display: inline;
    margin: 0 5px 5px 0;
`;

export const DefaultSubtractions = ({ defaultSubtractions, sampleId, subtractionOptions }) => {
    // useEffect(onListLabels, [sampleId]);

    const sampleLabelComponents = defaultSubtractions.map(subtraction => (
        <InlineSampleLabel key={subtraction.id} name={subtraction.name} />
    ));

    return (
        <React.Fragment>
            <SidebarHeader>Default Subtractions</SidebarHeader>
            <SampleLabelsSelector
                allLabels={subtractionOptions}
                sampleLabels={defaultSubtractions}
                sampleId={sampleId}
            />
            <SampleLabelsList>{sampleLabelComponents}</SampleLabelsList>
        </React.Fragment>
    );
};

// export const mapStateToProps = state => ({
//     sampleId: getSampleDetailId(state),
//     sampleLabels: getSampleLabels(state)
// });

export const mapStateToProps = state => ({
    defaultSubtractions: getDefaultSubtractions(state),
    sampleId: getSampleDetailId(state),
    subtractionOptions: state.subtraction.shortlist
});

// export const mapDispatchToProps = dispatch => ({
//     onListLabels: () => {
//         dispatch(listLabels());
//     }
// });

export default connect(mapStateToProps)(DefaultSubtractions);
