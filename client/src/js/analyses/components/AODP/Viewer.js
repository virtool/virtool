import React from "react";
import styled from "styled-components";

import AODPDetail from "./Detail";
import { AODPList } from "./List";
import AODPToolBar from "./Toolbar";

const AODPPanes = styled.div`
    margin-top: 10px;
    display: grid;
    grid-gap: 10px;
    grid-template-columns: 300px 1fr;
`;

export const AODPViewer = props => (
    <div>
        <AODPToolBar />
        <AODPPanes>
            <AODPList />
            <AODPDetail {...props.result} />
        </AODPPanes>
    </div>
);
