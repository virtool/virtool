import { forEach } from "lodash-es";
import React from "react";
import styled from "styled-components";
import { SampleLabel } from "../../Label";
import { SidebarHeader } from "./Header";
import { SampleSidebarSelector } from "./Selector";

const InlineSampleLabel = styled(SampleLabel)`
    background-color: ${props => props.theme.color.white};
    display: inline;
    margin: 0 5px 5px 0;
`;

const SampleLabelsList = styled.div`
    display: flex;
    flex-flow: wrap;
`;

export const EditableProperty = ({ header, sampleItems, selectedItems, sampleId, onUpdate }) => {
    // Update the selected list to be all the items but the one to that was closed
    const onClose = (sampleId, selectedItems, itemId) => {
        let newList = [];
        forEach(selectedItems, item => {
            if (item.id !== itemId) {
                newList.push(item.id);
            }
        });
        onUpdate(sampleId, newList);
    };

    const sampleItemComponents = selectedItems.map(item => (
        <InlineSampleLabel
            key={item.id}
            color={item.color}
            name={item.name}
            onClose={() => onClose(sampleId, selectedItems, item.id)}
        />
    ));

    return (
        <React.Fragment>
            <SidebarHeader>
                {header}
                <SampleSidebarSelector
                    sampleItems={sampleItems}
                    selectedItems={selectedItems}
                    sampleId={sampleId}
                    onUpdate={onUpdate}
                />
            </SidebarHeader>
            <SampleLabelsList>{sampleItemComponents}</SampleLabelsList>
        </React.Fragment>
    );
};
