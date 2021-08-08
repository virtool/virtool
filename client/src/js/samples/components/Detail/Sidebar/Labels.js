import React, { useEffect } from "react";
import { connect } from "react-redux";
import { listLabels } from "../../../../labels/actions";
import { getLabels } from "../../../../labels/selectors";
import { editSample } from "../../../actions";
import { getSampleDetailId, getSampleLabels } from "../../../selectors";
import { EditableProperty } from "./EditableProperty";

export const SampleLabels = ({ allLabels, sampleLabels, sampleId, onListLabels, onUpdate }) => {
    useEffect(onListLabels, [sampleId]);

    return (
        <EditableProperty
            header="Labels"
            sampleItems={allLabels}
            selectedItems={sampleLabels}
            sampleId={sampleId}
            onUpdate={onUpdate}
        ></EditableProperty>
    );
};

export const mapStateToProps = state => ({
    allLabels: getLabels(state),
    sampleId: getSampleDetailId(state),
    sampleLabels: getSampleLabels(state)
});

export const mapDispatchToProps = dispatch => ({
    onListLabels: () => {
        dispatch(listLabels());
    },
    onUpdate: (sampleId, labels) => {
        dispatch(editSample(sampleId, { labels }));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(SampleLabels);
