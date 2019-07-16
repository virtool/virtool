import React from "react";
import styled from "styled-components";
import NuVsDetail from "./Detail";
import NuVsExport from "./Export";
import NuVsList from "./List";
import NuVsToolbar from "./Toolbar";

const NuVsPanes = styled.div`
    display: grid;
    grid-template-columns: 200px 1fr;
`;

export const NuVsViewer = () => (
    <div>
        <NuVsExport />
        <NuVsToolbar />
        <NuVsPanes>
            <NuVsList />
            <NuVsDetail />
        </NuVsPanes>
    </div>
);

export default NuVsViewer;
