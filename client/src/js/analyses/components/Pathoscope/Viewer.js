import React from "react";
import styled from "styled-components";
import PathoscopeDetail from "./Detail";
import { PathoscopeList } from "./List";
import Mapping from "./Mapping";
import PathoscopeToolbar from "./Toolbar";

const PathoscopePanes = styled.div`
    display: grid;
    grid-gap: 10px;
    grid-template-columns: 300px 1fr;
`;

export const PathoscopeViewer = () => (
    <div>
        <Mapping />
        <PathoscopeToolbar />
        <PathoscopePanes>
            <PathoscopeList />
            <PathoscopeDetail />
        </PathoscopePanes>
    </div>
);

export default PathoscopeViewer;
