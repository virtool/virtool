import React from "react";
import styled from "styled-components";
import { Attribution, Badge, SelectBoxGroupSection } from "../../base";

const StyledReferenceSelectItem = styled(SelectBoxGroupSection)`
    display: grid;
    grid-template-columns: 2fr 2fr 1fr;
`;

export const ReferenceSelectorItem = ({ active, reference, onClick }) => (
    <StyledReferenceSelectItem active={active} onClick={onClick}>
        <strong>{reference.name}</strong>
        <Attribution time={reference.created_at} user={reference.user.id} />
        <div>
            <Badge>{reference.otu_count} OTUs</Badge>
        </div>
    </StyledReferenceSelectItem>
);
