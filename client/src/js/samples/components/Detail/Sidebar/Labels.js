import React from "react";
import { connect } from "react-redux";
import { getLabels } from "../../../../labels/selectors";
import { editSample } from "../../../actions";
import { getSampleDetailId, getSampleLabels } from "../../../selectors";
import { SmallSampleLabel } from "../../Label";
import { SidebarProperty } from "./Property";
import { SidebarHeader } from "./Header";
import { SampleSidebarSelector } from "./Selector";
import { SampleSidebarList } from "./List";

const SampleLabelInner = ({ name, color, description }) => (
    <React.Fragment>
        <SmallSampleLabel color={color} name={name} />
        <p>{description}</p>
    </React.Fragment>
);

export const SampleLabels = ({ allLabels, sampleLabels, sampleId, onUpdate }) => (
    <SidebarProperty>
        <SidebarHeader>
            Labels
            <SampleSidebarSelector
                render={({ name, color, description }) => (
                    <SampleLabelInner name={name} color={color} description={description} />
                )}
                sampleItems={allLabels}
                selectedItems={sampleLabels}
                sampleId={sampleId}
                onUpdate={onUpdate}
            />
        </SidebarHeader>
        <SampleSidebarList items={sampleLabels} />
    </SidebarProperty>
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
