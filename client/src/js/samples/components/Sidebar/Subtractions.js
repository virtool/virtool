import React from "react";
import { connect } from "react-redux";
import { SidebarHeader, SideBarSection } from "../../../base";
import { getSubtractionOptions } from "../../selectors";
import { SampleSidebarList } from "./List";
import { SampleSidebarSelector } from "./Selector";

const SubtractionInner = ({ name }) => <React.Fragment>{name}</React.Fragment>;

export const DefaultSubtractions = ({ defaultSubtractions, subtractionOptions, onUpdate }) => (
    <SideBarSection>
        <SidebarHeader>
            Default Subtractions
            <SampleSidebarSelector
                render={({ name }) => <SubtractionInner name={name} />}
                sampleItems={subtractionOptions}
                selectedItems={defaultSubtractions}
                onUpdate={onUpdate}
            />
        </SidebarHeader>
        <SampleSidebarList
            items={subtractionOptions.filter(subtraction => defaultSubtractions.includes(subtraction.id))}
        />
    </SideBarSection>
);

export const mapStateToProps = state => ({
    subtractionOptions: getSubtractionOptions(state)
});

export default connect(mapStateToProps)(DefaultSubtractions);
