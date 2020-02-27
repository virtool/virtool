import React from "react";
import AnalysisViewerList from "../Viewer/List";
import PathoscopeItem from "./Item";

export const PathoscopeList = () => (
    <AnalysisViewerList itemSize={142} width={300}>
        {PathoscopeItem}
    </AnalysisViewerList>
);
