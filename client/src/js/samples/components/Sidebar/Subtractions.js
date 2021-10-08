import React, { useEffect } from "react";
import { connect } from "react-redux";
import { LoadingPlaceholder, SidebarHeader, SideBarSection } from "../../../base";
import { shortlistSubtractions } from "../../../subtraction/actions";
import { getSubtractionOptions } from "../../selectors";
import { SampleSidebarList } from "./List";
import { SampleSidebarSelector } from "./Selector";

const SubtractionInner = ({ name }) => <React.Fragment>{name}</React.Fragment>;

export const DefaultSubtractions = ({ defaultSubtractions, subtractionOptions, onUpdate, onShortlistSubtractions }) => {
    useEffect(onShortlistSubtractions, [null]);
    if (subtractionOptions == undefined) {
        return <LoadingPlaceholder margin="36px" />;
    }

    return (
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
};

export const mapStateToProps = state => ({
    subtractionOptions: getSubtractionOptions(state)
});

export const mapDispatchToProps = dispatch => ({
    onShortlistSubtractions: () => {
        dispatch(shortlistSubtractions());
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(DefaultSubtractions);
