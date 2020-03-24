import React from "react";
import styled from "styled-components";
import { Alert, Icon } from "../../../base";

import AODPDetail from "./Detail";
import { AODPList } from "./List";
import AODPOverview from "./Overview";
import AODPToolBar from "./Toolbar";

const AODPPanes = styled.div`
    margin-top: 10px;
    display: grid;
    grid-gap: 10px;
    grid-template-columns: 300px 1fr;
`;

export const AODPViewer = () => (
    <div>
        <Alert color="orange" level>
            <Icon name="exclamation-circle" />
            <span>
                <strong>This is preview report format for AODP.</strong> It is likely to change.
            </span>
        </Alert>
        <AODPOverview />
        <AODPToolBar />
        <AODPPanes>
            <AODPList />
            <AODPDetail />
        </AODPPanes>
    </div>
);
