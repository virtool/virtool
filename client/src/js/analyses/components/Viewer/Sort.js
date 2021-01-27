import { map } from "lodash-es";
import React from "react";
import styled from "styled-components";
import { Dropdown, DropdownButton, DropdownMenuItem, DropdownMenuList, Icon } from "../../../base";

const workflowSortKeys = {
    aodp: ["identity"],
    pathoscope: ["coverage", "depth", "weight"],
    nuvs: ["length", "e", "orfs"]
};

const SortDropdownButton = styled(DropdownButton)`
    align-items: center;
    display: flex;
    width: ${props => sortWidths[props.workflow]};

    i {
        margin-left: auto;
    }
`;

const sortTitles = {
    coverage: "Coverage",
    depth: "Depth",
    e: "E-Value",
    length: "Length",
    orfs: "ORFs",
    weight: "Weight",
    identity: "Identity"
};

const sortWidths = {
    aodp: "110px",
    pathoscope: "122px",
    nuvs: "110px"
};

export const AnalysisViewerSort = ({ workflow, onSelect, sortKey }) => {
    const options = map(workflowSortKeys[workflow], key => (
        <DropdownMenuItem key={key} onSelect={() => onSelect(key)}>
            {sortTitles[key]}
        </DropdownMenuItem>
    ));

    return (
        <Dropdown>
            <SortDropdownButton workflow={workflow}>
                <span>
                    <Icon name="sort" /> Sort: {sortTitles[sortKey]}
                </span>
                <Icon name="caret-down" />
            </SortDropdownButton>
            <DropdownMenuList>{options}</DropdownMenuList>
        </Dropdown>
    );
};
