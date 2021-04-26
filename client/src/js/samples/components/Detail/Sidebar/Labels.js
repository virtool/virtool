import React, { useEffect } from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { listLabels } from "../../../../labels/actions";
import { getSampleDetailId, getSampleLabels } from "../../../selectors";
import { SampleLabel } from "../../Label";
import { SidebarHeader } from "./Header";
import SampleLabelsSelector from "./Selector";

const InlineSampleLabel = styled(SampleLabel)`
    background-color: ${props => props.theme.color.white};
    display: inline;
    margin: 0 5px 5px 0;
`;

const SampleLabelsList = styled.div`
    display: flex;
    flex-flow: wrap;
`;

export const SampleLabels = ({ sampleLabels, sampleId, onListLabels }) => {
    useEffect(onListLabels, [sampleId]);

    const sampleLabelComponents = sampleLabels.map(label => (
        <InlineSampleLabel key={label.id} color={label.color} name={label.name} />
    ));

    return (
        <React.Fragment>
            <SidebarHeader>
                Labels
                <SampleLabelsSelector />
            </SidebarHeader>
            <SampleLabelsList>{sampleLabelComponents}</SampleLabelsList>
        </React.Fragment>
    );
};

export const mapStateToProps = state => ({
    sampleId: getSampleDetailId(state),
    sampleLabels: getSampleLabels(state)
});

export const mapDispatchToProps = dispatch => ({
    onListLabels: () => {
        dispatch(listLabels());
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(SampleLabels);
