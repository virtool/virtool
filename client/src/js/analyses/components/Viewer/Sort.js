import React from "react";
import styled from "styled-components";
import { map } from "lodash-es";
import { DropdownButton, DropdownItem, Icon } from "../../../base";

const workflowSortKeys = {
    aodp: ["identity"],
    pathoscope: ["coverage", "depth", "weight"],
    nuvs: ["length", "e", "orfs"]
};

const StyledSortDropdownButtonTitle = styled.div`
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
        <DropdownItem key={key} onClick={() => onSelect(key)}>
            {sortTitles[key]}
        </DropdownItem>
    ));

    return (
        <DropdownButton
            id={`${workflow}-sort-dropdown`}
            title={
                <StyledSortDropdownButtonTitle workflow={workflow}>
                    <span>
                        <Icon name="sort" /> Sort: {sortTitles[sortKey]}
                    </span>
                    <Icon name="caret-down" />
                </StyledSortDropdownButtonTitle>
            }
        >
            {options}
        </DropdownButton>
    );
};
