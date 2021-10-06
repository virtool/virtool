import React from "react";
import { connect } from "react-redux";
import { SidebarHeader, SideBarSection } from "../../../base";
import { SmallSampleLabel } from "../Label";
import { SampleSidebarList } from "./List";
import { SampleSidebarSelector } from "./Selector";

const SampleLabelInner = ({ name, color, description }) => (
    <React.Fragment>
        <SmallSampleLabel color={color} name={name} />
        <p>{description}</p>
    </React.Fragment>
);

export const SampleLabels = ({ allLabels, sampleLabels, onUpdate }) => (
    <SideBarSection>
        <SidebarHeader>
            Labels
            <SampleSidebarSelector
                render={({ name, color, description }) => (
                    <SampleLabelInner name={name} color={color} description={description} />
                )}
                sampleItems={allLabels}
                selectedItems={sampleLabels}
                onUpdate={onUpdate}
            />
        </SidebarHeader>
        <SampleSidebarList items={allLabels.filter(item => sampleLabels.includes(item.id))} />
    </SideBarSection>
);

export const mapStateToProps = state => ({
    allLabels: state.labels.documents
});

export default connect(mapStateToProps)(SampleLabels);
