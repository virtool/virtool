import React from "react";
import styled from "styled-components";
import { Badge } from "../../base";
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
        <span>
            <span>{title} </span>
            <Badge>{count}</Badge>
        </span>
    </StyledPanelBadgeHeader>
);

export const IndexGeneral = () => (
    <div>
        <Contributors />
        <IndexOTUs />
    </div>
);

export default IndexGeneral;
