import React from "react";
import styled from "styled-components";
import AODPDetail from "./Detail";
import { AODPList } from "./List";

const AODPPanes = styled.div`
    display: grid;
    grid-gap: 10px;
    grid-template-columns: 300px 1fr;
`;

export const AODPViewer = () => (
    <div>
        <AODPPanes>
            <AODPList />
            <AODPDetail />
        </AODPPanes>
    </div>
);
