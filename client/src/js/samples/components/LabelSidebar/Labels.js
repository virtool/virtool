import React, { useEffect } from "react";
import { connect } from "react-redux";
import { getSampleLabels } from "../../selectors";
import { SmallSampleLabel } from "../Label";
import { SampleSidebarSelector } from "./Selector";
import { SampleSidebarList } from "./List";
import { LoadingPlaceholder, SidebarHeader, SideBarSection } from "../../../base";
import { listLabels } from "../../../labels/actions";

const SampleLabelInner = ({ name, color, description }) => (
    <React.Fragment>
        <SmallSampleLabel color={color} name={name} />
        <p>{description}</p>
    </React.Fragment>
);

export const SampleLabels = ({ allLabels, sampleLabels, sampleId, onInit, onUpdate }) => {
    useEffect(() => onInit(), [null]);
    if (allLabels === null) {
        return <LoadingPlaceholder margin="36px" />;
    }

    return (
        <SideBarSection>
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
            <SampleSidebarList items={allLabels.filter(item => sampleLabels.includes(item.id))} />
        </SideBarSection>
    );
};

export const mapStateToProps = state => ({
    allLabels: state.labels.documents
});

export const mapDispatchToProps = dispatch => ({
    onInit: () => {
        dispatch(listLabels());
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(SampleLabels);
