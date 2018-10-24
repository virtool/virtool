import React from "react";
import PathoscopeList from "./List";
import PathoscopeToolbar from "./Toolbar";

export default function PathoscopeViewer() {
  return (
    <div>
      <PathoscopeToolbar />
      <PathoscopeList />
    </div>
  );
}
