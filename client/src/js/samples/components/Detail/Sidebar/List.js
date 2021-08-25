import React from "react";
import styled from "styled-components";
import { SampleLabel } from "../../Label";

const SampleSidebarListItem = styled(SampleLabel)`
    background-color: ${props => props.theme.color.white};
    display: inline;
    margin: 0 5px 5px 0;
`;

const StyledSampleSidebarList = styled.div`
    display: flex;
    flex-flow: wrap;
`;

export const SampleSidebarList = ({ items }) => {
    const sampleItemComponents = items.map(item => (
        <SampleSidebarListItem key={item.id} color={item.color} name={item.name} />
    ));

    return <StyledSampleSidebarList>{sampleItemComponents}</StyledSampleSidebarList>;
};
