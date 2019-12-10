import React from "react";
import styled from "styled-components";
import { Attribution, Badge, BoxGroupSection } from "../../base";

const StyledReferenceSelectItem = styled(BoxGroupSection)`
    display: grid;
    grid-template-columns: 1fr 1fr auto;
`;

export const ReferenceSelectItem = ({ active, reference, onClick }) => (
    <StyledReferenceSelectItem active={active} onClick={onClick}>
        <strong>{reference.name}</strong>
        <Attribution time={reference.created_at} user={reference.user.id} />
        <div>
            <Badge>{reference.otu_count} OTUs</Badge>
        </div>
    </StyledReferenceSelectItem>
);
