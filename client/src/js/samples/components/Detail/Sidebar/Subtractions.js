import React from "react";
import { connect } from "react-redux";
import { getDefaultSubtractions, getSampleDetailId, getSubtractionOptions } from "../../../selectors";
import { EditableProperty } from "./EditableProperty";

export const DefaultSubtractions = ({ defaultSubtractions, sampleId, subtractionOptions, onUpdate }) => {
    return (
        <EditableProperty
            header="Default Subtractions"
            sampleItems={subtractionOptions}
            selectedItems={defaultSubtractions}
            sampleId={sampleId}
            onUpdate={onUpdate}
        ></EditableProperty>
    );
};

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

export default connect(mapStateToProps)(DefaultSubtractions);
