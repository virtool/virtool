import React from "react";
import { connect } from "react-redux";
import { editSample } from "../../../actions";
import { getDefaultSubtractions, getSampleDetailId, getSubtractionOptions } from "../../../selectors";
import { SampleSidebarProperty } from "./Property";

export const DefaultSubtractions = ({ defaultSubtractions, sampleId, subtractionOptions, onUpdate }) => (
    <SampleSidebarProperty
        header="Default Subtractions"
        sampleItems={subtractionOptions}
        selectedItems={defaultSubtractions}
        sampleId={sampleId}
        onUpdate={onUpdate}
    />
);

export const mapStateToProps = state => ({
    defaultSubtractions: getDefaultSubtractions(state),
    sampleId: getSampleDetailId(state),
    subtractionOptions: getSubtractionOptions(state)
});

export const mapDispatchToProps = dispatch => ({
    onUpdate: (sampleId, subtractions) => {
        dispatch(editSample(sampleId, { subtractions }));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(DefaultSubtractions);
