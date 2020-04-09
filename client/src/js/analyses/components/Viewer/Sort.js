import React from "react";
import { DropdownButton, DropdownItem } from "../../../base";

export const AnalysisViewerSort = ({ id, title, onSelect }) => (
    <DropdownButton id={id} title={title}>
        <DropdownItem onClick={() => onSelect("length")}>Length</DropdownItem>
        <DropdownItem onClick={() => onSelect("e")}>E-Value</DropdownItem>
        <DropdownItem onClick={() => onSelect("orfs")}>ORFs</DropdownItem>
    </DropdownButton>
);

export const PathoscopeViewerSort = ({ title, onSelect }) => (
    <DropdownButton title={title}>
        <DropdownItem onClick={() => onSelect("coverage")}>Coverage</DropdownItem>
        <DropdownItem onClick={() => onSelect("pi")}>Weight</DropdownItem>
        <DropdownItem onClick={() => onSelect("depth")}>Depth</DropdownItem>
    </DropdownButton>
);
