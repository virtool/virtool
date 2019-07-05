import React from "react";
import styled from "styled-components";
import { Badge } from "react-bootstrap";
import Contributors from "./Contributors";
import IndexOTUs from "./OTUs";

const StyledPanelBadgeHeader = styled.div`
    align-items: center;
    display: flex;

    span.badge {
        margin-left: 3px;
    }
`;

export const PanelBadgeHeader = ({ title, count }) => (
    <StyledPanelBadgeHeader>
        <span>{title}</span>
        <Badge>{count}</Badge>
    </StyledPanelBadgeHeader>
);

export const IndexGeneral = () => (
    <div>
        <IndexOTUs />
        <Contributors />
    </div>
);

export default IndexGeneral;
