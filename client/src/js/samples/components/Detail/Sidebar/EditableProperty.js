import { forEach } from "lodash-es";
import React from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { SampleLabel } from "../../Label";
import { SidebarHeader } from "./Header";
import { SampleSidebarSelector } from "./Selector";

const InlineSampleItem = styled(SampleLabel)`
    background-color: ${props => props.theme.color.white};
    display: inline;
    margin: 0 5px 5px 0;
`;

const SampleItemsList = styled.div`
    display: flex;
    flex-flow: wrap;
`;

export const EditableProperty = ({ header, sampleItems, selectedItems, sampleId, onUpdate }) => {
    const sampleItemComponents = selectedItems.map(item => (
        <InlineSampleItem key={item.id} color={item.color} name={item.name} />
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
            <SampleItemsList>{sampleItemComponents}</SampleItemsList>
        </React.Fragment>
    );
};

EditableProperty.propTypes = {
    header: PropTypes.string.isRequired,
    sampleItems: PropTypes.arrayOf(PropTypes.object).isRequired,
    selectedItems: PropTypes.arrayOf(PropTypes.object).isRequired,
    sampleId: PropTypes.string.isRequired,
    onUpdate: PropTypes.func.isRequired
};
