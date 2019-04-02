import React from "react";
import PathoscopeList from "./List";
import PathoscopeMapping from "./Mapping";
import PathoscopeToolbar from "./Toolbar";

export default function PathoscopeViewer() {
    return (
        <div>
            <PathoscopeMapping />
            <PathoscopeToolbar />
            <PathoscopeList />
        </div>
    );
}
