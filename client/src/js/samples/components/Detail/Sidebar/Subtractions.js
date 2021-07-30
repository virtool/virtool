import React, { useEffect } from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { getSampleDetailId } from "../../../selectors";
import { SidebarHeader } from "./Header";

// TODO: add a add/remove default subtraction function (If necessary)

export const DefaultSubtractions = ({ sampleLabels, sampleId, onListLabels }) => {
    // useEffect(onListLabels, [sampleId]);

    // const sampleLabelComponents = sampleLabels.map(label => (
    //     <InlineSampleLabel key={label.id} color={label.color} name={label.name} />
    // ));

    return (
        <React.Fragment>
            <SidebarHeader>Default Subtractions</SidebarHeader>
            {/* <SampleLabelsList>{sampleLabelComponents}</SampleLabelsList> */}
        </React.Fragment>
    );
};

// export const mapStateToProps = state => ({
//     sampleId: getSampleDetailId(state),
//     sampleLabels: getSampleLabels(state)
// });

export const mapStateToProps = state => ({
    defaultSubtractions: getDefaultSubtractions(state).map(subtraction => subtraction.id),
    hasHmm: !!state.hmms.total_count,
    sampleId: getSampleDetailId(state),
    show: routerLocationHasState(state, "createAnalysis"),
    subtractionOptions: state.subtraction.shortlist
});

// export const mapDispatchToProps = dispatch => ({
//     onListLabels: () => {
//         dispatch(listLabels());
//     }
// });

export default connect(mapStateToProps)(DefaultSubtractions);
