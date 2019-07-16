import React from "react";
import PathoscopeList from "./List";
import PathoscopeMapping from "./Mapping";
import PathoscopeToolbar from "./Toolbar";

export const PathoscopeViewer = () => (
    <div>
        <PathoscopeMapping />
        <PathoscopeToolbar />
        <PathoscopeList />
    </div>
);

export default PathoscopeViewer;
