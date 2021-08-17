import React from "react";
import { connect } from "react-redux";
import { getLabels } from "../../../../labels/selectors";
import { editSample } from "../../../actions";
import { getSampleDetailId, getSampleLabels } from "../../../selectors";
import { SampleSidebarProperty } from "./Property";

export const SampleLabels = ({ allLabels, sampleLabels, sampleId, onUpdate }) => (
    <SampleSidebarProperty
        header="Labels"
        sampleItems={allLabels}
        selectedItems={sampleLabels}
        sampleId={sampleId}
        onUpdate={onUpdate}
    />
);

export const mapStateToProps = state => ({
    allLabels: getLabels(state),
    sampleId: getSampleDetailId(state),
    sampleLabels: getSampleLabels(state)
});

export const mapDispatchToProps = dispatch => ({
    onUpdate: (sampleId, labels) => {
        dispatch(editSample(sampleId, { labels }));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(SampleLabels);
