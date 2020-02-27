import React from "react";
import AnalysisViewerList from "../Viewer/List";
import NuVsItem from "./Item";

export const NuVsList = () => (
    <AnalysisViewerList itemSize={58} width={230}>
        {NuVsItem}
    </AnalysisViewerList>
);
