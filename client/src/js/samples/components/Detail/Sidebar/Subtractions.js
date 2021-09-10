import React from "react";
import { connect } from "react-redux";
import { editSample } from "../../../actions";
import { getDefaultSubtractions, getSampleDetailId, getSubtractionOptions } from "../../../selectors";
import { SampleSidebarList } from "./List";
import { SampleSidebarSelector } from "./Selector";
import { SidebarHeader, SideBarSection } from "../../../../base";

const SubtractionInner = ({ name }) => <React.Fragment>{name}</React.Fragment>;

export const DefaultSubtractions = ({ defaultSubtractions, sampleId, subtractionOptions, onUpdate }) => (
    <SideBarSection>
        <SidebarHeader>
            Default Subtractions
            <SampleSidebarSelector
                render={({ name }) => <SubtractionInner name={name} />}
                sampleItems={subtractionOptions}
                selectedItems={defaultSubtractions}
                sampleId={sampleId}
                onUpdate={onUpdate}
            />
        </SidebarHeader>
        <SampleSidebarList items={defaultSubtractions} />
    </SideBarSection>
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
